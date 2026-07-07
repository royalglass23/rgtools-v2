import { describe, expect, it, vi } from 'vitest'
import {
  importServiceM8CompaniesFromRows,
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
    active: overrides.active ?? 1,
    edit_date: overrides.edit_date ?? '2026-07-07 11:00:00',
  } satisfies ServiceM8CompanyImportRecord
}

function deps(existingByUuid: Record<string, ExistingImportedClient | null> = {}) {
  const created: unknown[] = []
  const updated: Array<{ id: string; values: unknown }> = []
  const aliases: Array<{ clientId: string; aliases: string[]; source: string }> = []
  const testDeps: ClientImportDeps = {
    now: () => now,
    findByServiceM8Uuid: vi.fn(async (uuid) => existingByUuid[uuid] ?? null),
    createClient: vi.fn(async (values) => {
      created.push(values)
      return { id: `created-${created.length}`, reviewStatus: 'pending_review' }
    }),
    updateClient: vi.fn(async (id, values) => {
      updated.push({ id, values })
      return { id, reviewStatus: existingByUuid[(values as { servicem8CompanyUuid: string }).servicem8CompanyUuid]?.reviewStatus ?? 'pending_review' }
    }),
    addClientAliases: vi.fn(async (clientId, aliasesToAdd, source) => {
      aliases.push({ clientId, aliases: aliasesToAdd, source })
    }),
  }

  return { deps: testDeps, created, updated, aliases }
}

describe('importServiceM8CompaniesFromRows', () => {
  it('creates visible Clients from active ServiceM8 companies and reports review counts', async () => {
    const { deps: testDeps, created, aliases } = deps()

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
