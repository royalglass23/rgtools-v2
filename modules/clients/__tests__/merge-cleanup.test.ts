import { describe, expect, it, vi } from 'vitest'
import { runClientMergeCleanup, type ClientMergeCleanupDeps } from '../merge-cleanup'
import type { ClientMergePlanRow } from '../merge-planner'

const baseCreatedAt = new Date('2026-01-01T00:00:00.000Z')

function row(overrides: Partial<ClientMergePlanRow> & Pick<ClientMergePlanRow, 'id' | 'name'>): ClientMergePlanRow {
  return {
    id: overrides.id,
    name: overrides.name,
    companyName: overrides.companyName ?? null,
    email: overrides.email ?? null,
    phoneNormalized: overrides.phoneNormalized ?? null,
    servicem8CompanyUuid: overrides.servicem8CompanyUuid ?? null,
    resolvedServiceM8CompanyUuid: overrides.resolvedServiceM8CompanyUuid ?? null,
    createdAt: overrides.createdAt ?? baseCreatedAt,
  }
}

describe('runClientMergeCleanup', () => {
  it('prints the plan and changes nothing in dry-run mode', async () => {
    const mergeGroup = vi.fn()
    const deps: ClientMergeCleanupDeps = {
      loadRows: async () => [
        row({ id: 'survivor', name: 'Top View', servicem8CompanyUuid: 'company-1', resolvedServiceM8CompanyUuid: 'company-1' }),
        row({ id: 'loser', name: 'Top View', resolvedServiceM8CompanyUuid: 'company-1' }),
      ],
      mergeGroup,
      print: vi.fn(),
    }

    const result = await runClientMergeCleanup({ apply: false }, deps)

    expect(result.appliedGroups).toBe(0)
    expect(mergeGroup).not.toHaveBeenCalled()
    expect(deps.print).toHaveBeenCalledWith(expect.stringContaining('DRY RUN'))
    expect(deps.print).toHaveBeenCalledWith(expect.stringContaining('same_servicem8_company_uuid'))
  })

  it('applies only exact UUID auto-merge groups', async () => {
    const mergeGroup = vi.fn()
    const deps: ClientMergeCleanupDeps = {
      loadRows: async () => [
        row({ id: 'survivor', name: 'Visionary', servicem8CompanyUuid: 'company-1', resolvedServiceM8CompanyUuid: 'company-1' }),
        row({ id: 'loser', name: 'Visionary', resolvedServiceM8CompanyUuid: 'company-1' }),
        row({ id: 'review-a', name: 'Greatland' }),
        row({ id: 'review-b', name: 'Greatland', resolvedServiceM8CompanyUuid: 'company-2' }),
      ],
      mergeGroup,
      print: vi.fn(),
    }

    const result = await runClientMergeCleanup({ apply: true }, deps)

    expect(result.appliedGroups).toBe(1)
    expect(mergeGroup).toHaveBeenCalledExactlyOnceWith('survivor', ['loser'])
  })

  it('is a no-op on a second apply run after losers are gone', async () => {
    let rows = [
      row({ id: 'survivor', name: 'Top View', servicem8CompanyUuid: 'company-1', resolvedServiceM8CompanyUuid: 'company-1' }),
      row({ id: 'loser', name: 'Top View', resolvedServiceM8CompanyUuid: 'company-1' }),
    ]
    const mergeGroup = vi.fn(async (_survivorId: string, loserIds: string[]) => {
      rows = rows.filter((candidate) => !loserIds.includes(candidate.id))
    })
    const deps: ClientMergeCleanupDeps = {
      loadRows: async () => rows,
      mergeGroup,
      print: vi.fn(),
    }

    await runClientMergeCleanup({ apply: true }, deps)
    const second = await runClientMergeCleanup({ apply: true }, deps)

    expect(second.appliedGroups).toBe(0)
    expect(mergeGroup).toHaveBeenCalledTimes(1)
  })
})
