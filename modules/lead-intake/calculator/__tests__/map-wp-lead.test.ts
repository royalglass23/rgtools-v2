import { describe, expect, it } from 'vitest'
import { mapWpLeadToIntakeInput, type WpCalculatorLead } from '../map-wp-lead'

const baseWpLead: WpCalculatorLead = {
  id: 42,
  status: 'NEW',
  first_name: 'Sarah',
  last_name: 'Johnson',
  phone: '021 123 4567',
  email: 'sarah@example.com',
  customer_type: 'homeowner',
  timeframe: 'asap',
  address: '12 Beach Rd, Takapuna',
  call_pref: 'anytime',
  notes: 'pool fence needs a self-closing gate',
  project_type: 'premium_pool_fence',
  length_m: 12,
  corners: 2,
  gates: 1,
  fixing_method: 'spigot_round',
  substrate: 'concrete',
  hardware: 'standard_chrome',
  est_low: '4100.00',
  est_high: '5400.00',
  consent_given: 1,
  created_at: '2026-06-10 09:30:00',
}

describe('mapWpLeadToIntakeInput', () => {
  it('maps a homeowner calculator lead to intake input', () => {
    expect(mapWpLeadToIntakeInput(baseWpLead)).toMatchObject({
      clientName: 'Sarah Johnson',
      companyName: '',
      phone: '021 123 4567',
      email: 'sarah@example.com',
      clientProfileKey: 'homeowner',
      projectType: 'premium_pool_fence',
      location: '12 Beach Rd, Takapuna',
      source: 'calculator',
      timeline: 'asap',
      externalRef: 'calculator:42',
    })
  })

  it('maps business customer types to new business and company name', () => {
    const input = mapWpLeadToIntakeInput({
      ...baseWpLead,
      first_name: 'Smith',
      last_name: 'Builders',
      customer_type: 'builder',
    })

    expect(input.clientName).toBe('Smith Builders')
    expect(input.companyName).toBe('Smith Builders')
    expect(input.clientProfileKey).toBe('new_business')
  })

  it('leaves unknown customer types unclassified for staff review', () => {
    const input = mapWpLeadToIntakeInput({ ...baseWpLead, customer_type: 'other' })

    expect(input.clientProfileKey).toBe('')
  })

  it('builds free text with estimate and project details without mapping contact consent', () => {
    const freeText = mapWpLeadToIntakeInput(baseWpLead).freeText ?? ''

    expect(freeText).toContain('WP lead #42')
    expect(freeText).toContain('$4100.00 - $5400.00')
    expect(freeText).toContain('premium_pool_fence, 12m, 2 corner(s), 1 gate(s)')
    expect(freeText).toContain('spigot_round')
    expect(freeText).toContain('Contact consent: yes')
    expect(freeText).toContain('pool fence needs a self-closing gate')
    expect(mapWpLeadToIntakeInput(baseWpLead).consentStatus).toBeUndefined()
  })
})
