import { describe, expect, it } from 'vitest'
import { buildServiceM8InboxEmail, type ServiceM8LeadSyncRecord } from '../payload'

function leadRecord(overrides: Partial<ServiceM8LeadSyncRecord> = {}): ServiceM8LeadSyncRecord {
  return {
    leadId: 'lead-1',
    servicem8JobUuid: null,
    clientName: 'Aroha Smith',
    companyName: 'Smith Builds',
    phone: '021 123 456',
    email: 'aroha@example.com',
    source: 'phone',
    projectType: 'pool_fence',
    location: '12 Queen Street, Auckland',
    suburb: 'Auckland Central',
    clientProfileKey: 'existing_business',
    budgetBand: '10k_to_50k',
    consentStatus: 'consent_under_review',
    complexity: 'standard_non_custom',
    priceSensitivityRead: 'average_negotiation',
    decisionMakers: 'sole_decision_maker',
    distanceBand: 'within_30km',
    freeText: 'Customer wants a frameless option.',
    seedScore: 82,
    tier: 'A',
    scoreReason: 'Tier A (82): strong fit',
    strikeFlag: 'Blocker flag: remote specialised',
    completeness: 100,
    ...overrides,
  }
}

describe('buildServiceM8LeadPayload', () => {
  it('builds a ServiceM8 inbox email with parser-friendly contact fields', () => {
    const email = buildServiceM8InboxEmail(leadRecord(), ['de9f86@inbox.servicem8.com'])

    expect(email.to).toEqual(['de9f86@inbox.servicem8.com'])
    expect(email.subject).toBe('RGTools Lead - Tier A - Aroha Smith - pool_fence')
    expect(email.body).toContain('Name: Aroha Smith')
    expect(email.body).toContain('Mobile: 021 123 456')
    expect(email.body).toContain('Email: aroha@example.com')
    expect(email.body).toContain('Address: 12 Queen Street, Auckland')
  })

  it('omits optional parser fields when phone and email are missing', () => {
    const email = buildServiceM8InboxEmail(leadRecord({
      phone: null,
      email: null,
      companyName: null,
    }), ['de9f86@inbox.servicem8.com'])

    expect(email.body).toContain('Name: Aroha Smith')
    expect(email.body).not.toContain('Mobile:')
    expect(email.body).not.toContain('Email:')
  })

  it('includes every lead intake field in the ServiceM8 note', () => {
    const email = buildServiceM8InboxEmail(leadRecord(), ['de9f86@inbox.servicem8.com'])

    expect(email.body).toContain('--- RGTools Lead Score ---')
    expect(email.body).toContain('Driving distance: within_30km')
    expect(email.body).toContain('Project type: pool_fence')
    expect(email.body).toContain('Client type: existing_business')
    expect(email.body).toContain('Budget band: 10k_to_50k')
    expect(email.body).toContain('Consent status: consent_under_review')
    expect(email.body).toContain('Complexity: standard_non_custom')
    expect(email.body).toContain('Price-sensitivity read: average_negotiation')
    expect(email.body).toContain('Decision-makers: sole_decision_maker')
    expect(email.body).toContain('Source: phone')
    expect(email.body).toContain('Tier: A')
    expect(email.body).toContain('Score: 82')
    expect(email.body).toContain('Completeness: 100%')
    expect(email.body).toContain('Flag: Blocker flag: remote specialised')
    expect(email.body).toContain('Reason: Tier A (82): strong fit')
    expect(email.body).toContain('Anything else: Customer wants a frameless option.')
  })
})
