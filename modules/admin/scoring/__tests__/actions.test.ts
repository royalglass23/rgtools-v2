// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuth = vi.hoisted(() => vi.fn())
const mockRevalidatePath = vi.hoisted(() => vi.fn())
const mockSelect = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
const mockInsert = vi.hoisted(() => vi.fn())
const mockTransaction = vi.hoisted(() => vi.fn())
const updateSetValues = vi.hoisted(() => [] as unknown[])

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('@/lib/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
    transaction: mockTransaction,
  },
}))

import { auditLog } from '@/drizzle/schema'
import { scoringConfigVersions } from '@/drizzle/schema-leads'
import {
  activateScoringConfigVersion,
  deleteScoringConfigVersion,
  saveScoringConfigVersion,
} from '../actions'
import type { ScoringConfig } from '@/modules/lead-intake/scoring/score-lead'

const config: ScoringConfig = {
  categories: {
    '1': {
      label: 'Client type',
      max: 10,
      options: { builder: 10 },
      optionOrder: ['builder'],
    },
  },
  bonuses: {},
  penalties: {},
  tiers: { A: 80, B: 50, C: 20 },
  strikes: {
    weights: { builder: 1 },
    softDemoteAt: 1,
    capAt: 2,
    capCeiling: 'C',
  },
}

const activeRow = {
  id: 'active-version-id',
  versionLabel: 'v3-2026-06-08',
  config,
}

beforeEach(() => {
  vi.clearAllMocks()
  updateSetValues.length = 0
  mockAuth.mockResolvedValue({ user: { id: 'actor-id', role: 'admin' } })
  mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
    const tx = { update: mockUpdate, insert: mockInsert }
    return callback(tx)
  })
  mockUpdate.mockImplementation(() => ({
    set: vi.fn((values) => {
      updateSetValues.push(values)
      return { where: vi.fn().mockResolvedValue(values) }
    }),
  }))
  mockInsert.mockReturnValue({
    values: vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: 'new-version-id' }]),
      then: (resolve: (value: unknown[]) => void, reject?: (reason: unknown) => void) =>
        Promise.resolve([]).then(resolve, reject),
    })),
  })
})

function queueSelectResults(results: unknown[][]) {
  mockSelect.mockImplementation(() => {
    const rows = results.shift() ?? []
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => Promise.resolve(rows)),
      limit: vi.fn(() => Promise.resolve(rows)),
      then: (resolve: (value: unknown[]) => void, reject?: (reason: unknown) => void) =>
        Promise.resolve(rows).then(resolve, reject),
    }
    return chain
  })
}

describe('saveScoringConfigVersion', () => {
  it('inserts a new active config version, deactivates the old version, and audits activation', async () => {
    // Pin the clock so the auto-generated version label is deterministic
    // regardless of the day the test runs.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T00:00:00Z'))

    try {
      queueSelectResults([
        [activeRow],
        [{ versionLabel: 'v3-2026-06-08' }],
        [],
      ])

      const formData = new FormData()
      formData.set('config', JSON.stringify(config))
      formData.set('versionLabel', 'custom-label-that-must-be-ignored')
      formData.set('activationNote', 'Adjusted lead scoring ceiling points.')

      const result = await saveScoringConfigVersion(formData)

      expect(result).toEqual({ success: true, versionLabel: 'v4-2026-06-11', warnings: [] })
      expect(mockUpdate).toHaveBeenCalledWith(scoringConfigVersions)
      expect(mockInsert).toHaveBeenCalledWith(scoringConfigVersions)
      expect(mockInsert).toHaveBeenCalledWith(auditLog)

      expect(updateSetValues).toEqual([{ isActive: false }])
      expect(updateSetValues.some((values) => Object.hasOwn(values as object, 'config'))).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('requires an activation note before saving a new version', async () => {
    const formData = new FormData()
    formData.set('config', JSON.stringify(config))

    const result = await saveScoringConfigVersion(formData)

    expect(result).toEqual({ error: 'Activation note is required.' })
    expect(mockSelect).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

describe('activateScoringConfigVersion', () => {
  it('activates a past version without updating any config JSONB', async () => {
    queueSelectResults([
      [{ id: 'active-version-id', versionLabel: 'v4-current' }],
      [{ id: 'past-version-id', versionLabel: 'v3-past', isActive: false }],
    ])

    const formData = new FormData()
    formData.set('versionId', 'past-version-id')
    formData.set('activationNote', 'Rollback after testing.')

    const result = await activateScoringConfigVersion(formData)

    expect(result).toEqual({ success: true, versionLabel: 'v3-past', warnings: [] })

    expect(updateSetValues).toEqual([{ isActive: false }, { isActive: true }])
    expect(updateSetValues.some((values) => Object.hasOwn(values as object, 'config'))).toBe(false)
  })

  it('requires an activation note before activating a past version', async () => {
    const formData = new FormData()
    formData.set('versionId', 'past-version-id')

    const result = await activateScoringConfigVersion(formData)

    expect(result).toEqual({ error: 'Activation note is required.' })
    expect(mockSelect).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('deleteScoringConfigVersion', () => {
  it('archives a past version with mandatory remarks and writes an audit row', async () => {
    queueSelectResults([
      [{ id: 'past-version-id', versionLabel: 'v3-past', isActive: false }],
    ])

    const formData = new FormData()
    formData.set('versionId', 'past-version-id')
    formData.set('deleteNote', 'Retiring old scoring draft.')

    const result = await deleteScoringConfigVersion(formData)

    expect(result).toEqual({ success: true, versionLabel: 'v3-past', warnings: [] })
    expect(updateSetValues).toHaveLength(1)
    expect(updateSetValues[0]).toMatchObject({ archivedAt: expect.any(Date) })
    expect(mockInsert).toHaveBeenCalledWith(auditLog)
  })

  it('requires remarks before deleting a version', async () => {
    const formData = new FormData()
    formData.set('versionId', 'past-version-id')

    const result = await deleteScoringConfigVersion(formData)

    expect(result).toEqual({ error: 'Delete remarks are required.' })
    expect(mockSelect).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('refuses to delete the active version', async () => {
    queueSelectResults([
      [{ id: 'active-version-id', versionLabel: 'v4-current', isActive: true }],
    ])

    const formData = new FormData()
    formData.set('versionId', 'active-version-id')
    formData.set('deleteNote', 'Cannot remove current rules.')

    const result = await deleteScoringConfigVersion(formData)

    expect(result).toEqual({ error: 'Cannot delete the active scoring config version.' })
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })
})
