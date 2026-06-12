import { describe, expect, it } from 'vitest'
import {
  budgetBandFromEstimate,
  mapCalculatorSubmissionToIntakeInput,
  type CalculatorSubmission,
} from '../map-calculator-submission'

const baseSubmission: CalculatorSubmission = {
  answers: {
    scenario: 'premium_pool_fence',
    length: 12,
    corners: 2,
    gates: 1,
    fixing: 'spigot_round',
    substrate: 'concrete',
    hardware: 'standard_chrome',
    height: '1.2m',
  },
  lead: {
    firstName: 'Sarah',
    lastName: 'Johnson',
    phone: '021 123 4567',
    email: 'sarah@example.com',
    customerType: 'homeowner',
    timeframe: 'asap',
    address: '12 Beach Rd, Takapuna',
    callPreference: 'anytime',
    notes: 'Pool fence needs a self-closing gate',
    consent: true,
    websiteUrl: '',
  },
  estimate: {
    low: 4100,
    high: 5400,
    subtotal: 4800,
    needsCallUs: false,
    consultationFlags: ['Special Engineer Design may be required'],
  },
  loadedAt: 1718200000000,
  turnstileToken: 'token',
}

describe('mapCalculatorSubmissionToIntakeInput', () => {
  it('maps the browser calculator payload to lead intake input', () => {
    const input = mapCalculatorSubmissionToIntakeInput(baseSubmission, {
      submittedAt: new Date('2026-06-12T01:02:03.000Z'),
      submissionRef: 'calculator:test-ref',
    })

    expect(input).toMatchObject({
      clientName: 'Sarah Johnson',
      companyName: '',
      phone: '021 123 4567',
      email: 'sarah@example.com',
      clientProfileKey: 'homeowner',
      projectType: 'pool_fence',
      budgetBand: '2k_to_10k',
      cat4: 'minor_custom',
      location: '12 Beach Rd, Takapuna',
      source: 'calculator',
      timeline: 'asap',
      externalRef: 'calculator:test-ref',
    })

    expect(input.freeText).toContain('[Calculator] submitted 2026-06-12T01:02:03.000Z')
    expect(input.freeText).toContain('Estimate: $4100 - $5400 (subtotal $4800)')
    expect(input.freeText).toContain('premium_pool_fence, 12m, 2 corner(s), 1 gate(s)')
    expect(input.freeText).toContain('Special Engineer Design may be required')
    expect(input.freeText).toContain('Contact consent: yes')
  })

  it('clamps untrusted estimate values before deriving the budget band', () => {
    const input = mapCalculatorSubmissionToIntakeInput({
      ...baseSubmission,
      estimate: {
        ...baseSubmission.estimate,
        low: 2_000_000,
        high: -500,
      },
    }, {
      submittedAt: new Date('2026-06-12T01:02:03.000Z'),
      submissionRef: 'calculator:test-ref',
    })

    expect(input.budgetBand).toBe('50k_plus')
    expect(input.freeText).toContain('Estimate: $0 - $999999')
  })

  it('maps all known scenarios to rgtools project-type keys', () => {
    const scenario = (value: string) => mapCalculatorSubmissionToIntakeInput({
      ...baseSubmission,
      answers: { ...baseSubmission.answers, scenario: value },
    }, {
      submittedAt: new Date('2026-06-12T01:02:03.000Z'),
      submissionRef: 'calculator:test-ref',
    }).projectType

    expect(scenario('ground_level')).toBe('ground_level')
    expect(scenario('balcony_balustrade')).toBe('balcony_balustrade')
    expect(scenario('stair_balustrade')).toBe('stair_balustrade')
    expect(scenario('premium_pool_fence')).toBe('pool_fence')
    expect(scenario('unknown')).toBe('other')
  })
})

describe('budgetBandFromEstimate', () => {
  it('uses clamped midpoint thresholds', () => {
    expect(budgetBandFromEstimate(1500, 1800)).toBe('under_2k')
    expect(budgetBandFromEstimate(4100, 5400)).toBe('2k_to_10k')
    expect(budgetBandFromEstimate(11000, 13000)).toBe('10k_to_50k')
    expect(budgetBandFromEstimate(48000, 60000)).toBe('50k_plus')
    expect(budgetBandFromEstimate(Number.NaN, 1000)).toBe('')
  })
})
