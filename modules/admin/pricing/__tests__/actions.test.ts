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
import { pricingConfigVersions } from '@/drizzle/schema-leads'
import { DEFAULT_PRICING_CONFIG } from '../config-admin'
import {
  activatePricingConfigVersion,
  deletePricingConfigVersion,
  savePricingConfigVersion,
} from '../actions'

const activeRow = {
  id: 'active-pricing-id',
  versionLabel: 'v1-2026-06-10',
  config: DEFAULT_PRICING_CONFIG,
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
      returning: vi.fn().mockResolvedValue([{ id: 'new-pricing-id' }]),
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

describe('savePricingConfigVersion', () => {
  it('inserts a new active pricing version, deactivates the old version, and audits activation', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T00:00:00Z'))

    try {
      queueSelectResults([
        [activeRow],
        [{ versionLabel: 'v1-2026-06-10' }],
      ])

      const formData = new FormData()
      formData.set('config', JSON.stringify(DEFAULT_PRICING_CONFIG))
      formData.set('activationNote', 'Seed live WP pricing into rgtools.')

      const result = await savePricingConfigVersion(formData)

      expect(result).toEqual({ success: true, versionLabel: 'v2-2026-06-15' })
      expect(mockUpdate).toHaveBeenCalledWith(pricingConfigVersions)
      expect(mockInsert).toHaveBeenCalledWith(pricingConfigVersions)
      expect(mockInsert).toHaveBeenCalledWith(auditLog)
      expect(updateSetValues).toEqual([{ isActive: false }])
      expect(updateSetValues.some((values) => Object.hasOwn(values as object, 'config'))).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('requires an activation note before saving a new version', async () => {
    const formData = new FormData()
    formData.set('config', JSON.stringify(DEFAULT_PRICING_CONFIG))

    const result = await savePricingConfigVersion(formData)

    expect(result).toEqual({ error: 'Activation note is required.' })
    expect(mockSelect).not.toHaveBeenCalled()
  })
})

describe('activatePricingConfigVersion', () => {
  it('activates a past version without updating any config JSONB', async () => {
    queueSelectResults([
      [{ id: 'active-pricing-id', versionLabel: 'v2-current' }],
      [{ id: 'past-pricing-id', versionLabel: 'v1-past', isActive: false }],
    ])

    const formData = new FormData()
    formData.set('versionId', 'past-pricing-id')
    formData.set('activationNote', 'Rollback after price check.')

    const result = await activatePricingConfigVersion(formData)

    expect(result).toEqual({ success: true, versionLabel: 'v1-past' })
    expect(updateSetValues).toEqual([{ isActive: false }, { isActive: true }])
    expect(updateSetValues.some((values) => Object.hasOwn(values as object, 'config'))).toBe(false)
  })
})

describe('deletePricingConfigVersion', () => {
  it('archives a past version with mandatory remarks and writes an audit row', async () => {
    queueSelectResults([
      [{ id: 'past-pricing-id', versionLabel: 'v1-past', isActive: false }],
    ])

    const formData = new FormData()
    formData.set('versionId', 'past-pricing-id')
    formData.set('deleteNote', 'Retiring superseded pricing.')

    const result = await deletePricingConfigVersion(formData)

    expect(result).toEqual({ success: true, versionLabel: 'v1-past' })
    expect(updateSetValues[0]).toMatchObject({ archivedAt: expect.any(Date) })
    expect(mockInsert).toHaveBeenCalledWith(auditLog)
  })
})
