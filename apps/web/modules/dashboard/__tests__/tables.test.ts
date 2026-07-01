import { describe, expect, it } from 'vitest'
import { defaultFilterFor, getTableMeta, sanitizeDashboardConfig } from '../tables'

describe('dashboard table registry', () => {
  it('allows Work Orders to be selected and stores safe default filters', () => {
    const meta = getTableMeta('work_orders')

    expect(meta?.available).toBe(true)
    expect(defaultFilterFor('work_orders')).toEqual({
      current: 'current',
      risk: 'all',
      importance: 'all',
      sort: 'lead_score_desc',
      size: '10',
    })
    expect(sanitizeDashboardConfig([
      { key: 'work_orders', filter: { current: 'all', risk: 'high', sort: 'install_date_asc', size: '20' } },
    ])).toEqual([
      {
        key: 'work_orders',
        filter: {
          current: 'all',
          risk: 'high',
          importance: 'all',
          sort: 'install_date_asc',
          size: '20',
        },
      },
    ])
  })
})
