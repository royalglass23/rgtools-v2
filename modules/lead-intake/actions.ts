'use server'

import { eq, or } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLog } from '@/drizzle/schema'
import { clients, leadCategoryScores, leads } from '@/drizzle/schema-leads'
import { getActiveScoringOptionLists } from '@/modules/lead-intake/scoring/config-options'
import { persistLeadScore } from '@/modules/lead-intake/scoring/persist-score'
import {
  markLeadPendingServiceM8Sync,
  syncLeadToServiceM8,
  type ServiceM8LeadSyncOutcome,
} from '@/modules/lead-intake/servicem8/sync'
import {
  buildCategoryAnswers,
  normalizeInput,
  validateMinimum,
  validateScoredOptions,
} from './intake-utils'
import { computeDistanceBand } from './distance'

export type LeadIntakeInput = {
  leadId?: string
  editReason?: string
  clientName: string
  companyName?: string
  phone?: string
  email?: string
  clientProfileKey: string
  projectType: string
  location: string
  suburb?: string
  cat4?: string
  consentStatus?: string
  budgetBand?: string
  decisionMakers?: string
  priceSensitivityRead?: string
  distanceBand?: string
  source: 'phone' | 'email' | 'wechat' | 'calculator' | 'contact_form' | 'other'
  timeline?: string
  externalRef?: string
  freeText?: string
}

export type LeadIntakeResult =
  | {
      success: true
      leadId: string
      clientId: string
      matchedExistingClient: boolean
      score: number
      tier: 'A' | 'B' | 'C' | 'D'
      reason: string
      completeness: number
      distanceBand: string | null
      flagNote: string | null
      servicem8Sync: ServiceM8LeadSyncOutcome
    }
  | { error: string }

export async function getLeadIntakeForEdit(leadId: string): Promise<LeadIntakeInput | null> {
  const [row] = await db
    .select({
      leadId: leads.id,
      source: leads.source,
      projectType: leads.projectType,
      location: leads.location,
      suburb: leads.suburb,
      consentStatus: leads.consentStatus,
      budgetBand: leads.budgetBand,
      decisionMakers: leads.decisionMakers,
      priceSensitivityRead: leads.priceSensitivityRead,
      freeText: leads.freeText,
      clientName: clients.name,
      companyName: clients.companyName,
      phone: clients.phone,
      email: clients.email,
    })
    .from(leads)
    .innerJoin(clients, eq(leads.clientId, clients.id))
    .where(eq(leads.id, leadId))
    .limit(1)

  if (!row) return null

  const categoryRows = await db
    .select({
      category: leadCategoryScores.category,
      answerKey: leadCategoryScores.answerKey,
    })
    .from(leadCategoryScores)
    .where(eq(leadCategoryScores.leadId, leadId))

  const answerByCategory = Object.fromEntries(
    categoryRows.map((categoryRow) => [categoryRow.category, categoryRow.answerKey ?? '']),
  )

  return {
    leadId: row.leadId,
    clientName: row.clientName,
    companyName: row.companyName ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    clientProfileKey: answerByCategory[1] ?? '',
    projectType: row.projectType ?? '',
    location: row.location ?? '',
    suburb: row.suburb ?? '',
    cat4: answerByCategory[4] ?? '',
    distanceBand: answerByCategory[7] ?? '',
    consentStatus: row.consentStatus ? answerByCategory[3] ?? row.consentStatus ?? '' : '',
    budgetBand: answerByCategory[2] ?? row.budgetBand ?? '',
    decisionMakers: answerByCategory[6] ?? row.decisionMakers ?? '',
    priceSensitivityRead: answerByCategory[5] ?? row.priceSensitivityRead ?? '',
    source: row.source,
    freeText: row.freeText ?? '',
  }
}

export async function computeLeadDistance(address: string): Promise<string | null> {
  return computeDistanceBand(address)
}

export async function submitLeadIntake(input: LeadIntakeInput): Promise<LeadIntakeResult> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Forbidden' }

  return submitLeadIntakeForUser(input, session.user.id)
}

export async function submitLeadIntakeForUser(
  input: LeadIntakeInput,
  actorId: string | null,
): Promise<LeadIntakeResult> {
  const normalized = normalizeInput(input)
  const validationError = validateMinimum(normalized)
  if (validationError) return { error: validationError }
  if (normalized.leadId && !normalized.editReason) return { error: 'Reason for edit is required.' }

  const optionLists = await getActiveScoringOptionLists()
  const optionError = validateScoredOptions(normalized, optionLists.categories)
  if (optionError) return { error: optionError }

  const distanceBand = await computeDistanceBand(normalized.location)
  const categoryAnswers = buildCategoryAnswers(normalized, distanceBand)
  const now = new Date()
  let leadId = ''
  let clientId = ''
  let matchedExistingClient = Boolean(normalized.leadId)

  await db.transaction(async (tx) => {
    if (normalized.leadId) {
      const [existingLead] = await tx
        .select({ id: leads.id, clientId: leads.clientId })
        .from(leads)
        .where(eq(leads.id, normalized.leadId))
        .limit(1)

      if (!existingLead) throw new Error(`Lead not found: ${normalized.leadId}`)

      leadId = existingLead.id
      clientId = existingLead.clientId

      await tx
        .update(clients)
        .set({
          name: normalized.clientName,
          companyName: normalized.companyName || null,
          phone: normalized.phone || null,
          phoneNormalized: normalized.phoneNormalized,
          email: normalized.email || null,
          updatedAt: now,
        })
        .where(eq(clients.id, clientId))

      await tx
        .update(leads)
        .set({
          source: normalized.source,
          projectType: normalized.projectType,
          location: normalized.location,
          suburb: normalized.suburb || null,
          timeline: normalized.timeline || null,
          budgetBand: normalized.budgetBand || null,
          consentStatus: normalized.consentStatus || null,
          decisionMakers: normalized.decisionMakers || null,
          priceSensitivityRead: normalized.priceSensitivityRead || null,
          freeText: normalized.freeText || null,
          updatedAt: now,
        })
        .where(eq(leads.id, leadId))
    } else {
      const matchedClient = await findMatchingClient(tx, normalized.phoneNormalized, normalized.email ?? '')

      if (matchedClient) {
        clientId = matchedClient.id
        matchedExistingClient = true
        await tx
          .update(clients)
          .set({
            name: normalized.clientName,
            companyName: normalized.companyName || matchedClient.companyName,
            phone: normalized.phone || matchedClient.phone,
            phoneNormalized: normalized.phoneNormalized || matchedClient.phoneNormalized,
            email: normalized.email || matchedClient.email,
            updatedAt: now,
          })
          .where(eq(clients.id, matchedClient.id))
      } else {
        const [createdClient] = await tx
          .insert(clients)
          .values({
            name: normalized.clientName,
            companyName: normalized.companyName || null,
            phone: normalized.phone || null,
            phoneNormalized: normalized.phoneNormalized || null,
            email: normalized.email || null,
          })
          .returning({ id: clients.id })

        clientId = createdClient.id
      }

      const [createdLead] = await tx
        .insert(leads)
        .values({
          clientId,
          source: normalized.source,
          syncStatus: 'pending_sync',
          projectType: normalized.projectType,
          location: normalized.location,
          suburb: normalized.suburb || null,
          timeline: normalized.timeline || null,
          externalRef: normalized.externalRef || null,
          budgetBand: normalized.budgetBand || null,
          consentStatus: normalized.consentStatus || null,
          decisionMakers: normalized.decisionMakers || null,
          priceSensitivityRead: normalized.priceSensitivityRead || null,
          freeText: normalized.freeText || null,
          createdBy: actorId,
        })
        .returning({ id: leads.id })

      leadId = createdLead.id
    }

    for (const answer of categoryAnswers) {
      await tx
        .insert(leadCategoryScores)
        .values({
          leadId,
          category: answer.category,
          answerKey: answer.answerKey,
          points: 0,
          configVersionId: optionLists.configVersionId,
        })
        .onConflictDoUpdate({
          target: [leadCategoryScores.leadId, leadCategoryScores.category],
          set: {
            answerKey: answer.answerKey,
            configVersionId: optionLists.configVersionId,
          },
        })
    }

    await tx.insert(auditLog).values({
      actorId,
      action: normalized.leadId ? 'lead.edited' : 'lead.create',
      targetId: leadId,
      detail: {
        clientId,
        source: normalized.source,
        matchedExistingClient,
        ...(normalized.leadId ? { reason: normalized.editReason } : {}),
      },
    })
  })

  const score = await persistLeadScore(leadId, actorId)
  await markLeadPendingServiceM8Sync(leadId)
  const servicem8Sync = await syncLeadToServiceM8(leadId)

  return {
    success: true,
    leadId,
    clientId,
    matchedExistingClient,
    score: score.score,
    tier: score.tier,
    reason: score.reason,
    completeness: score.completeness,
    distanceBand,
    flagNote: score.flagNote,
    servicem8Sync,
  }
}

async function findMatchingClient(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  phoneNormalized: string | null,
  email: string,
) {
  const matchConditions = [
    phoneNormalized ? eq(clients.phoneNormalized, phoneNormalized) : null,
    email ? eq(clients.email, email) : null,
  ].filter((condition): condition is NonNullable<typeof condition> => condition !== null)

  if (matchConditions.length === 0) return null

  const [client] = await tx
    .select()
    .from(clients)
    .where(matchConditions.length === 1 ? matchConditions[0] : or(...matchConditions))
    .limit(1)

  return client ?? null
}
