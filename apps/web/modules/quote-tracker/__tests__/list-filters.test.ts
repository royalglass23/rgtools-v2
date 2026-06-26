import { describe, expect, it } from 'vitest'

import { parseQuoteListFilters } from '../list-filters'

describe('parseQuoteListFilters', () => {
  it('uses dashboard defaults', () => {
    expect(parseQuoteListFilters({})).toEqual({
      search: '',
      status: 'all',
      linkStatus: 'active',
      sort: 'last_opened',
      page: 1,
      size: 5,
    })
  })

  it('accepts valid search, status, sort, page, and page size', () => {
    expect(parseQuoteListFilters({
      search: 'Acme',
      status: 'cold',
      linkStatus: 'expired',
      sort: 'interest_desc',
      page: '3',
      size: '50',
    })).toEqual({
      search: 'Acme',
      status: 'cold',
      linkStatus: 'expired',
      sort: 'interest_desc',
      page: 3,
      size: 50,
    })
  })

  it('accepts a page size of 5', () => {
    expect(parseQuoteListFilters({ size: '5' }).size).toBe(5)
  })

  it('accepts a page size of 10', () => {
    expect(parseQuoteListFilters({ size: '10' }).size).toBe(10)
  })

  it('falls back when params are invalid', () => {
    expect(parseQuoteListFilters({
      search: ['first', 'second'],
      status: 'sleepy',
      linkStatus: 'broken',
      sort: 'newest',
      page: '-1',
      size: '100',
    })).toEqual({
      search: 'first',
      status: 'all',
      linkStatus: 'active',
      sort: 'last_opened',
      page: 1,
      size: 5,
    })
  })

  it.each(['active', 'expired', 'all'] as const)('accepts %s as a link status', (linkStatus) => {
    expect(parseQuoteListFilters({ linkStatus }).linkStatus).toBe(linkStatus)
  })
})
