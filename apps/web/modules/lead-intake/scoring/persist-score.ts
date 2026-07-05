import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit-db'
import { leads } from '@rgtools/db/schema-leads'
import { scoreLead, type DecisionMatrixAnswers, type LeadTier, type ScoreResult } from './score-lead'

export type PersistLeadScoreResult = ScoreResult & {
  leadId: string
  configVersionId: string | null
  reason: string
  completenessPercent: number
  flagNote: string | null
}

type LeadScoreSource = {
  clientTypeAnswer: string | null
  budgetBand: string | null
  resourceConsent: string | null
  buildingConsent: string | null
  buildingStage: string | null
  projectType: string | null
  priceSensitivity: string | null
  decisionMakers: string | null
  source: string | null
  distanceBand: string | null
  paymentHistory: string | null
  siteAccess: string | null
  installationHeight: string | null
}

export async function persistLeadScore(
  leadId: string,
  actorId?: string | null,
): Promise<PersistLeadScoreResult> {
  const leadSource = await loadLeadScoreSource(leadId)
  const scoreResult = scoreLead(leadSourceToAnswers(leadSource))
  const completenessPercent = Math.round((scoreResult.completeness.answered / scoreResult.completeness.total) * 100)
  const scoredAt = new Date()
  const reason = buildReason(scoreResult)

  await db.transaction(async (tx) => {
    await tx
      .update(leads)
      .set({
        seedScore: scoreResult.score,
        tier: scoreResult.tier,
        scoreReason: reason,
        strikeFlag: null,
        configVersionId: null,
        scoredAt,
        completeness: completenessPercent,
        updatedAt: scoredAt,
      })
      .where(eq(leads.id, leadId))

    await logAudit({
      actorId: actorId ?? null,
      entityType: 'lead',
      action: 'lead.score',
      targetId: leadId,
      before: null,
      after: {
        score: scoreResult.score,
        tier: scoreResult.tier,
        configVersionId: null,
        completeness: completenessPercent,
      },
    }, tx)
  })

  return {
    ...scoreResult,
    leadId,
    configVersionId: null,
    reason,
    completenessPercent,
    flagNote: null,
  }
}

async function loadLeadScoreSource(leadId: string): Promise<LeadScoreSource> {
  const [leadSource] = await db
    .select({
      clientTypeAnswer: leads.clientTypeAnswer,
      budgetBand: leads.budgetBand,
      resourceConsent: leads.resourceConsent,
      buildingConsent: leads.buildingConsent,
      buildingStage: leads.buildingStage,
      projectType: leads.projectType,
      priceSensitivity: leads.priceSensitivity,
      decisionMakers: leads.decisionMakers,
      source: leads.source,
      distanceBand: leads.distanceBand,
      paymentHistory: leads.paymentHistory,
      siteAccess: leads.siteAccess,
      installationHeight: leads.installationHeight,
    })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1)

  if (!leadSource) {
    throw new Error(`Lead not found: ${leadId}`)
  }

  return leadSource
}

function leadSourceToAnswers(source: LeadScoreSource): DecisionMatrixAnswers {
  return {
    clientType: source.clientTypeAnswer,
    budgetBand: source.budgetBand,
    resourceConsent: source.resourceConsent,
    buildingConsent: source.buildingConsent,
    buildingStage: source.buildingStage,
    projectType: source.projectType,
    priceSensitivity: source.priceSensitivity,
    decisionMakers: source.decisionMakers,
    source: source.source,
    distanceBand: source.distanceBand,
    paymentHistory: source.paymentHistory,
    siteAccess: source.siteAccess,
    installationHeight: source.installationHeight,
  }
}

function buildReason(scoreResult: ScoreResult): string {
  return `Tier ${scoreResult.tier} (${scoreResult.score}): ${scoreResult.completeness.answered}/${scoreResult.completeness.total} matrix fields answered`
}

export function tierFollowUpLabel(tier: LeadTier): string {
  return `Tier ${tier}`
}
