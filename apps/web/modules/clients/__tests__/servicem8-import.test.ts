import { describe, expect, it, vi } from 'vitest'
import {
  importServiceM8CompaniesFromRows,
  readServiceM8ClientImportRecords,
  type ClientImportDeps,
  type ExistingImportedClient,
  type ServiceM8CompanyImportRecord,
} from '../servicem8-import'

const now = new Date('2026-07-07T12:00:00.000Z')

function company(overrides: Partial<ServiceM8CompanyImportRecord> & { uuid?: string | null; name?: string | null }) {
  return {
    uuid: overrides.uuid,
    name: overrides.name,
    email: overrides.email ?? null,
    phone: overrides.phone ?? null,
    mobile: overrides.mobile ?? null,
    contactName: overrides.contactName ?? null,
    contactEmail: overrides.contactEmail ?? null,
    contactPhone: overrides.contactPhone ?? null,
    contactMobile: overrides.contactMobile ?? null,
    active: overrides.active ?? 1,
    edit_date: overrides.edit_date ?? '2026-07-07 11:00:00',
  } satisfies ServiceM8CompanyImportRecord
}

function deps(existingByUuid: Record<string, ExistingImportedClient | null> = {}) {
  const created: unknown[] = []
  const updated: Array<{ id: string; values: unknown }> = []
  const aliases: Array<{ clientId: string; aliases: string[]; source: string }> = []
  const contacts: Array<{ clientId: string; name: string | null; email: string | null; phone: string | null }> = []
  const testDeps: ClientImportDeps = {
    now: () => now,
    findByServiceM8Uuid: vi.fn(async (uuid) => existingByUuid[uuid] ?? null),
    createClient: vi.fn(async (values) => {
      created.push(values)
      return { id: `created-${created.length}`, reviewStatus: 'pending_review' as const }
    }),
    updateClient: vi.fn(async (id, values) => {
      updated.push({ id, values })
      return { id, reviewStatus: existingByUuid[(values as { servicem8CompanyUuid: string }).servicem8CompanyUuid]?.reviewStatus ?? 'pending_review' as const }
    }),
    addClientAliases: vi.fn(async (clientId, aliasesToAdd, source) => {
      aliases.push({ clientId, aliases: aliasesToAdd, source })
    }),
    upsertPrimaryContact: vi.fn(async (clientId, contact) => {
      contacts.push({ clientId, ...contact })
    }),
  }

  return { deps: testDeps, created, updated, aliases, contacts }
}

describe('importServiceM8CompaniesFromRows', () => {
  it('creates visible Clients from active ServiceM8 companies and reports review counts', async () => {
    const { deps: testDeps, created, aliases, contacts } = deps()

    const summary = await importServiceM8CompaniesFromRows([
      company({ uuid: 'company-1', name: 'Top View Construction', email: 'office@topview.test', phone: '09 111 1111' }),
    ], testDeps)

    expect(summary).toEqual({
      scanned: 1,
      created: 1,
      sourceUpdated: 0,
      needsReview: 1,
      skipped: 0,
      errors: 0,
      errorMessages: [],
    })
    expect(created[0]).toMatchObject({
      servicem8CompanyUuid: 'company-1',
      name: 'Top View Construction',
      companyName: 'Top View Construction',
      email: 'office@topview.test',
      phone: '09 111 1111',
      reviewStatus: 'pending_review',
      servicem8SourceSnapshot: expect.objectContaining({ uuid: 'company-1', name: 'Top View Construction' }),
    })
    expect(aliases).toEqual([
      { clientId: 'created-1', aliases: ['Top View Construction'], source: 'servicem8_import' },
    ])
    expect(contacts).toEqual([
      { clientId: 'created-1', name: null, email: 'office@topview.test', phone: '09 111 1111' },
    ])
  })

  it('prefers explicit ServiceM8 contact person details for client email, phone, and primary contact', async () => {
    const { deps: testDeps, created, contacts } = deps()

    const summary = await importServiceM8CompaniesFromRows([
      company({
        uuid: 'company-1',
        name: 'Top View Construction',
        email: 'accounts@topview.test',
        phone: '09 111 1111',
        contactName: 'Mia Builder',
        contactEmail: 'mia@topview.test',
        contactMobile: '021 222 2222',
      }),
    ], testDeps)

    expect(summary.created).toBe(1)
    expect(created[0]).toMatchObject({
      email: 'mia@topview.test',
      phone: '021 222 2222',
      servicem8Email: 'mia@topview.test',
      servicem8Phone: '021 222 2222',
    })
    expect(contacts).toEqual([
      { clientId: 'created-1', name: 'Mia Builder', email: 'mia@topview.test', phone: '021 222 2222' },
    ])
  })

  it('updates source metadata for an existing reviewed Client without overwriting canonical fields', async () => {
    const existing: ExistingImportedClient = {
      id: 'client-1',
      name: 'Reviewed RG Name',
      companyName: 'Reviewed RG Ltd',
      email: 'rg@example.test',
      phone: '09 000 0000',
      phoneNormalized: null,
      reviewStatus: 'reviewed',
      canonicalSource: 'manual',
      canonicalUpdatedAt: new Date('2026-07-01T12:00:00.000Z'),
    }
    const { deps: testDeps, updated, aliases } = deps({ 'company-1': existing })

    const summary = await importServiceM8CompaniesFromRows([
      company({ uuid: 'company-1', name: 'ServiceM8 Name', email: 'source@example.test', phone: '021 222 2222' }),
    ], testDeps)

    expect(summary.created).toBe(0)
    expect(summary.sourceUpdated).toBe(1)
    expect(summary.needsReview).toBe(0)
    expect(updated[0]).toMatchObject({
      id: 'client-1',
      values: expect.objectContaining({
        name: 'Reviewed RG Name',
        companyName: 'Reviewed RG Ltd',
        email: 'rg@example.test',
        phone: '09 000 0000',
        servicem8Name: 'ServiceM8 Name',
        servicem8Email: 'source@example.test',
        servicem8Phone: '021 222 2222',
      }),
    })
    expect(aliases).toEqual([
      { clientId: 'client-1', aliases: ['Reviewed RG Name', 'Reviewed RG Ltd', 'ServiceM8 Name'], source: 'servicem8_import' },
    ])
  })

  it('skips inactive or incomplete company rows without creating staged records', async () => {
    const { deps: testDeps } = deps()

    const summary = await importServiceM8CompaniesFromRows([
      company({ uuid: null, name: 'Missing UUID' }),
      company({ uuid: 'company-2', name: null }),
      company({ uuid: 'company-3', name: 'Inactive', active: 0 }),
    ], testDeps)

    expect(summary).toMatchObject({ scanned: 3, created: 0, sourceUpdated: 0, needsReview: 0, skipped: 3, errors: 0 })
    expect(testDeps.createClient).not.toHaveBeenCalled()
    expect(testDeps.updateClient).not.toHaveBeenCalled()
  })

  it('continues importing and reports row-level errors', async () => {
    const { deps: testDeps } = deps()
    vi.mocked(testDeps.createClient)
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({ id: 'client-2', reviewStatus: 'pending_review' })

    const summary = await importServiceM8CompaniesFromRows([
      company({ uuid: 'company-1', name: 'Broken Co' }),
      company({ uuid: 'company-2', name: 'Good Co' }),
    ], testDeps)

    expect(summary).toMatchObject({ scanned: 2, created: 1, sourceUpdated: 0, needsReview: 1, skipped: 0, errors: 1 })
    expect(summary.errorMessages[0]).toContain('company-1')
    expect(summary.errorMessages[0]).toContain('database unavailable')
  })
})

describe('readServiceM8ClientImportRecords', () => {
  it('fetches only companies attached to Work Order or Completed jobs and enriches contacts', async () => {
    const calls: string[] = []
    const request = vi.fn(async (path: string) => {
      calls.push(path)

      if (path.startsWith('/job.json')) {
        return jsonResponse([
          { uuid: 'job-1', active: 1, status: 'Work Order', company_uuid: 'company-1' },
          { uuid: 'job-2', active: 1, status: 'Completed', company_uuid: 'company-1' },
          { uuid: 'job-3', active: 1, status: 'Quote', company_uuid: 'company-2' },
          { uuid: 'job-4', active: 0, status: 'Completed', company_uuid: 'company-3' },
        ])
      }
      if (path === '/company/company-1.json') {
        return jsonResponse({ uuid: 'company-1', name: 'Top View Construction', email: 'accounts@topview.test', phone: '09 111 1111', active: 1 })
      }
      if (path.startsWith('/jobcontact.json')) {
        return jsonResponse([
          { first: 'Mia', last: 'Builder', email: 'mia@topview.test', mobile: '021 222 2222', active: 1, type: 'JOB' },
        ])
      }
      throw new Error(`Unexpected ServiceM8 path: ${path}`)
    })

    const rows = await readServiceM8ClientImportRecords(request)

    expect(calls[0]).toContain("/job.json?%24filter=active%20eq%201%20and%20(status%20eq%20'Work%20Order'%20or%20status%20eq%20'Completed')")
    expect(calls).toContain('/company/company-1.json')
    expect(calls.some((path) => path.includes('company-2'))).toBe(false)
    expect(calls.some((path) => path.includes('company-3'))).toBe(false)
    expect(rows).toEqual([
      expect.objectContaining({
        uuid: 'company-1',
        name: 'Top View Construction',
        email: 'mia@topview.test',
        phone: '021 222 2222',
        mobile: '021 222 2222',
        contactName: 'Mia Builder',
        contactEmail: 'mia@topview.test',
        contactMobile: '021 222 2222',
        eligibleJobStatuses: ['Work Order', 'Completed'],
        eligibleJobUuids: ['job-1', 'job-2'],
      }),
    ])
  })
})

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  }
}
