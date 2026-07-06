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
    channel: 'phone',
    source: 'existing_client_referral_repeat_builder_architect',
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
    paymentHistory: 'new_client',
    siteAccess: 'easy',
    installationHeight: 'ground_floor_ladder',
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
    expect(email.subject).toBe('RGTools Lead - Leads Quality A - Aroha Smith - Pool Fence')
    expect(email.body).toContain('Name: Aroha Smith')
    expect(email.body).toContain('Company: Smith Builds')
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
    expect(email.body).toContain('Driving distance: Within 30km')
    expect(email.body).toContain('Project type: Pool Fence')
    expect(email.body).toContain('Client type: Existing Business')
    expect(email.body).toContain('Budget band: $10k To $50k')
    expect(email.body).toContain('Consent status: Consent Under Review')
    expect(email.body).toContain('Complexity: Standard Non Custom')
    expect(email.body).toContain('Price-sensitivity read: Average Negotiation')
    expect(email.body).toContain('Decision-makers: Sole Decision Maker')
    expect(email.body).toContain('Source: Existing Client / Referral / Repeat Builder / Architect')
    expect(email.body).toContain('Payment history: New Client')
    expect(email.body).toContain('Site access: Easy')
    expect(email.body).toContain('Installation height: Ground Floor / Ladder')
    expect(email.body).toContain('Channel: Phone')
    expect(email.body).toContain('Leads Quality: A')
    expect(email.body).toContain('Score: 82')
    expect(email.body).toContain('Completeness: 100%')
    expect(email.body).toContain('Flag: Blocker flag: remote specialised')
    expect(email.body).toContain('Reason: Tier A (82): strong fit')
    expect(email.body).toContain('Job description: Customer wants a frameless option.')
    expect(email.body).toContain('Note: Leads Quality A | Score 82 | 100% complete | Tier A (82): strong fit | Blocker flag: remote specialised | RGTools Lead lead-1')
  })
})
