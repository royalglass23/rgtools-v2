import { describe, expect, it } from 'vitest'

import { parseWorkOrderListFilters } from '../list-filters'

describe('parseWorkOrderListFilters', () => {
  it('defaults to current ServiceM8 Work Order status and score sorting', () => {
    expect(parseWorkOrderListFilters({})).toEqual({
      q: '',
      servicem8Status: 'Work Order',
      current: 'current',
      risk: 'all',
      importance: 'all',
      installer: 'all',
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
      servicem8Status: 'Completed',
      current: 'non_current',
      risk: 'high',
      importance: 'medium',
      installer: 'installer-1',
      stage: 'stage-1',
      hardware: 'hardware-1',
      sort: 'install_date',
      page: '3',
      size: '50',
    })).toEqual({
      q: 'queen',
      servicem8Status: 'Completed',
      current: 'non_current',
      risk: 'high',
      importance: 'medium',
      installer: 'installer-1',
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
      servicem8Status: 'Work Order',
      current: 'current',
      risk: 'all',
      importance: 'all',
      installer: 'all',
      stage: 'all',
      hardware: 'all',
      sort: 'lead_score',
      page: 1,
      size: 10,
    })
  })
})
