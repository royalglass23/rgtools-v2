// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const orderByCalls = vi.hoisted(() => [] as unknown[][])

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions })),
  asc: vi.fn((column: { name?: string }) => ({ direction: 'asc', column: column.name })),
  count: vi.fn(() => 'count'),
  desc: vi.fn((column: { name?: string }) => ({ direction: 'desc', column: column.name })),
  eq: vi.fn((column: { name?: string }, value: unknown) => ({ type: 'eq', column: column.name, value })),
  gte: vi.fn((column: { name?: string }, value: unknown) => ({ type: 'gte', column: column.name, value })),
  isNotNull: vi.fn((column: { name?: string }) => ({ type: 'isNotNull', column: column.name })),
  isNull: vi.fn((column: { name?: string }) => ({ type: 'isNull', column: column.name })),
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
            where: vi.fn(async () => [{ total: 0 }]),
          })),
        }
      }

      return {
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn((...orders: unknown[]) => {
                orderByCalls.push(orders)
                return {
                  limit: vi.fn(() => ({
                    offset: vi.fn(async () => []),
                  })),
                }
              }),
            })),
          })),
        })),
      }
    }),
  },
}))

import { getLeadsList, type LeadsListFilters } from '../queries'

const filters: LeadsListFilters = {
  tier: 'all',
  sm8: 'all',
  date: 'all',
  page: 1,
  size: 10,
}

beforeEach(() => {
  vi.clearAllMocks()
  orderByCalls.length = 0
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
})
