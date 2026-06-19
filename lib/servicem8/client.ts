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

export type LeadServiceM8History = {
  notes: Array<{ date: string | null; text: string }>
  emails: Array<{ date: string | null; subject: string | null; body: string }>
}

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

type ServiceM8JobContactRecord = {
  name?: string | null
  first?: string | null
  last?: string | null
  phone?: string | null
  mobile?: string | null
  email?: string | null
  type?: string | null
  active?: number | string | null
}

type ServiceM8NoteRecord = {
  note?: string | null
  text?: string | null
  body?: string | null
  message?: string | null
  date?: string | null
  create_date?: string | null
  edit_date?: string | null
  timestamp?: string | null
}

type ServiceM8EmailRecord = {
  subject?: string | null
  body?: string | null
  message?: string | null
  message_text?: string | null
  message_html?: string | null
  text?: string | null
  html?: string | null
  date?: string | null
  create_date?: string | null
  edit_date?: string | null
  sent_date?: string | null
  timestamp?: string | null
}

const NOTE_LIMIT = 5
const EMAIL_LIMIT = 3
const NOTE_CHAR_LIMIT = 300
const EMAIL_BODY_CHAR_LIMIT = 800
const HISTORY_CHAR_LIMIT = 3000

export type ServiceM8JobContact = {
  name: string | null
  phone: string | null
  mobile: string | null
  email: string | null
}

type ServiceM8CompanyContactRecord = ServiceM8JobContactRecord & {
  company_uuid?: string | null
}

type ServiceM8CompanyRecord = {
  name?: string | null
  phone?: string | null
  mobile?: string | null
  email?: string | null
}

export async function getJobContact(
  jobUuid: string,
  request: ServiceM8FetchRequest = createServiceM8RequestFromEnv(),
): Promise<ServiceM8JobContact | null> {
  const res = await request(`/jobcontact.json${odataFilter(`job_uuid eq '${jobUuid}'`)}`)
  if (!res.ok) return null
  const contacts = await res.json()
  if (!Array.isArray(contacts)) return null
  return mergeContacts(contacts as ServiceM8JobContactRecord[])
}

export async function getCompanyContact(
  companyUuid: string,
  request: ServiceM8FetchRequest = createServiceM8RequestFromEnv(),
): Promise<ServiceM8JobContact | null> {
  const contactRes = await request(`/companycontact.json${odataFilter(`company_uuid eq '${companyUuid}'`)}`)
  if (contactRes.ok) {
    const contacts = await contactRes.json()
    if (Array.isArray(contacts)) {
      const contact = mergeContacts(contacts as ServiceM8CompanyContactRecord[])
      if (contact) return contact
    }
  }

  const companyRes = await request(`/company/${companyUuid}.json`)
  if (!companyRes.ok) return null
  const company = (await companyRes.json()) as ServiceM8CompanyRecord
  const contact = toContact(company)
  return contact.phone || contact.mobile || contact.email ? contact : null
}

export async function getJobNotesAndEmails(
  jobUuid: string,
  request: ServiceM8FetchRequest = createServiceM8RequestFromEnv(),
): Promise<LeadServiceM8History> {
  const [noteRows, emailRows] = await Promise.all([
    readServiceM8Array<ServiceM8NoteRecord>(
      request,
      `/note.json${odataFilter(`related_object_uuid eq '${jobUuid}'`)}`,
    ),
    readServiceM8Array<ServiceM8EmailRecord>(
      request,
      `/email.json${odataFilter(`related_object_uuid eq '${jobUuid}'`)}`,
    ),
  ])

  return capSerializedHistory({
    notes: newestFirst(noteRows)
      .map((note) => ({
        date: serviceM8Date(note),
        text: truncate(cleanText(note.note ?? note.text ?? note.body ?? note.message ?? ''), NOTE_CHAR_LIMIT),
      }))
      .filter((note) => note.text.length > 0)
      .slice(0, NOTE_LIMIT),
    emails: newestFirst(emailRows)
      .map((email) => ({
        date: serviceM8Date(email),
        subject: cleanText(email.subject ?? '') || null,
        body: truncate(
          stripEmailNoise(
            email.message_text ??
            email.body ??
            email.message ??
            email.text ??
            email.message_html ??
            email.html ??
            '',
          ),
          EMAIL_BODY_CHAR_LIMIT,
        ),
      }))
      .filter((email) => email.subject || email.body.length > 0)
      .slice(0, EMAIL_LIMIT),
  })
}

export function stripEmailNoise(raw: string): string {
  let text = looksLikeHtml(raw) ? htmlToText(raw) : raw
  text = text.replace(/\r\n?/g, '\n')

  const lines = text.split('\n')
  const kept: string[] = []
  for (const line of lines) {
    if (/^\s*>/.test(line)) continue
    if (/^\s*On .+ wrote:\s*$/i.test(line)) break
    if (/^\s*-{2,}\s*Original Message\s*-{2,}\s*$/i.test(line)) break
    kept.push(line)
  }

  const signatureIndex = kept.findIndex((line) =>
    /^\s*--\s*$/.test(line) ||
    /^\s*(kind regards|regards|thanks|cheers)[,!.]?\s*$/i.test(line) ||
    /^\s*sent from my\b/i.test(line),
  )
  const withoutSignature = signatureIndex >= 0 ? kept.slice(0, signatureIndex) : kept

  return collapseWhitespace(withoutSignature.join('\n'))
}

async function readServiceM8Array<T>(
  request: ServiceM8FetchRequest,
  path: string,
): Promise<T[]> {
  try {
    const res = await request(path)
    if (!res.ok) return []
    const rows = await res.json()
    return Array.isArray(rows) ? rows as T[] : []
  } catch {
    return []
  }
}

function newestFirst<T extends { date?: string | null; create_date?: string | null; edit_date?: string | null; sent_date?: string | null; timestamp?: string | null }>(
  rows: T[],
): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const aTime = sortableDate(a.row)
      const bTime = sortableDate(b.row)
      if (aTime != null && bTime != null && aTime !== bTime) return bTime - aTime
      return a.index - b.index
    })
    .map(({ row }) => row)
}

function serviceM8Date(row: {
  date?: string | null
  create_date?: string | null
  edit_date?: string | null
  sent_date?: string | null
  timestamp?: string | null
}): string | null {
  return row.sent_date ?? row.date ?? row.edit_date ?? row.create_date ?? row.timestamp ?? null
}

function sortableDate(row: Parameters<typeof serviceM8Date>[0]): number | null {
  const value = serviceM8Date(row)
  if (!value) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
}

function capSerializedHistory(history: LeadServiceM8History): LeadServiceM8History {
  const next: LeadServiceM8History = {
    notes: [...history.notes],
    emails: [...history.emails],
  }

  while (JSON.stringify(next).length > HISTORY_CHAR_LIMIT && (next.notes.length || next.emails.length)) {
    const oldestNote = next.notes.at(-1)
    const oldestEmail = next.emails.at(-1)
    if (!oldestNote) {
      next.emails.pop()
    } else if (!oldestEmail) {
      next.notes.pop()
    } else if (olderOrSame(oldestNote.date, oldestEmail.date)) {
      next.notes.pop()
    } else {
      next.emails.pop()
    }
  }

  return next
}

function olderOrSame(left: string | null, right: string | null): boolean {
  const leftTime = left ? Date.parse(left) : Number.NEGATIVE_INFINITY
  const rightTime = right ? Date.parse(right) : Number.NEGATIVE_INFINITY
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return true
  return leftTime <= rightTime
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 3).trimEnd()}...`
}

function cleanText(value: string): string {
  return collapseWhitespace(looksLikeHtml(value) ? htmlToText(value) : value)
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function htmlToText(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function contactScore(contact: ServiceM8JobContactRecord): number {
  return Number(isEmail(contact.email)) + Number(isPhone(contact.phone)) + Number(isPhone(contact.mobile))
}

function toContact(contact: ServiceM8JobContactRecord | ServiceM8CompanyRecord): ServiceM8JobContact {
  const name = contact.name ?? ('first' in contact || 'last' in contact
    ? [contact.first, contact.last].filter(Boolean).join(' ')
    : null)

  return {
    name: name?.trim() || null,
    phone: isPhone(contact.phone) ? contact.phone.trim() : null,
    mobile: isPhone(contact.mobile) ? contact.mobile.trim() : null,
    email: isEmail(contact.email) ? contact.email.trim() : null,
  }
}

function mergeContacts(contacts: ServiceM8JobContactRecord[]): ServiceM8JobContact | null {
  const activeContacts = contacts
    .filter((row) => String(row.active ?? '1') !== '0')
    .sort((a, b) => contactPriority(b) - contactPriority(a))
  if (activeContacts.length === 0) return null

  const merged: ServiceM8JobContact = { name: null, phone: null, mobile: null, email: null }
  for (const contact of activeContacts) {
    const normalized = toContact(contact)
    merged.name ??= normalized.name
    merged.email ??= normalized.email
    merged.phone ??= normalized.phone
    merged.mobile ??= normalized.mobile
  }

  return merged.name || merged.phone || merged.mobile || merged.email ? merged : null
}

function contactPriority(contact: ServiceM8JobContactRecord): number {
  const typeBonus = String(contact.type ?? '').toUpperCase() === 'JOB' ? 10 : 0
  return typeBonus + contactScore(contact)
}

function isEmail(value: string | null | undefined): value is string {
  return Boolean(value?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
}

function isPhone(value: string | null | undefined): value is string {
  const trimmed = value?.trim() ?? ''
  return !/^https?:\/\//i.test(trimmed) && /\d{5,}/.test(trimmed.replace(/\D/g, ''))
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
