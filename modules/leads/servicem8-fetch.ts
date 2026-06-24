import { eq, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit-db'
import { leads } from '@/drizzle/schema-leads'
import { createServiceM8RequestFromEnv, resolveJobUuid } from '@/lib/servicem8/client'
import type { ServiceM8FetchRequest } from '@/lib/servicem8/client'

// Re-exported for existing importers/tests that reference these from this module.
export { createServiceM8RequestFromEnv }
export type { ServiceM8FetchRequest }

type ServiceM8Job = {
  uuid?: string
  job_description?: string
  status?: string
  generated_job_id?: string | null
}

type ServiceM8InboxMessage = {
  converted_to_job_uuid?: string | null
  message_text?: string | null
  message_html?: string | null
  subject?: string | null
}

export type LeadServiceM8FetchResult =
  | {
      ok: true
      jobUuid: string
      jobNumber: string | null
      jobStatus: string | null
      leadsQuality: string
      customFieldUpdated: boolean
      customFieldError?: string
    }
  | {
      ok: false
      reason: 'not_found' | 'error'
      message: string
    }

export type LeadServiceM8ManualLinkResult =
  | {
      ok: true
      jobUuid: string
      jobNumber: string
      jobStatus: string | null
      message: string
    }
  | {
      ok: false
      reason: 'not_found' | 'error'
      message: string
    }

export async function fetchLeadFromServiceM8(
  leadId: string,
  actorId: string | null,
  options: { request?: ServiceM8FetchRequest } = {},
): Promise<LeadServiceM8FetchResult> {
  const request = options.request ?? createServiceM8RequestFromEnv()
  const [lead] = await db
    .select({
      id: leads.id,
      tier: leads.tier,
      servicem8JobUuid: leads.servicem8JobUuid,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1)

  if (!lead) {
    return { ok: false, reason: 'error', message: 'Lead not found' }
  }

  // Already-linked leads (e.g. imported) have no "RGTools Lead" tag in ServiceM8 descriptions,
  // so skip the description search and refresh directly by the known UUID.
  const matchingJob = lead.servicem8JobUuid
    ? await fetchJobByUuid(request, lead.servicem8JobUuid)
    : await findMatchingJob(request, `RGTools Lead ${leadId}`, lead.createdAt)

  if (!matchingJob?.uuid) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'No matching job found in ServiceM8 yet',
    }
  }

  const wasAlreadyLinked = Boolean(lead.servicem8JobUuid)
  const leadsQuality = `Leads Quality ${lead.tier ?? 'D'}`
  const jobNumber = matchingJob.generated_job_id ?? null
  const jobStatus = matchingJob.status ?? null
  let customFieldUpdated = false
  let customFieldError: string | undefined

  if (!wasAlreadyLinked) {
    try {
      await setLeadsQualityCustomField(request, matchingJob.uuid, leadsQuality)
      customFieldUpdated = true
    } catch (error) {
      customFieldError = error instanceof Error ? error.message : String(error)
    }
  }

  await db
    .update(leads)
    .set({
      servicem8JobUuid: matchingJob.uuid,
      servicem8JobNumber: jobNumber,
      servicem8Status: jobStatus,
      syncStatus: 'synced',
      syncError: null,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId))

  await logAudit({
    actorId: actorId ?? null,
    entityType: 'lead',
    action: 'lead.servicem8_fetch',
    targetId: leadId,
    before: null,
    after: {
      jobUuid: matchingJob.uuid,
      jobStatus,
      leadsQuality,
      customFieldUpdated,
      customFieldError,
    },
  })

  return {
    ok: true,
    jobUuid: matchingJob.uuid,
    jobNumber,
    jobStatus,
    leadsQuality,
    customFieldUpdated,
    customFieldError,
  }
}

export async function linkLeadToServiceM8JobByNumber(
  leadId: string,
  jobNumber: string,
  actorId: string | null,
  options: { request?: ServiceM8FetchRequest } = {},
): Promise<LeadServiceM8ManualLinkResult> {
  const request = options.request ?? createServiceM8RequestFromEnv()
  const normalizedJobNumber = jobNumber.trim().toUpperCase()
  const normalizedLeadIdentifier = leadId.trim().toUpperCase()

  if (!normalizedJobNumber) {
    return { ok: false, reason: 'error', message: 'Enter a ServiceM8 job number' }
  }

  const [leadById] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1)

  const [leadByJobNumber] = leadById ? [] : await db
    .select({ id: leads.id })
    .from(leads)
    .where(or(
      eq(leads.servicem8JobNumber, normalizedLeadIdentifier),
      eq(leads.externalRef, normalizedLeadIdentifier),
    ))
    .limit(1)

  const lead = leadById ?? leadByJobNumber

  if (!lead) {
    return { ok: false, reason: 'error', message: 'Lead not found' }
  }

  const jobUuid = await resolveJobUuid({ jobNumber: normalizedJobNumber }, request)
  if (!jobUuid) {
    return {
      ok: false,
      reason: 'not_found',
      message: `No ServiceM8 job found with number ${normalizedJobNumber}`,
    }
  }

  const job = await fetchJobByUuid(request, jobUuid)
  if (!job?.uuid) {
    return {
      ok: false,
      reason: 'not_found',
      message: `No ServiceM8 job found with number ${normalizedJobNumber}`,
    }
  }

  const resolvedJobNumber = job.generated_job_id ?? normalizedJobNumber
  const jobStatus = job.status ?? null

  await db
    .update(leads)
    .set({
      servicem8JobUuid: job.uuid,
      servicem8JobNumber: resolvedJobNumber,
      servicem8Status: jobStatus,
      syncStatus: 'synced',
      syncError: null,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, lead.id))

  await logAudit({
    actorId: actorId ?? null,
    entityType: 'lead',
    action: 'lead.servicem8_manual_link',
    targetId: lead.id,
    before: null,
    after: {
      jobUuid: job.uuid,
      jobNumber: resolvedJobNumber,
      jobStatus,
    },
  })

  return {
    ok: true,
    jobUuid: job.uuid,
    jobNumber: resolvedJobNumber,
    jobStatus,
    message: `Linked to job ${resolvedJobNumber}${jobStatus ? ` (${jobStatus})` : ''}`,
  }
}

async function fetchJobByUuid(
  request: ServiceM8FetchRequest,
  jobUuid: string,
): Promise<ServiceM8Job | undefined> {
  const response = await request(`/job/${jobUuid}.json`)
  if (!response.ok) return undefined
  const job = await response.json()
  if (!job || typeof job !== 'object') return undefined
  return job as ServiceM8Job
}

async function findMatchingJob(
  request: ServiceM8FetchRequest,
  reference: string,
  leadCreatedAt: Date,
): Promise<ServiceM8Job | undefined> {
  // One-day margin guards against timezone skew between Neon and ServiceM8 job dates.
  const sinceDate = new Date(leadCreatedAt.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const filter = encodeURIComponent(`date gt '${sinceDate}'`)
  const jobsResponse = await request(`/job.json?%24filter=${filter}`)
  if (!jobsResponse.ok) {
    throw new Error(`ServiceM8 job search failed with HTTP ${jobsResponse.status}`)
  }

  const jobs = await jobsResponse.json()
  const matchingJob = Array.isArray(jobs)
    ? jobs.find((job): job is ServiceM8Job => {
        if (!job || typeof job !== 'object') return false
        const candidate = job as ServiceM8Job
        return Boolean(
          candidate.uuid &&
          candidate.job_description?.includes(reference),
        )
      })
    : undefined

  return matchingJob ?? findMatchingInboxJob(request, reference)
}

async function findMatchingInboxJob(
  request: ServiceM8FetchRequest,
  reference: string,
): Promise<ServiceM8Job | undefined> {
  const inboxResponse = await request('/inboxmessage.json?limit=500&offset=0&filter=all')
  if (!inboxResponse.ok) {
    throw new Error(`ServiceM8 inbox search failed with HTTP ${inboxResponse.status}`)
  }

  const inboxPayload = await inboxResponse.json()
  const messages = inboxPayload && typeof inboxPayload === 'object' && 'messages' in inboxPayload
    ? (inboxPayload as { messages?: unknown }).messages
    : undefined

  if (!Array.isArray(messages)) return undefined

  const matchingMessage = messages.find((message): message is ServiceM8InboxMessage => {
    if (!message || typeof message !== 'object') return false
    const candidate = message as ServiceM8InboxMessage
    return Boolean(
      candidate.converted_to_job_uuid &&
      (
        candidate.message_text?.includes(reference) ||
        candidate.message_html?.includes(reference) ||
        candidate.subject?.includes(reference)
      ),
    )
  })

  if (!matchingMessage?.converted_to_job_uuid) return undefined

  const jobResponse = await request(`/job/${matchingMessage.converted_to_job_uuid}.json`)
  if (!jobResponse.ok) {
    throw new Error(`ServiceM8 job retrieve failed with HTTP ${jobResponse.status}`)
  }

  const job = await jobResponse.json()
  if (!job || typeof job !== 'object') return undefined
  return job as ServiceM8Job
}

async function setLeadsQualityCustomField(
  request: ServiceM8FetchRequest,
  jobUuid: string,
  value: string,
) {
  const customFieldUuid = process.env.SERVICEM8_LEAD_QUALITY_FIELD?.trim()
  if (!customFieldUuid) throw new Error('SERVICEM8_LEAD_QUALITY_FIELD is not configured')

  const response = await request(`/job/${jobUuid}.json`, {
    method: 'POST',
    body: JSON.stringify({
      [customFieldUuid]: value,
    }),
  })

  if (!response.ok) {
    throw new Error(`ServiceM8 custom field update failed with HTTP ${response.status}`)
  }
}
