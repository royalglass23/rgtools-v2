import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLog } from '@/drizzle/schema'
import { leads } from '@/drizzle/schema-leads'

type ServiceM8JsonResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

export type ServiceM8FetchRequest = (
  path: string,
  init?: RequestInit,
) => Promise<ServiceM8JsonResponse>

type ServiceM8Job = {
  uuid?: string
  job_description?: string
  status?: string
}

export type LeadServiceM8FetchResult =
  | {
      ok: true
      jobUuid: string
      jobStatus: string | null
      leadsQuality: string
      customFieldUpdated: boolean
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
    })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1)

  if (!lead) {
    return { ok: false, reason: 'error', message: 'Lead not found' }
  }

  const jobsResponse = await request('/job.json')
  if (!jobsResponse.ok) {
    return {
      ok: false,
      reason: 'error',
      message: `ServiceM8 job search failed with HTTP ${jobsResponse.status}`,
    }
  }

  const jobs = await jobsResponse.json()
  const matchingJob = Array.isArray(jobs)
    ? jobs.find((job): job is ServiceM8Job => {
        if (!job || typeof job !== 'object') return false
        const candidate = job as ServiceM8Job
        return Boolean(
          candidate.uuid &&
          candidate.job_description?.includes(`RGTools Lead ${leadId}`),
        )
      })
    : undefined

  if (!matchingJob?.uuid) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'No matching job found in ServiceM8 yet',
    }
  }

  const wasAlreadyLinked = Boolean(lead.servicem8JobUuid)
  const leadsQuality = `Leads Quality ${lead.tier ?? 'D'}`
  const jobStatus = matchingJob.status ?? null

  if (!wasAlreadyLinked) {
    await setLeadsQualityCustomField(request, matchingJob.uuid, leadsQuality)
  }

  await db
    .update(leads)
    .set({
      servicem8JobUuid: matchingJob.uuid,
      servicem8Status: jobStatus,
      syncStatus: 'synced',
      syncError: null,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId))

  await db.insert(auditLog).values({
    actorId: actorId ?? null,
    action: 'lead.servicem8_fetch',
    targetId: leadId,
    detail: {
      jobUuid: matchingJob.uuid,
      jobStatus,
      leadsQuality,
      customFieldUpdated: !wasAlreadyLinked,
    },
  })

  return {
    ok: true,
    jobUuid: matchingJob.uuid,
    jobStatus,
    leadsQuality,
    customFieldUpdated: !wasAlreadyLinked,
  }
}

export function createServiceM8RequestFromEnv(): ServiceM8FetchRequest {
  const apiKey = process.env.SERVICEM8_API_KEY?.trim()
  if (!apiKey) throw new Error('SERVICEM8_API_KEY is not configured')

  return async (path, init) => {
    const headers = new Headers(init?.headers)
    headers.set('X-API-Key', apiKey)
    headers.set('Accept', 'application/json')
    if (init?.body) headers.set('Content-Type', 'application/json')

    const response = await fetch(`https://api.servicem8.com/api_1.0${path}`, {
      ...init,
      headers,
    })

    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json(),
    }
  }
}

async function setLeadsQualityCustomField(
  request: ServiceM8FetchRequest,
  jobUuid: string,
  value: string,
) {
  const customFieldUuid = process.env.SERVICEM8_LEAD_QUALITY_FIELD?.trim()
  if (!customFieldUuid) throw new Error('SERVICEM8_LEAD_QUALITY_FIELD is not configured')

  const response = await request('/JobCustomFieldData.json', {
    method: 'POST',
    body: JSON.stringify({
      related_object_uuid: jobUuid,
      job_custom_field_uuid: customFieldUuid,
      value,
    }),
  })

  if (!response.ok) {
    throw new Error(`ServiceM8 custom field update failed with HTTP ${response.status}`)
  }
}
