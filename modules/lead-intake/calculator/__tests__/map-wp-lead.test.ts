import { describe, expect, it } from 'vitest'
import { mapWpLeadToIntakeInput, budgetBandFromEstimate, type WpCalculatorLead } from '../map-wp-lead'

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
      projectType: 'pool_fence',
      budgetBand: '2k_to_10k',
      cat4: 'standard_non_custom',
      location: '12 Beach Rd, Takapuna',
      source: 'calculator',
      timeline: 'asap',
      externalRef: 'calculator:42',
    })
  })

  it('maps calculator scenarios to rgtools project-type keys', () => {
    const scenario = (project_type: string) =>
      mapWpLeadToIntakeInput({ ...baseWpLead, project_type }).projectType

    expect(scenario('ground_level')).toBe('ground_level')
    expect(scenario('balcony_balustrade')).toBe('balcony_balustrade')
    expect(scenario('stair_balustrade')).toBe('stair_balustrade')
    expect(scenario('premium_pool_fence')).toBe('pool_fence')
    expect(scenario('something_new')).toBe('other')
  })

  it('flags consultation leads as minor custom, otherwise standard, never complex', () => {
    expect(mapWpLeadToIntakeInput(baseWpLead).cat4).toBe('standard_non_custom')
    expect(mapWpLeadToIntakeInput({ ...baseWpLead, needs_consult: 1 }).cat4).toBe('minor_custom')
    expect(mapWpLeadToIntakeInput({ ...baseWpLead, needs_consult: 0 }).cat4).toBe('standard_non_custom')
  })

  it('derives the budget band from the estimate midpoint using exact scoring keys', () => {
    expect(budgetBandFromEstimate('1500.00', '1800.00')).toBe('under_2k')
    expect(budgetBandFromEstimate('4100.00', '5400.00')).toBe('2k_to_10k')
    expect(budgetBandFromEstimate('11000.00', '13000.00')).toBe('10k_to_50k')
    expect(budgetBandFromEstimate('48000.00', '60000.00')).toBe('50k_plus')
    expect(budgetBandFromEstimate('', 'NaN')).toBe('')
    expect(budgetBandFromEstimate('0', '0')).toBe('')
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

  it('includes optional calculator fields in free text when present', () => {
    const freeText = mapWpLeadToIntakeInput({
      ...baseWpLead,
      est_subtotal: '4800.00',
      needs_consult: 1,
      consult_notes: 'Special Engineer Design may be required',
      height: '1.2m',
    }).freeText ?? ''

    expect(freeText).toContain('subtotal $4800.00')
    expect(freeText).toContain('height 1.2m')
    expect(freeText).toContain('Consultation needed: yes — Special Engineer Design may be required')
    expect(freeText).toContain('Customer type: Homeowner')
  })
})
