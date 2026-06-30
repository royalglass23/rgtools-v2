import { describe, expect, it } from 'vitest'

import { parseWorkOrderListFilters } from '../list-filters'

describe('parseWorkOrderListFilters', () => {
  it('defaults to current records and priority sorting without hidden status or installer filters', () => {
    expect(parseWorkOrderListFilters({})).toEqual({
      q: '',
      current: 'current',
      risk: 'all',
      importance: 'all',
      stage: 'all',
      hardware: 'all',
      sort: 'lead_score',
      page: 1,
      size: 10,
    })
  })

  it('accepts valid filters and pagination', () => {
    expect(parseWorkOrderListFilters({
      q: 'queen',
      current: 'non_current',
      risk: 'high',
      importance: 'medium',
      stage: 'stage-1',
      hardware: 'hardware-1',
      sort: 'install_date',
      page: '3',
      size: '50',
    })).toEqual({
      q: 'queen',
      current: 'non_current',
      risk: 'high',
      importance: 'medium',
      stage: 'stage-1',
      hardware: 'hardware-1',
      sort: 'install_date',
      page: 3,
      size: 50,
    })
  })

  it('falls back when params are invalid', () => {
    expect(parseWorkOrderListFilters({
      risk: 'spicy',
      importance: 'urgent',
      page: '-1',
      size: '500',
      sort: 'unknown',
    })).toEqual({
      q: '',
      current: 'current',
      risk: 'all',
      importance: 'all',
      stage: 'all',
      hardware: 'all',
      sort: 'lead_score',
      page: 1,
      size: 10,
    })
  })
})
