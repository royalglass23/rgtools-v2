import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLog } from '@/drizzle/schema'
import { logAudit } from '@/lib/audit-db'
import { clients, leadCategoryScores, leads } from '@/drizzle/schema-leads'
import { errorMessage } from '@/lib/error-message'
import { setJobLeadsQuality } from '@/lib/servicem8/client'
import { createServiceM8ClientFromEnv } from './client'
import { buildServiceM8InboxEmail, type ServiceM8LeadSyncRecord } from './payload'

export type ServiceM8LeadSyncOutcome =
  | { ok: true; leadId: string; reference: string }
  | { ok: false; leadId: string; error: string }

export type ServiceM8BatchSyncOutcome = {
  total: number
  results: ServiceM8LeadSyncOutcome[]
}

export async function syncLeadToServiceM8(leadId: string): Promise<ServiceM8LeadSyncOutcome> {
  try {
    const record = await loadLeadSyncRecord(leadId)
    if (record.servicem8JobUuid) {
      const reference = `linked:${record.servicem8JobUuid}`
      const now = new Date()

      // Already-linked leads skip the inbox email, but we still push the current
      // tier to the job's Leads Quality field. Best-effort: a failed write must
      // not fail the sync — the lead is already linked and synced.
      if (record.tier) {
        try {
          await setJobLeadsQuality(record.servicem8JobUuid, record.tier)
        } catch {
          // swallow — Leads Quality is a nice-to-have; the sync still succeeds
        }
      }

      await db
        .update(leads)
        .set({
          servicem8JobUuid: record.servicem8JobUuid,
          syncStatus: 'synced',
          syncError: null,
          updatedAt: now,
        })
        .where(eq(leads.id, leadId))

      await logAudit({
        actorId: null,
        entityType: 'lead',
        action: 'lead.servicem8_sync',
        targetId: leadId,
        before: null,
        after: {
          reference,
          skipped: true,
          reason: 'already_linked',
        },
      })

      return { ok: true, leadId, reference }
    }

    const client = createServiceM8ClientFromEnv()
    const noteSignature = buildServiceM8InboxEmail(record, []).noteSignature
    const lastSignature = await loadLastSyncedNoteSignature(leadId)
    const shouldCreateNote = lastSignature !== noteSignature
    const syncResult = await client.sendLeadToInbox(record, { createNote: shouldCreateNote })
    const now = new Date()

    await db
      .update(leads)
      .set({
        servicem8JobUuid: record.servicem8JobUuid,
        syncStatus: 'synced',
        syncError: null,
        updatedAt: now,
      })
      .where(eq(leads.id, leadId))

    await logAudit({
      actorId: null,
      entityType: 'lead',
      action: 'lead.servicem8_sync',
      targetId: leadId,
      before: null,
      after: {
        reference: syncResult.reference,
        sentToInbox: shouldCreateNote,
        noteSignature: syncResult.noteSignature,
      },
    })

    return { ok: true, leadId, reference: syncResult.reference }
  } catch (error) {
    const message = errorMessage(error)

    await db
      .update(leads)
      .set({
        syncStatus: 'sync_failed',
        syncError: message,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId))

    await logAudit({
      actorId: null,
      entityType: 'lead',
      action: 'lead.servicem8_sync_failed',
      targetId: leadId,
      before: null,
      after: { error: message },
    })

    return { ok: false, leadId, error: message }
  }
}

export async function retryServiceM8LeadSyncBatch(
  { limit = 10 }: { limit?: number } = {},
): Promise<ServiceM8BatchSyncOutcome> {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 25)
  const rows = await db
    .select({ leadId: leads.id })
    .from(leads)
    .where(or(eq(leads.syncStatus, 'pending_sync'), eq(leads.syncStatus, 'sync_failed')))
    .limit(boundedLimit)

  const results: ServiceM8LeadSyncOutcome[] = []
  for (const row of rows) {
    results.push(await syncLeadToServiceM8(row.leadId))
  }

  return {
    total: rows.length,
    results,
  }
}

export async function markLeadPendingServiceM8Sync(leadId: string): Promise<void> {
  await db
    .update(leads)
    .set({
      syncStatus: 'pending_sync',
      syncError: null,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId))
}

async function loadLeadSyncRecord(leadId: string): Promise<ServiceM8LeadSyncRecord> {
  const [record] = await db
    .select({
      leadId: leads.id,
      servicem8JobUuid: leads.servicem8JobUuid,
      clientName: clients.name,
      companyName: clients.companyName,
      phone: clients.phone,
      email: clients.email,
      source: leads.source,
      projectType: leads.projectType,
      location: leads.location,
      suburb: leads.suburb,
      budgetBand: leads.budgetBand,
      consentStatus: leads.consentStatus,
      priceSensitivityRead: leads.priceSensitivityRead,
      decisionMakers: leads.decisionMakers,
      freeText: leads.freeText,
      seedScore: leads.seedScore,
      tier: leads.tier,
      scoreReason: leads.scoreReason,
      strikeFlag: leads.strikeFlag,
      completeness: leads.completeness,
    })
    .from(leads)
    .innerJoin(clients, eq(leads.clientId, clients.id))
    .where(eq(leads.id, leadId))
    .limit(1)

  if (!record) {
    throw new Error(`Lead not found: ${leadId}`)
  }

  const categoryRows = await db
    .select({
      category: leadCategoryScores.category,
      answerKey: leadCategoryScores.answerKey,
    })
    .from(leadCategoryScores)
    .where(eq(leadCategoryScores.leadId, leadId))
    .limit(20)

  const answerByCategory = Object.fromEntries(
    categoryRows.map((row) => [row.category, row.answerKey]),
  )

  return {
    ...record,
    clientProfileKey: answerByCategory[1] ?? null,
    complexity: answerByCategory[4] ?? null,
    distanceBand: answerByCategory[7] ?? null,
  }
}

async function loadLastSyncedNoteSignature(leadId: string): Promise<string | null> {
  const [row] = await db
    .select({ detail: auditLog.detail })
    .from(auditLog)
    .where(and(
      eq(auditLog.targetId, leadId),
      inArray(auditLog.action, ['lead.servicem8_sync']),
    ))
    .orderBy(desc(auditLog.createdAt))
    .limit(1)

  const detail = row?.detail
  if (!detail || typeof detail !== 'object' || !('noteSignature' in detail)) return null

  const signature = 'noteSignature' in detail && typeof detail.noteSignature === 'object' && detail.noteSignature !== null && 'to' in detail.noteSignature
    ? (detail.noteSignature as { to?: unknown }).to
    : detail.noteSignature
  return typeof signature === 'string' ? signature : null
}
