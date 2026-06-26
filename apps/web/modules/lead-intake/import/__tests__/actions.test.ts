// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeadImportRow } from '../types'

const existingRefs = vi.hoisted(() => ({ values: [] as string[] }))
const updatedLeads = vi.hoisted(() => [] as unknown[])
const submitLeadIntakeForUserMock = vi.hoisted(() => vi.fn())
const setJobLeadsQualityMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => ({ user: { id: 'admin-id', role: 'admin' } })),
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => existingRefs.values.map((externalRef) => ({ externalRef }))),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values) => ({
        where: vi.fn(async () => {
          updatedLeads.push(values)
        }),
      })),
    })),
  },
}))

vi.mock('@/modules/lead-intake/scoring/config-options', () => ({
  getActiveScoringOptionLists: vi.fn(async () => ({
    configVersionId: 'config-1',
    config: { categories: {}, bonuses: {}, penalties: {}, tiers: { A: 80, B: 60, C: 40 } },
    categories: {
      '1': { options: [{ key: 'repeat_builder' }] },
      '2': { options: [{ key: '50k_plus' }] },
      '4': { options: [{ key: 'complex_install' }] },
      '5': { options: [{ key: 'fast_decision' }] },
      '6': { options: [{ key: 'one_decision_maker' }] },
      '8': { options: [{ key: 'approved' }] },
      '9': { options: [{ key: 'under_review' }] },
      '10': { options: [{ key: 'planning' }] },
    },
  })),
}))

vi.mock('@/modules/lead-intake/actions', () => ({
  submitLeadIntakeForUser: submitLeadIntakeForUserMock,
}))

vi.mock('@/lib/servicem8/client', () => ({
  setJobLeadsQuality: setJobLeadsQualityMock,
}))

import { commitLeadImport } from '../actions'

function importRow(overrides: Partial<LeadImportRow> = {}): LeadImportRow {
  return {
    rowId: 'row-2',
    rowNumber: 2,
    jobNumber: 'R260227',
    input: {
      clientName: 'Aroha Smith',
      phone: '021 456',
      email: '',
      clientProfileKey: 'repeat_builder',
      projectType: 'Pool Fencing',
      location: '1 Queen Street, Auckland',
      source: 'other',
      externalRef: 'R260227',
      budgetBand: '50k_plus',
      cat4: 'complex_install',
      priceSensitivityRead: 'fast_decision',
    },
    issues: [],
    enriched: true,
    servicem8JobUuid: 'job-uuid-1',
    servicem8JobNumber: 'R260227',
    servicem8Status: 'Work Order',
    existing: false,
    autoSkip: false,
    needsContact: false,
    notEnriched: false,
    enrichmentMessage: null,
    ...overrides,
  }
}

describe('commitLeadImport', () => {
  beforeEach(() => {
    existingRefs.values = []
    updatedLeads.length = 0
    setJobLeadsQualityMock.mockReset()
    setJobLeadsQualityMock.mockResolvedValue(undefined)
    submitLeadIntakeForUserMock.mockReset()
    submitLeadIntakeForUserMock.mockResolvedValue({
      success: true,
      leadId: 'lead-1',
      clientId: 'client-1',
      matchedExistingClient: false,
      score: 80,
      tier: 'A',
      reason: 'ok',
      completeness: 90,
      distanceBand: null,
      flagNote: null,
      servicem8Sync: { ok: true, leadId: 'lead-1', reference: 'pending_retry' },
    })
  })

  it('inserts a valid row, stores ServiceM8 metadata, then skips the same job number as existing', async () => {
    await expect(commitLeadImport([importRow()])).resolves.toMatchObject({
      success: true,
      inserted: 1,
      skippedExisting: 0,
    })
    expect(submitLeadIntakeForUserMock).toHaveBeenCalledOnce()
    expect(updatedLeads[0]).toMatchObject({
      servicem8JobUuid: 'job-uuid-1',
      servicem8JobNumber: 'R260227',
      servicem8Status: 'Work Order',
      syncStatus: 'synced',
    })

    existingRefs.values = ['R260227']
    await expect(commitLeadImport([importRow()])).resolves.toMatchObject({
      success: true,
      inserted: 0,
      skippedExisting: 1,
    })
  })

  it('writes the lead tier to the linked job Leads Quality field on import', async () => {
    await commitLeadImport([importRow()])

    expect(setJobLeadsQualityMock).toHaveBeenCalledWith('job-uuid-1', 'A')
  })

  it('still imports the lead when the Leads Quality write fails', async () => {
    setJobLeadsQualityMock.mockRejectedValue(new Error('ServiceM8 Leads Quality write failed with HTTP 403'))

    await expect(commitLeadImport([importRow()])).resolves.toMatchObject({
      success: true,
      inserted: 1,
    })
  })

  it('commits a needs-contact row with an import flag instead of blocking it', async () => {
    await expect(commitLeadImport([importRow({
      input: { ...importRow().input, phone: '', email: '' },
      needsContact: true,
    })])).resolves.toMatchObject({
      success: true,
      inserted: 1,
      needsContact: 1,
    })
    expect(submitLeadIntakeForUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '',
        email: '',
        freeText: '[Import flag] Missing phone/email in ServiceM8 at import time.',
      }),
      'admin-id',
      { syncServiceM8: false, allowMissingContact: true },
    )
  })

  it('skips duplicate job numbers within the same import batch', async () => {
    await expect(commitLeadImport([
      importRow(),
      importRow({ rowId: 'row-3', rowNumber: 3 }),
    ])).resolves.toMatchObject({
      success: true,
      inserted: 1,
      skippedExisting: 1,
    })

    expect(submitLeadIntakeForUserMock).toHaveBeenCalledOnce()
  })
})
