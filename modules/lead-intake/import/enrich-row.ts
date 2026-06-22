import {
  getCompanyContact,
  getJobContact,
  getJobQuoteMeta,
  resolveJobUuid,
  ServiceM8RateLimitError,
  type ServiceM8FetchRequest,
} from '@/lib/servicem8/client'
import type { LeadImportRow } from './types'

const CLOSED_STATUSES = new Set(['completed', 'complete', 'closed'])

const CATEGORY_RULES: Array<{ label: string; keywords: string[] }> = [
  { label: 'Pool Fencing', keywords: ['pool fence', 'pool fencing', 'pool gate', 'pool'] },
  { label: 'Showers', keywords: ['shower', 'frameless shower'] },
  { label: 'Splashbacks', keywords: ['splashback', 'splash back'] },
  { label: 'Partitions', keywords: ['partition', 'office glass', 'screen'] },
  { label: 'Mirrors', keywords: ['mirror'] },
  { label: 'Balustrades', keywords: ['balustrade', 'handrail', 'stairs', 'stair'] },
  { label: 'Aluminium', keywords: ['aluminium', 'aluminum', 'joinery'] },
]

const INTER_ROW_DELAY_MS = 200

export async function enrichImportRows(
  rows: LeadImportRow[],
  request?: ServiceM8FetchRequest,
): Promise<LeadImportRow[]> {
  const enriched: LeadImportRow[] = []
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) await sleep(INTER_ROW_DELAY_MS)
    enriched.push(await enrichImportRow(rows[i], request))
  }
  return enriched
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function enrichImportRow(
  row: LeadImportRow,
  request?: ServiceM8FetchRequest,
): Promise<LeadImportRow> {
  try {
    if (!row.jobNumber) {
      return withContactFlag({
        ...row,
        input: { ...row.input, projectType: 'Other' },
        servicem8JobNumber: null,
        enrichmentMessage: 'Missing Job Number.',
      })
    }

    const jobUuid = await resolveJobUuid({ jobNumber: row.jobNumber }, request)
    if (!jobUuid) {
      return withContactFlag({
        ...row,
        input: { ...row.input, projectType: 'Other' },
        servicem8JobNumber: row.jobNumber || null,
        enrichmentMessage: `Job Number ${row.jobNumber} was not found in ServiceM8.`,
      })
    }

    const [meta, jobContact] = await Promise.all([
      getJobQuoteMeta(jobUuid, request),
      getJobContact(jobUuid, request),
    ])
    const contact = hasContactDetail(jobContact)
      ? jobContact
      : meta.companyUuid
        ? await getCompanyContact(meta.companyUuid, request)
        : null

    const phone = row.input.phone || contact?.mobile || contact?.phone || ''
    const email = row.input.email || contact?.email || ''
    const next: LeadImportRow = {
      ...row,
      input: {
        ...row.input,
        clientName: row.input.clientName || meta.clientName || contact?.name || '',
        companyName: row.input.companyName || meta.clientName || '',
        phone,
        email,
        location: row.input.location || meta.jobAddress || '',
        projectType: deriveProjectType(meta.jobDescription),
      },
      enriched: true,
      notEnriched: false,
      servicem8JobUuid: meta.jobUuid,
      servicem8JobNumber: meta.jobNumber ?? (row.jobNumber || null),
      servicem8Status: meta.status,
      autoSkip: isClosedStatus(meta.status),
      enrichmentMessage: null,
    }
    const flagged = withContactFlag(next)
    return {
      ...flagged,
      enrichmentMessage: flagged.needsContact
        ? 'Job found, but ServiceM8 has no phone/email on the job contact or linked company.'
        : null,
    }
  } catch (error) {
    const enrichmentMessage = error instanceof ServiceM8RateLimitError
      ? "ServiceM8 was busy / rate-limited and couldn't enrich this row. Re-run Upload and review to retry."
      : error instanceof Error
        ? `ServiceM8 lookup failed: ${error.message}`
        : 'ServiceM8 lookup failed.'

    return withContactFlag({
      ...row,
      input: { ...row.input, projectType: 'Other' },
      enriched: false,
      notEnriched: true,
      servicem8JobNumber: row.jobNumber || null,
      enrichmentMessage,
    })
  }
}

export function deriveProjectType(description: string | null | undefined): string {
  const text = description?.toLowerCase() ?? ''
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) return rule.label
  }
  return 'Other'
}

function isClosedStatus(status: string | null): boolean {
  return CLOSED_STATUSES.has(String(status ?? '').trim().toLowerCase())
}

function hasContactDetail(contact: { phone: string | null; mobile: string | null; email: string | null } | null): boolean {
  return Boolean(contact?.phone || contact?.mobile || contact?.email)
}

function withContactFlag(row: LeadImportRow): LeadImportRow {
  return {
    ...row,
    needsContact: !row.input.phone?.trim() && !row.input.email?.trim(),
  }
}
