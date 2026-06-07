import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLog } from '@/drizzle/schema'
import {
  clients,
  leadCategoryScores,
  leads,
  scoringConfigVersions,
} from '@/drizzle/schema-leads'
import { scoreLead, type LeadAnswers, type ScoreResult, type ScoringConfig } from './score-lead'

export type PersistLeadScoreResult = ScoreResult & {
  leadId: string
  configVersionId: string
  completeness: number
}

type LeadScoreSource = {
  clientType: string | null
  budgetBand: string | null
  timeline: string | null
  consentStatus: string | null
  location: string | null
  suburb: string | null
  decisionMakers: string | null
  priceSensitivityRead: string | null
  storedAnswers: Partial<Record<keyof LeadAnswers, string>>
}

export async function persistLeadScore(
  leadId: string,
  actorId?: string | null,
): Promise<PersistLeadScoreResult> {
  const activeConfig = await loadActiveConfig()
  const leadSource = await loadLeadScoreSource(leadId)
  const answers = leadSourceToAnswers(leadSource, activeConfig.config)
  const scoreResult = scoreLead(answers, activeConfig.config)
  const completeness = calculateCompleteness(scoreResult.categoryRows)
  const scoredAt = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(leads)
      .set({
        seedScore: scoreResult.score,
        tier: scoreResult.tier,
        scoreReason: scoreResult.reason,
        configVersionId: activeConfig.id,
        scoredAt,
        completeness,
        updatedAt: scoredAt,
      })
      .where(eq(leads.id, leadId))

    for (const row of scoreResult.categoryRows) {
      await tx
        .insert(leadCategoryScores)
        .values({
          leadId,
          category: row.category,
          answerKey: row.answerKey,
          points: row.points,
          configVersionId: activeConfig.id,
        })
        .onConflictDoUpdate({
          target: [leadCategoryScores.leadId, leadCategoryScores.category],
          set: {
            answerKey: row.answerKey,
            points: row.points,
            configVersionId: activeConfig.id,
          },
        })
    }

    await tx.insert(auditLog).values({
      actorId: actorId ?? null,
      action: 'lead.score',
      targetId: leadId,
      detail: {
        score: scoreResult.score,
        tier: scoreResult.tier,
        configVersionId: activeConfig.id,
        completeness,
      },
    })
  })

  return {
    ...scoreResult,
    leadId,
    configVersionId: activeConfig.id,
    completeness,
  }
}

async function loadActiveConfig(): Promise<{ id: string; config: ScoringConfig }> {
  const [activeConfig] = await db
    .select({
      id: scoringConfigVersions.id,
      config: scoringConfigVersions.config,
    })
    .from(scoringConfigVersions)
    .where(eq(scoringConfigVersions.isActive, true))
    .limit(1)

  if (!activeConfig) {
    throw new Error('No active scoring config version found')
  }

  return {
    id: activeConfig.id,
    config: activeConfig.config as ScoringConfig,
  }
}

async function loadLeadScoreSource(leadId: string): Promise<LeadScoreSource> {
  const [leadSource] = await db
    .select({
      clientType: clients.clientType,
      budgetBand: leads.budgetBand,
      timeline: leads.timeline,
      consentStatus: leads.consentStatus,
      location: leads.location,
      suburb: leads.suburb,
      decisionMakers: leads.decisionMakers,
      priceSensitivityRead: leads.priceSensitivityRead,
    })
    .from(leads)
    .innerJoin(clients, eq(leads.clientId, clients.id))
    .where(eq(leads.id, leadId))
    .limit(1)

  if (!leadSource) {
    throw new Error(`Lead not found: ${leadId}`)
  }

  const storedRows = await db
    .select({
      category: leadCategoryScores.category,
      answerKey: leadCategoryScores.answerKey,
    })
    .from(leadCategoryScores)
    .where(eq(leadCategoryScores.leadId, leadId))

  return {
    ...leadSource,
    storedAnswers: Object.fromEntries(
      storedRows
        .filter((row) => row.answerKey !== null)
        .map((row) => [`cat${row.category}`, row.answerKey]),
    ),
  }
}

function leadSourceToAnswers(source: LeadScoreSource, config: ScoringConfig): LeadAnswers {
  return {
    cat1: optionKeyOrUndefined(config, '1', source.storedAnswers.cat1 ?? source.clientType),
    cat2: optionKeyOrUndefined(config, '2', source.storedAnswers.cat2 ?? source.budgetBand),
    cat3: optionKeyOrUndefined(config, '3', source.storedAnswers.cat3 ?? source.consentStatus ?? source.timeline),
    cat4: optionKeyOrUndefined(config, '4', source.storedAnswers.cat4 ?? null),
    cat5: optionKeyOrUndefined(config, '5', source.storedAnswers.cat5 ?? source.priceSensitivityRead),
    cat6: optionKeyOrUndefined(config, '6', source.storedAnswers.cat6 ?? source.decisionMakers),
    cat7: optionKeyOrUndefined(config, '7', source.storedAnswers.cat7 ?? null),
  }
}

function optionKeyOrUndefined(
  config: ScoringConfig,
  category: string,
  value: string | null,
): string | undefined {
  if (!value) return undefined
  return Object.hasOwn(config.categories[category]?.options ?? {}, value) ? value : undefined
}

function calculateCompleteness(categoryRows: ScoreResult['categoryRows']): number {
  const answeredRows = categoryRows.filter((row) => row.answerKey !== null)
  return Math.round((answeredRows.length / categoryRows.length) * 100)
}
