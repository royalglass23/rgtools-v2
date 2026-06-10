import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importCalculatorLeads } from '../import-calculator-leads'
import type { WpCalculatorLead } from '../map-wp-lead'

const wpLead = (id: number): WpCalculatorLead => ({
  id,
  status: 'NEW',
  first_name: 'Sarah',
  last_name: 'Johnson',
  phone: '021 123 4567',
  email: `sarah${id}@example.com`,
  customer_type: 'homeowner',
  timeframe: 'asap',
  address: '12 Beach Rd, Takapuna',
  call_pref: 'anytime',
  notes: '',
  project_type: 'ground_level',
  length_m: 8,
  corners: 0,
  gates: 0,
  fixing_method: 'spigot_round',
  substrate: 'concrete',
  hardware: 'standard_chrome',
  est_low: '2200.00',
  est_high: '2900.00',
  consent_given: 1,
  created_at: '2026-06-10 09:30:00',
})

function fetchFnReturning(leads: WpCalculatorLead[], ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({ ok: true, leads }),
  }) as unknown as typeof fetch
}

beforeEach(() => {
  process.env.CALCULATOR_WP_EXPORT_URL = 'https://example.com/wp-json/royal-glass/v1/export-leads'
  process.env.CALCULATOR_WP_EXPORT_KEY = 'export-key'
})

describe('importCalculatorLeads', () => {
  it('fetches since the max imported id and submits each lead with a null actor', async () => {
    const fetchFn = fetchFnReturning([wpLead(7), wpLead(8)])
    const submitFn = vi.fn().mockResolvedValue({ success: true, leadId: 'lead-uuid' })

    const summary = await importCalculatorLeads({ limit: 10 }, {
      fetchFn,
      submitFn,
      getSinceId: async () => 6,
    })

    expect(fetchFn).toHaveBeenCalledWith(
      'https://example.com/wp-json/royal-glass/v1/export-leads?since_id=6&limit=10',
      { headers: { 'X-RG-Export-Key': 'export-key' } },
    )
    expect(submitFn).toHaveBeenCalledTimes(2)
    expect(submitFn.mock.calls[0][0].externalRef).toBe('calculator:7')
    expect(submitFn.mock.calls[0][1]).toBeNull()
    expect(summary).toMatchObject({ fetched: 2, imported: 2, failed: 0 })
  })

  it('records per-lead failures without aborting the batch', async () => {
    const fetchFn = fetchFnReturning([wpLead(7), wpLead(8)])
    const submitFn = vi.fn()
      .mockResolvedValueOnce({ error: 'Phone or email is required.' })
      .mockResolvedValueOnce({ success: true, leadId: 'lead-uuid' })

    const summary = await importCalculatorLeads({}, { fetchFn, submitFn, getSinceId: async () => 0 })

    expect(summary.fetched).toBe(2)
    expect(summary.imported).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.results[0]).toMatchObject({ wpLeadId: 7, ok: false, error: 'Phone or email is required.' })
  })

  it('throws when the WP endpoint rejects', async () => {
    const fetchFn = fetchFnReturning([], false, 403)

    await expect(
      importCalculatorLeads({}, { fetchFn, submitFn: vi.fn(), getSinceId: async () => 0 }),
    ).rejects.toThrow('HTTP 403')
  })

  it('throws when env vars are missing', async () => {
    delete process.env.CALCULATOR_WP_EXPORT_URL

    await expect(
      importCalculatorLeads({}, { fetchFn: vi.fn() as unknown as typeof fetch, submitFn: vi.fn(), getSinceId: async () => 0 }),
    ).rejects.toThrow('CALCULATOR_WP_EXPORT_URL')
  })
})
