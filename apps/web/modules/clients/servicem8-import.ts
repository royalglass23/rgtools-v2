import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { createServiceM8RequestFromEnv, type ServiceM8FetchRequest } from '@/lib/servicem8/client'
import { clients } from '@rgtools/db/schema-leads'
import {
  buildClientIdentityUpsert,
  type ClientCanonicalSource,
  type ClientReviewStatus,
} from './client-identity'

export type ServiceM8CompanyImportRecord = {
  uuid?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  mobile?: string | null
  active?: number | string | boolean | null
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

export type ClientImportDeps = {
  now: () => Date
  findByServiceM8Uuid: (uuid: string) => Promise<ExistingImportedClient | null>
  createClient: (values: ClientImportValues) => Promise<{ id: string; reviewStatus: ClientReviewStatus }>
  updateClient: (id: string, values: ClientImportValues) => Promise<{ id: string; reviewStatus: ClientReviewStatus }>
}

export type ServiceM8ClientImportSummary = {
  scanned: number
  created: number
  sourceUpdated: number
  needsReview: number
  skipped: number
  errors: number
  errorMessages: string[]
}

export async function refreshServiceM8Clients(
  request: ServiceM8FetchRequest = createServiceM8RequestFromEnv(),
): Promise<ServiceM8ClientImportSummary> {
  const rows = await readServiceM8Array<ServiceM8CompanyImportRecord>(request, '/company.json')
  return importServiceM8CompaniesFromRows(rows, createDbImportDeps())
}

export async function importServiceM8CompaniesFromRows(
  rows: ServiceM8CompanyImportRecord[],
  deps: ClientImportDeps,
): Promise<ServiceM8ClientImportSummary> {
  const summary: ServiceM8ClientImportSummary = {
    scanned: rows.length,
    created: 0,
    sourceUpdated: 0,
    needsReview: 0,
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
      const values = buildClientIdentityUpsert({
        existing,
        source: {
          servicem8CompanyUuid: uuid,
          clientName: name,
          companyName: name,
          phone: clean(row.mobile) ?? clean(row.phone),
          email: clean(row.email),
          sourceSnapshot: row,
          syncedAt: syncDate(row.edit_date) ?? deps.now(),
        },
        now: deps.now(),
      })

      if (existing) {
        const updated = await deps.updateClient(existing.id, values)
        summary.sourceUpdated += 1
        if (updated.reviewStatus === 'pending_review') summary.needsReview += 1
      } else {
        const created = await deps.createClient(values)
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
  }
}

async function readServiceM8Array<T>(request: ServiceM8FetchRequest, path: string): Promise<T[]> {
  const res = await request(path)
  if (!res.ok) throw new Error(`ServiceM8 request failed with HTTP ${res.status}`)
  const rows = await res.json()
  return Array.isArray(rows) ? rows as T[] : []
}

function isActive(value: ServiceM8CompanyImportRecord['active']) {
  return value === undefined || value === null || value === true || value === 1 || value === '1'
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function syncDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
