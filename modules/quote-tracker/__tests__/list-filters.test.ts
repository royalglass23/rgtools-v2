import { describe, expect, it } from 'vitest'

import { parseQuoteListFilters } from '../list-filters'

describe('parseQuoteListFilters', () => {
  it('uses dashboard defaults', () => {
    expect(parseQuoteListFilters({})).toEqual({
      search: '',
      status: 'all',
      sort: 'last_opened',
      page: 1,
      size: 10,
    })
  })

  it('accepts valid search, status, sort, page, and page size', () => {
    expect(parseQuoteListFilters({
      search: 'Acme',
      status: 'cold',
      sort: 'interest_desc',
      page: '3',
      size: '50',
    })).toEqual({
      search: 'Acme',
      status: 'cold',
      sort: 'interest_desc',
      page: 3,
      size: 50,
    })
  })

  it('falls back when params are invalid', () => {
    expect(parseQuoteListFilters({
      search: ['first', 'second'],
      status: 'sleepy',
      sort: 'newest',
      page: '-1',
      size: '100',
    })).toEqual({
      search: 'first',
      status: 'all',
      sort: 'last_opened',
      page: 1,
      size: 10,
    })
  })
})
