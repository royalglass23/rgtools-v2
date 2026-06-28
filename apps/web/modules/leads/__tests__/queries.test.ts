// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const orderByCalls = vi.hoisted(() => [] as unknown[][])
const whereCalls = vi.hoisted(() => [] as unknown[])

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions })),
  asc: vi.fn((column: { name?: string }) => ({ direction: 'asc', column: column.name })),
  count: vi.fn(() => 'count'),
  desc: vi.fn((column: { name?: string }) => ({ direction: 'desc', column: column.name })),
  eq: vi.fn((column: { name?: string }, value: unknown) => ({ type: 'eq', column: column.name, value })),
  gte: vi.fn((column: { name?: string }, value: unknown) => ({ type: 'gte', column: column.name, value })),
  ilike: vi.fn((column: { name?: string }, value: unknown) => ({ type: 'ilike', column: column.name, value })),
  isNotNull: vi.fn((column: { name?: string }) => ({ type: 'isNotNull', column: column.name })),
  isNull: vi.fn((column: { name?: string }) => ({ type: 'isNull', column: column.name })),
  lte: vi.fn((column: { name?: string }, value: unknown) => ({ type: 'lte', column: column.name, value })),
  ne: vi.fn((column: { name?: string }, value: unknown) => ({ type: 'ne', column: column.name, value })),
  or: vi.fn((...conditions: unknown[]) => ({ type: 'or', conditions })),
  sql: vi.fn(() => ({ type: 'sql' })),
}))

vi.mock('@/modules/lead-intake/scoring/config-options', () => ({
  getActiveScoringOptionLists: vi.fn(),
}))

vi.mock('../table-prefs-shared', () => ({
  DEFAULT_LEADS_PREFS: {
    columns: [],
    sortColumn: 'createdAt',
    sortDir: 'desc',
  },
  LEADS_SORT_COLUMNS: [
    'createdAt',
    'tier',
    'seedScore',
    'completeness',
    'followUpDate',
    'updatedAt',
    'clientName',
  ],
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn((shape: Record<string, unknown>) => {
      if ('total' in shape) {
        return {
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(async () => [{ total: 0 }]),
            })),
          })),
        }
      }

      return {
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn((condition: unknown) => {
              whereCalls.push(condition)
              return {
                orderBy: vi.fn((...orders: unknown[]) => {
                  orderByCalls.push(orders)
                  return {
                    limit: vi.fn(() => ({
                      offset: vi.fn(async () => []),
                    })),
                  }
                }),
              }
            }),
          })),
        })),
      }
    }),
  },
}))

import { getLeadsList, parseLeadsListFilters, type LeadsListFilters } from '../queries'

const filters: LeadsListFilters = {
  q: '',
  tier: 'all',
  sm8: 'all',
  date: 'all',
  stale: false,
  page: 1,
  size: 10,
  sortColumn: 'createdAt',
  sortDir: 'desc',
}

beforeEach(() => {
  vi.clearAllMocks()
  orderByCalls.length = 0
  whereCalls.length = 0
})

describe('parseLeadsListFilters – stale param', () => {
  it('defaults stale to false when param is absent', () => {
    const result = parseLeadsListFilters({})
    expect(result.stale).toBe(false)
  })

  it('returns stale: true when stale=true is in URL params', () => {
    const result = parseLeadsListFilters({ stale: 'true' })
    expect(result.stale).toBe(true)
  })

  it('returns stale: false for invalid values', () => {
    const result = parseLeadsListFilters({ stale: 'yes' })
    expect(result.stale).toBe(false)
  })
})

describe('getLeadsList – stale filter WHERE clause', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-27T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('includes isNull on servicem8_job_uuid when stale is true', async () => {
    await getLeadsList({ ...filters, stale: true })

    expect(whereCalls[0]).toEqual(expect.objectContaining({
      type: 'and',
      conditions: expect.arrayContaining([
        { type: 'isNull', column: 'servicem8_job_uuid' },
      ]),
    }))
  })

  it('includes ne on sync_status to exclude sync_failed when stale is true', async () => {
    await getLeadsList({ ...filters, stale: true })

    expect(whereCalls[0]).toEqual(expect.objectContaining({
      type: 'and',
      conditions: expect.arrayContaining([
        { type: 'ne', column: 'sync_status', value: 'sync_failed' },
      ]),
    }))
  })

  it('includes lte on created_at with 7-day cutoff when stale is true', async () => {
    await getLeadsList({ ...filters, stale: true })

    const cutoff = new Date('2026-06-20T00:00:00Z')
    expect(whereCalls[0]).toEqual(expect.objectContaining({
      type: 'and',
      conditions: expect.arrayContaining([
        { type: 'lte', column: 'created_at', value: cutoff },
      ]),
    }))
  })
})

describe('getLeadsList sorting', () => {
  it('maps an allowed sort column to the query order', async () => {
    await getLeadsList(filters, { sortColumn: 'clientName', sortDir: 'asc' })

    expect(orderByCalls[0]).toEqual([
      { direction: 'asc', column: 'name' },
      { direction: 'desc', column: 'created_at' },
    ])
  })

  it('falls back to createdAt descending for non-sortable columns', async () => {
    await getLeadsList(filters, { sortColumn: 'aiSuggestion', sortDir: 'asc' })

    expect(orderByCalls[0]).toEqual([
      { direction: 'desc', column: 'created_at' },
    ])
  })

  it('uses URL sort values when no explicit sort override is provided', async () => {
    await getLeadsList({ ...filters, sortColumn: 'seedScore', sortDir: 'asc' })

    expect(orderByCalls[0]).toEqual([
      { direction: 'asc', column: 'seed_score' },
      { direction: 'desc', column: 'created_at' },
    ])
  })

  it('searches by ServiceM8 job number', async () => {
    await getLeadsList({ ...filters, q: 'R260210' })

    expect(whereCalls[0]).toEqual(expect.objectContaining({
      type: 'and',
      conditions: expect.arrayContaining([
        expect.objectContaining({
          type: 'or',
          conditions: expect.arrayContaining([
            { type: 'ilike', column: 'servicem8_job_number', value: '%R260210%' },
          ]),
        }),
      ]),
    }))
  })
})
