import { describe, expect, it } from 'vitest'
import { parseWorkOrderListFilters } from '../list-filters'

describe('parseWorkOrderListFilters', () => {
  it('supports prefixed dashboard params and admin defaults', () => {
    expect(parseWorkOrderListFilters(
      {
        wo_q: '  smith  ',
        wo_current: 'all',
        wo_risk: 'high',
        wo_page: '2',
      },
      {
        prefix: 'wo_',
        defaults: {
          importance: 'medium',
          sort: 'install_date_asc',
          size: '20',
        },
      },
    )).toMatchObject({
      q: 'smith',
      current: 'all',
      risk: 'high',
      importance: 'medium',
      sort: 'install_date_asc',
      page: 2,
      size: 20,
    })
  })

  it('normalizes legacy sort params to explicit directions', () => {
    expect(parseWorkOrderListFilters({ sort: 'lead_score' }).sort).toBe('lead_score_desc')
    expect(parseWorkOrderListFilters({ sort: 'importance' }).sort).toBe('importance_desc')
    expect(parseWorkOrderListFilters({ sort: 'risk' }).sort).toBe('risk_desc')
    expect(parseWorkOrderListFilters({ sort: 'install_date' }).sort).toBe('install_date_asc')
    expect(parseWorkOrderListFilters({ sort: 'job_number' }).sort).toBe('job_number_asc')
  })
})
