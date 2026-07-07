import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  createServiceM8RequestFromEnv,
  getCompanyContact,
  getJobContact,
  type ServiceM8FetchRequest,
  type ServiceM8JobContact,
} from '@/lib/servicem8/client'
import { clientContacts, clients } from '@rgtools/db/schema-leads'
import {
  buildClientIdentityUpsert,
  type ClientCanonicalSource,
  type ClientReviewStatus,
} from './client-identity'
import { addClientAliases, collectClientAliases, type ClientAliasSource } from './client-aliases'

export const SERVICE_M8_CLIENT_REFRESH_LIMIT = 20

export type ServiceM8CompanyImportRecord = {
  uuid?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  mobile?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  contactMobile?: string | null
  active?: number | string | boolean | null
  edit_date?: string | null
  eligibleJobStatuses?: string[]
  eligibleJobUuids?: string[]
}

export type ServiceM8ClientImportJobRecord = {
  uuid?: string | null
  active?: number | string | boolean | null
  status?: string | null
  company_uuid?: string | null
  edit_date?: string | null
}

export type ExistingImportedClient = {
  id: string
  name: string
  companyName: string | null
  email: string | null
  phone: string | null
  phoneNormalized: string | null
  reviewStatus: ClientReviewStatus
  canonicalSource: ClientCanonicalSource
  canonicalUpdatedAt: Date
}

export type ClientImportValues = ReturnType<typeof buildClientIdentityUpsert>
export type ClientImportContact = {
  name: string | null
  email: string | null
  phone: string | null
}

export type ClientImportDeps = {
  now: () => Date
  findByServiceM8Uuid: (uuid: string) => Promise<ExistingImportedClient | null>
  createClient: (values: ClientImportValues) => Promise<{ id: string; reviewStatus: ClientReviewStatus }>
  updateClient: (id: string, values: ClientImportValues) => Promise<{ id: string; reviewStatus: ClientReviewStatus }>
  addClientAliases: (clientId: string, aliases: string[], source: ClientAliasSource) => Promise<void>
  upsertPrimaryContact: (clientId: string, contact: ClientImportContact) => Promise<void>
}

export type ServiceM8ClientImportSummary = {
  batchLimit: number | null
  scanned: number
  created: number
  sourceUpdated: number
  needsReview: number
  contactsFound: number
  contactsMissing: number
  skipped: number
  errors: number
  errorMessages: string[]
}

export async function refreshServiceM8Clients(
  request: ServiceM8FetchRequest = createServiceM8RequestFromEnv(),
): Promise<ServiceM8ClientImportSummary> {
  const rows = await readServiceM8ClientImportRecords(request, { limit: SERVICE_M8_CLIENT_REFRESH_LIMIT })
  return importServiceM8CompaniesFromRows(rows, createDbImportDeps(), { batchLimit: SERVICE_M8_CLIENT_REFRESH_LIMIT })
}

export async function readServiceM8ClientImportRecords(
  request: ServiceM8FetchRequest,
  options: { limit?: number } = {},
): Promise<ServiceM8CompanyImportRecord[]> {
  const limit = normalizeLimit(options.limit)
  const jobs = (await readServiceM8Array<ServiceM8ClientImportJobRecord>(
    request,
    `/job.json${odataQuery({
      filter: "active eq 1 and (status eq 'Work Order' or status eq 'Completed')",
      top: limit,
    })}`,
  )).filter(isEligibleClientImportJob)

  const jobsByCompanyUuid = new Map<string, ServiceM8ClientImportJobRecord[]>()
  for (const job of jobs) {
    const companyUuid = clean(job.company_uuid)
    if (!companyUuid) continue
    jobsByCompanyUuid.set(companyUuid, [...(jobsByCompanyUuid.get(companyUuid) ?? []), job])
  }

  const companyEntries = [...jobsByCompanyUuid.entries()].slice(0, limit ?? undefined)

  return Promise.all(companyEntries.map(async ([companyUuid, companyJobs]) => {
    const company = await readServiceM8Object<ServiceM8CompanyImportRecord>(request, `/company/${companyUuid}.json`)
    const contact = await bestContactForCompanyJobs(companyUuid, companyJobs, request)
    const contactPhone = contact?.mobile ?? contact?.phone ?? null

    return {
      ...company,
      uuid: clean(company.uuid) ?? companyUuid,
      email: contact?.email ?? company.email ?? null,
      phone: contactPhone ?? company.phone ?? null,
      mobile: contact?.mobile ?? company.mobile ?? null,
      contactName: contact?.name ?? null,
      contactEmail: contact?.email ?? null,
      contactPhone: contact?.phone ?? null,
      contactMobile: contact?.mobile ?? null,
      eligibleJobStatuses: [...new Set(companyJobs.map((job) => clean(job.status)).filter((status): status is string => Boolean(status)))],
      eligibleJobUuids: companyJobs.map((job) => clean(job.uuid)).filter((uuid): uuid is string => Boolean(uuid)),
    }
  }))
}

export async function importServiceM8CompaniesFromRows(
  rows: ServiceM8CompanyImportRecord[],
  deps: ClientImportDeps,
  options: { batchLimit?: number | null } = {},
): Promise<ServiceM8ClientImportSummary> {
  const contactsFound = rows.filter(hasImportContactDetails).length
  const summary: ServiceM8ClientImportSummary = {
    batchLimit: options.batchLimit ?? null,
    scanned: rows.length,
    created: 0,
    sourceUpdated: 0,
    needsReview: 0,
    contactsFound,
    contactsMissing: rows.length - contactsFound,
    skipped: 0,
    errors: 0,
    errorMessages: [],
  }

  for (const row of rows) {
    const uuid = clean(row.uuid)
    const name = clean(row.name)
    if (!uuid || !name || !isActive(row.active)) {
      summary.skipped += 1
      continue
    }

    try {
      const existing = await deps.findByServiceM8Uuid(uuid)
      const contact = importContact(row)
      const values = buildClientIdentityUpsert({
        existing,
        source: {
          servicem8CompanyUuid: uuid,
          clientName: name,
          companyName: name,
          phone: contact.phone ?? clean(row.mobile) ?? clean(row.phone),
          email: contact.email ?? clean(row.email),
          sourceSnapshot: row,
          syncedAt: syncDate(row.edit_date) ?? deps.now(),
        },
        now: deps.now(),
      })

      if (existing) {
        const updated = await deps.updateClient(existing.id, values)
        await deps.addClientAliases(existing.id, importAliases(existing, values), 'servicem8_import')
        await deps.upsertPrimaryContact(existing.id, contact)
        summary.sourceUpdated += 1
        if (updated.reviewStatus === 'pending_review') summary.needsReview += 1
      } else {
        const created = await deps.createClient(values)
        await deps.addClientAliases(created.id, importAliases(null, values), 'servicem8_import')
        await deps.upsertPrimaryContact(created.id, contact)
        summary.created += 1
        if (created.reviewStatus === 'pending_review') summary.needsReview += 1
      }
    } catch (error) {
      summary.errors += 1
      summary.errorMessages.push(`${uuid}: ${errorMessage(error)}`)
    }
  }

  return summary
}

function createDbImportDeps(): ClientImportDeps {
  return {
    now: () => new Date(),
    findByServiceM8Uuid: async (uuid) => {
      const [row] = await db
        .select({
          id: clients.id,
          name: clients.name,
          companyName: clients.companyName,
          email: clients.email,
          phone: clients.phone,
          phoneNormalized: clients.phoneNormalized,
          reviewStatus: clients.reviewStatus,
          canonicalSource: clients.canonicalSource,
          canonicalUpdatedAt: clients.canonicalUpdatedAt,
        })
        .from(clients)
        .where(eq(clients.servicem8CompanyUuid, uuid))
        .limit(1)

      return row ?? null
    },
    createClient: async (values) => {
      const [created] = await db
        .insert(clients)
        .values(values)
        .returning({ id: clients.id, reviewStatus: clients.reviewStatus })

      return created
    },
    updateClient: async (id, values) => {
      const [updated] = await db
        .update(clients)
        .set(values)
        .where(eq(clients.id, id))
        .returning({ id: clients.id, reviewStatus: clients.reviewStatus })

      return updated
    },
    addClientAliases,
    upsertPrimaryContact: async (clientId, contact) => {
      if (!contact.name && !contact.email && !contact.phone) return

      const [existingContact] = await db
        .select({ id: clientContacts.id })
        .from(clientContacts)
        .where(eq(clientContacts.clientId, clientId))
        .orderBy(clientContacts.createdAt)
        .limit(1)

      if (existingContact) {
        await db
          .update(clientContacts)
          .set({ ...contact, updatedAt: new Date() })
          .where(eq(clientContacts.id, existingContact.id))
      } else {
        await db
          .insert(clientContacts)
          .values({ clientId, ...contact })
      }
    },
  }
}

function importAliases(existing: ExistingImportedClient | null, values: ClientImportValues): string[] {
  return collectClientAliases([
    existing?.name,
    existing?.companyName,
    values.name,
    values.companyName,
    values.servicem8Name,
    values.servicem8CompanyName,
  ])
}

async function readServiceM8Array<T>(request: ServiceM8FetchRequest, path: string): Promise<T[]> {
  const res = await request(path)
  if (!res.ok) throw new Error(`ServiceM8 request failed with HTTP ${res.status}`)
  const rows = await res.json()
  return Array.isArray(rows) ? rows as T[] : []
}

async function readServiceM8Object<T>(request: ServiceM8FetchRequest, path: string): Promise<T> {
  const res = await request(path)
  if (!res.ok) throw new Error(`ServiceM8 request failed with HTTP ${res.status}`)
  const row = await res.json()
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error('ServiceM8 returned an unexpected object response')
  }
  return row as T
}

async function bestContactForCompanyJobs(
  companyUuid: string,
  jobs: ServiceM8ClientImportJobRecord[],
  request: ServiceM8FetchRequest,
): Promise<ServiceM8JobContact | null> {
  for (const job of jobs) {
    const jobUuid = clean(job.uuid)
    if (!jobUuid) continue
    const contact = await getJobContact(jobUuid, request)
    if (contact?.name || contact?.email || contact?.phone || contact?.mobile) return contact
  }

  return getCompanyContact(companyUuid, request)
}

function isActive(value: ServiceM8CompanyImportRecord['active']) {
  return value === undefined || value === null || value === true || value === 1 || value === '1'
}

function isEligibleClientImportJob(job: ServiceM8ClientImportJobRecord): boolean {
  const status = normalizeStatus(job.status)
  return isActive(job.active) && Boolean(clean(job.company_uuid)) && (status === 'work order' || status === 'completed')
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function importContact(row: ServiceM8CompanyImportRecord): ClientImportContact {
  return {
    name: clean(row.contactName),
    email: clean(row.contactEmail) ?? clean(row.email),
    phone: clean(row.contactMobile) ?? clean(row.contactPhone) ?? clean(row.mobile) ?? clean(row.phone),
  }
}

function hasImportContactDetails(row: ServiceM8CompanyImportRecord): boolean {
  const contact = importContact(row)
  return Boolean(contact.name || contact.email || contact.phone)
}

function normalizeStatus(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? ''
}

function normalizeLimit(value: number | undefined): number | null {
  if (value === undefined) return null
  if (!Number.isFinite(value)) return null
  const normalized = Math.floor(value)
  return normalized > 0 ? normalized : null
}

function odataQuery(options: { filter: string; top?: number | null }): string {
  const params = [`%24filter=${encodeURIComponent(options.filter)}`]
  if (options.top) params.push(`%24top=${options.top}`)
  return `?${params.join('&')}`
}

function syncDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
