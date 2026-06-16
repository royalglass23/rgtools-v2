// Shared ServiceM8 REST client.
//
// Centralises auth + base-URL handling so both the leads and quote-tracker
// modules talk to ServiceM8 the same way. The `X-API-Key` (static account key)
// can read jobs/companies/attachments and download attachment files, which is
// all the quote-pull flow needs. On-demand document generation
// (`platform_produce_document`) requires an OAuth app with the `manage_jobs`
// scope and is intentionally NOT implemented here (see plan, Phase 2).

const SERVICEM8_BASE = 'https://api.servicem8.com/api_1.0'

export type ServiceM8JsonResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

export type ServiceM8FetchRequest = (
  path: string,
  init?: RequestInit,
) => Promise<ServiceM8JsonResponse>

export function getServiceM8ApiKey(): string {
  const apiKey = process.env.SERVICEM8_API_KEY?.trim()
  if (!apiKey) throw new Error('SERVICEM8_API_KEY is not configured')
  return apiKey
}

/**
 * JSON request helper bound to the ServiceM8 api_1.0 base path. Uses the
 * `api_1.0` base explicitly to avoid the legacy-endpoint redirect loop.
 */
export function createServiceM8RequestFromEnv(): ServiceM8FetchRequest {
  const apiKey = getServiceM8ApiKey()

  return async (path, init) => {
    const headers = new Headers(init?.headers)
    headers.set('X-API-Key', apiKey)
    headers.set('Accept', 'application/json')
    if (init?.body) headers.set('Content-Type', 'application/json')

    const response = await fetch(`${SERVICEM8_BASE}${path}`, {
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

function odataFilter(expr: string): string {
  return `?%24filter=${encodeURIComponent(expr)}`
}

// NZ GST. ServiceM8 line items (jobmaterial) are stored ex-GST.
const GST_RATE = 0.15

export type QuoteJobMeta = {
  jobUuid: string
  status: string | null
  jobNumber: string | null
  jobDescription: string | null
  /** Quote total incl GST, as a string e.g. "19742.00". Used for the $5k threshold. */
  quoteValue: string | null
  /** Sum of line items, ex-GST. */
  subtotalExGst: number
  /** subtotal × (1 + GST). */
  totalIncGst: number
  jobAddress: string | null
  companyUuid: string | null
  /** Company name, resolved via company_uuid. */
  clientName: string | null
}

type ServiceM8MaterialRecord = {
  price?: string | number | null
  quantity?: string | number | null
  active?: number | string | null
}

/**
 * Sum a job's line items (jobmaterial), ex-GST. This is the real quote subtotal.
 *
 * Only `active=1` rows are counted: ServiceM8 soft-deletes superseded line items
 * (revisions, removed rows) by setting `active=0` rather than deleting them, and
 * those stale rows are NOT on the current quote PDF. Summing every row inflates
 * the value (e.g. R260210 had two active=0 leftovers worth ~$17k from a prior
 * revision). Matching `active=1` reproduces the PDF subtotal exactly.
 */
export async function getJobMaterialsSubtotal(
  jobUuid: string,
  request: ServiceM8FetchRequest = createServiceM8RequestFromEnv(),
): Promise<number> {
  const res = await request(`/jobmaterial.json${odataFilter(`job_uuid eq '${jobUuid}'`)}`)
  if (!res.ok) return 0
  const rows = await res.json()
  if (!Array.isArray(rows)) return 0
  return (rows as ServiceM8MaterialRecord[])
    .filter((m) => String(m.active) === '1')
    .reduce((sum, m) => sum + (Number(m.price) || 0) * (Number(m.quantity) || 0), 0)
}

type ServiceM8JobRecord = {
  uuid?: string
  status?: string | null
  generated_job_id?: string | null
  job_description?: string | null
  total_invoice_amount?: string | null
  job_address?: string | null
  company_uuid?: string | null
  edit_date?: string | null
}

/** Fetch the metadata we store on a tracked quote, resolving the client name. */
export async function getJobQuoteMeta(
  jobUuid: string,
  request: ServiceM8FetchRequest = createServiceM8RequestFromEnv(),
): Promise<QuoteJobMeta> {
  const res = await request(`/job/${jobUuid}.json`)
  if (!res.ok) throw new Error(`ServiceM8 job fetch failed with HTTP ${res.status}`)
  const job = (await res.json()) as ServiceM8JobRecord

  const companyUuid = job.company_uuid ?? null
  let clientName: string | null = null
  if (companyUuid) {
    const companyRes = await request(`/company/${companyUuid}.json`)
    if (companyRes.ok) {
      const company = (await companyRes.json()) as { name?: string | null }
      clientName = company.name ?? null
    }
  }

  // Real quote total = sum of line items + GST. Fall back to total_invoice_amount
  // (set once invoiced) only when there are no line items.
  const subtotalExGst = await getJobMaterialsSubtotal(jobUuid, request)
  const totalIncGst = subtotalExGst > 0
    ? subtotalExGst * (1 + GST_RATE)
    : Number(job.total_invoice_amount ?? 0)

  return {
    jobUuid: job.uuid ?? jobUuid,
    status: job.status ?? null,
    jobNumber: job.generated_job_id ?? null,
    jobDescription: job.job_description ?? null,
    quoteValue: totalIncGst > 0 ? totalIncGst.toFixed(2) : null,
    subtotalExGst,
    totalIncGst,
    jobAddress: job.job_address ?? null,
    companyUuid,
    clientName,
  }
}

type ServiceM8AttachmentRecord = {
  uuid?: string
  attachment_name?: string | null
  attachment_source?: string | null
  file_type?: string | null
  active?: number | string | null
  edit_date?: string | null
}

export type QuoteAttachmentRecord = {
  uuid: string
  name: string | null
  fileType: string | null
  editDate: string | null
}

export type QuoteAttachment = QuoteAttachmentRecord & {
  bytes: ArrayBuffer
}

/**
 * Find a job's current quote PDF attachment record (most recently edited),
 * without downloading it. Returns null when none exists yet.
 */
export async function findQuoteAttachmentRecord(
  jobUuid: string,
  request: ServiceM8FetchRequest = createServiceM8RequestFromEnv(),
): Promise<QuoteAttachmentRecord | null> {
  const res = await request(`/attachment.json${odataFilter(`related_object_uuid eq '${jobUuid}'`)}`)
  if (!res.ok) throw new Error(`ServiceM8 attachment list failed with HTTP ${res.status}`)
  const list = await res.json()
  const rows: ServiceM8AttachmentRecord[] = Array.isArray(list) ? list : []

  const attachment = rows
    .filter((a) =>
      a?.uuid &&
      a.attachment_source === 'QUOTE' &&
      String(a.active) === '1' &&
      String(a.file_type ?? '').toLowerCase().includes('pdf'),
    )
    .sort((a, b) => String(b.edit_date ?? '').localeCompare(String(a.edit_date ?? '')))[0]

  if (!attachment?.uuid) return null
  return {
    uuid: attachment.uuid,
    name: attachment.attachment_name ?? null,
    fileType: attachment.file_type ?? null,
    editDate: attachment.edit_date ?? null,
  }
}

/**
 * Download the raw bytes of an attachment. The `.file` endpoint returns a 302
 * redirect to ServiceM8's CDN; `fetch` follows it by default. Used for the
 * quote PDF the auto-pull flow stores.
 */
export async function downloadAttachmentFile(
  attachmentUuid: string,
  apiKey: string = getServiceM8ApiKey(),
): Promise<ArrayBuffer> {
  const response = await fetch(`${SERVICEM8_BASE}/Attachment/${attachmentUuid}.file`, {
    headers: { 'X-API-Key': apiKey },
    redirect: 'follow',
  })
  if (!response.ok) {
    throw new Error(`ServiceM8 attachment download failed with HTTP ${response.status}`)
  }
  return response.arrayBuffer()
}

/**
 * Find a job's quote PDF (the `QUOTE`-source attachment ServiceM8 creates when
 * staff finalise/send the quote) and download it. Returns null when no quote
 * PDF exists yet. Picks the most recently edited if several are present.
 */
export async function getQuoteAttachmentPdf(
  jobUuid: string,
  request: ServiceM8FetchRequest = createServiceM8RequestFromEnv(),
): Promise<QuoteAttachment | null> {
  const record = await findQuoteAttachmentRecord(jobUuid, request)
  if (!record) return null
  const bytes = await downloadAttachmentFile(record.uuid)
  return { ...record, bytes }
}

/** True when `rec` represents a quote PDF newer than the baseline snapshot. */
function isNewerQuote(
  rec: QuoteAttachmentRecord | null,
  baseline: QuoteAttachmentRecord | null | undefined,
): boolean {
  if (!rec) return false
  if (baseline === undefined) return true // no baseline => any existing quote counts
  if (!baseline) return true // there was no quote at start; any quote now is new
  return rec.uuid !== baseline.uuid || String(rec.editDate ?? '') > String(baseline.editDate ?? '')
}

/**
 * Poll a job until a *newly generated* QUOTE PDF appears, then download it.
 * Pass `baseline` (the quote record captured before watching, possibly null) so
 * a pre-existing/stale quote PDF does NOT trigger — only a fresh generation does.
 * Returns null on timeout.
 */
export async function waitForQuoteAttachmentPdf(
  jobUuid: string,
  request: ServiceM8FetchRequest = createServiceM8RequestFromEnv(),
  opts: {
    intervalMs?: number
    timeoutMs?: number
    onWait?: (elapsedSec: number) => void
    baseline?: QuoteAttachmentRecord | null
  } = {},
): Promise<QuoteAttachment | null> {
  const intervalMs = opts.intervalMs ?? 4000
  const timeoutMs = opts.timeoutMs ?? 180000
  const start = Date.now()
  for (;;) {
    const rec = await findQuoteAttachmentRecord(jobUuid, request)
    if (isNewerQuote(rec, opts.baseline)) {
      const bytes = await downloadAttachmentFile(rec!.uuid)
      return { ...rec!, bytes }
    }
    if (Date.now() - start >= timeoutMs) return null
    opts.onWait?.(Math.floor((Date.now() - start) / 1000))
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

export type ResolveJobOptions = {
  uuid?: string
  /** Human job number (ServiceM8 `generated_job_id`). */
  jobNumber?: string
  /** When true, resolve to the most recently edited job in `Quote` status. */
  latestQuote?: boolean
}

/** Resolve a ServiceM8 job UUID from a uuid, a job number, or "latest quote". */
export async function resolveJobUuid(
  opts: ResolveJobOptions,
  request: ServiceM8FetchRequest = createServiceM8RequestFromEnv(),
): Promise<string | null> {
  if (opts.uuid) return opts.uuid

  if (opts.jobNumber) {
    const res = await request(`/job.json${odataFilter(`generated_job_id eq '${opts.jobNumber}'`)}`)
    if (!res.ok) return null
    const jobs = (await res.json()) as ServiceM8JobRecord[]
    return Array.isArray(jobs) && jobs[0]?.uuid ? jobs[0].uuid : null
  }

  if (opts.latestQuote) {
    const res = await request(`/job.json${odataFilter(`status eq 'Quote'`)}`)
    if (!res.ok) return null
    const jobs = (await res.json()) as ServiceM8JobRecord[]
    if (!Array.isArray(jobs)) return null
    const sorted = [...jobs].sort((a, b) =>
      String(b.edit_date ?? '').localeCompare(String(a.edit_date ?? '')),
    )
    return sorted[0]?.uuid ?? null
  }

  return null
}
