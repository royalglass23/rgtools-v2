import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// `after()` only has a request scope when invoked by the Next runtime; in this
// direct-call unit test we stub it to run the scheduled callback immediately.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: (callback: () => void) => { callback() } }
})

const submitLeadIntakeForUserMock = vi.hoisted(() => vi.fn())
const checkLeadSubmitRateLimitMock = vi.hoisted(() => vi.fn())
const verifyTurnstileTokenMock = vi.hoisted(() => vi.fn())
const sendCustomerEstimateEmailMock = vi.hoisted(() => vi.fn())
const syncLeadToServiceM8Mock = vi.hoisted(() => vi.fn())
const saveLeadSubmitFailureMock = vi.hoisted(() => vi.fn())

vi.mock('@/modules/lead-intake/actions', () => ({
  submitLeadIntakeForUser: submitLeadIntakeForUserMock,
}))

vi.mock('@/modules/lead-intake/anti-spam/rate-limit', () => ({
  checkLeadSubmitRateLimit: checkLeadSubmitRateLimitMock,
}))

vi.mock('@/modules/lead-intake/anti-spam/verify-turnstile', () => ({
  verifyTurnstileToken: verifyTurnstileTokenMock,
}))

vi.mock('@/modules/lead-intake/email/customer-estimate', () => ({
  sendCustomerEstimateEmail: sendCustomerEstimateEmailMock,
}))

vi.mock('@/modules/lead-intake/servicem8/sync', () => ({
  syncLeadToServiceM8: syncLeadToServiceM8Mock,
}))

vi.mock('@/modules/lead-intake/calculator/submit-failures', () => ({
  saveLeadSubmitFailure: saveLeadSubmitFailureMock,
}))

import { OPTIONS, POST } from '../route'

const validPayload = {
  answers: {
    scenario: 'premium_pool_fence',
    length: 12,
    corners: 2,
    gates: 1,
    fixing: 'spigot_round',
    substrate: 'concrete',
    hardware: 'standard_chrome',
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
    notes: '',
    consent: true,
    websiteUrl: '',
  },
  estimate: {
    low: 4100,
    high: 5400,
    subtotal: 4800,
    needsCallUs: false,
    consultationFlags: [],
  },
  loadedAt: Date.now() - 5000,
  turnstileToken: 'token',
}

function request(body: unknown = validPayload, origin = 'https://www.royalglass.co.nz') {
  return new NextRequest('http://localhost/api/lead-intake/calculator-submit', {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10, 10.0.0.2',
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CALCULATOR_ALLOWED_ORIGIN = 'https://www.royalglass.co.nz'
  submitLeadIntakeForUserMock.mockResolvedValue({
    success: true,
    leadId: 'lead-uuid',
    clientId: 'client-uuid',
    matchedExistingClient: false,
    score: 64,
    tier: 'B',
    reason: 'Good fit',
    completeness: 80,
    distanceBand: 'within_30km',
    flagNote: null,
    servicem8Sync: { ok: true, leadId: 'lead-uuid', reference: 'deferred' },
  })
  checkLeadSubmitRateLimitMock.mockResolvedValue({ ok: true, remaining: 9 })
  verifyTurnstileTokenMock.mockResolvedValue({ ok: true, skipped: false })
  sendCustomerEstimateEmailMock.mockResolvedValue({ ok: true })
  syncLeadToServiceM8Mock.mockResolvedValue({ ok: true, leadId: 'lead-uuid', reference: 'RGTools Lead lead-uuid' })
  saveLeadSubmitFailureMock.mockResolvedValue(undefined)
})

describe('OPTIONS /api/lead-intake/calculator-submit', () => {
  it('returns a CORS preflight for the configured calculator origin', async () => {
    const response = await OPTIONS(request())

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://www.royalglass.co.nz')
    expect(response.headers.get('access-control-allow-methods')).toContain('POST')
  })
})

describe('POST /api/lead-intake/calculator-submit', () => {
  it('saves the lead, returns its UUID, and starts email without awaiting it', async () => {
    const neverSettlingEmail = new Promise(() => undefined)
    sendCustomerEstimateEmailMock.mockReturnValue(neverSettlingEmail)

    const response = await POST(request())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://www.royalglass.co.nz')
    expect(json).toEqual({ ok: true, leadId: 'lead-uuid' })
    expect(submitLeadIntakeForUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'calculator',
        projectType: 'pool_fence',
        jobDescription: expect.stringContaining('[Calculator] submitted'),
        leadSource: 'website_google_walk_in_cold_lead',
        cat4: '',
        externalRef: expect.stringMatching(/^calculator:/),
      }),
      null,
      { syncServiceM8: false },
    )
    expect(sendCustomerEstimateEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      leadId: 'lead-uuid',
      to: 'sarah@example.com',
    }))
    // ServiceM8 sync runs in the background (after response) so the lead reaches
    // the SM8 inbox without depending on a cron/retry batch.
    expect(syncLeadToServiceM8Mock).toHaveBeenCalledWith('lead-uuid')
  })

  it('rejects disallowed CORS origins before processing the body', async () => {
    const response = await POST(request(validPayload, 'https://evil.example'))

    expect(response.status).toBe(403)
    expect(submitLeadIntakeForUserMock).not.toHaveBeenCalled()
  })

  it('rejects honeypot submissions', async () => {
    const response = await POST(request({
      ...validPayload,
      lead: { ...validPayload.lead, websiteUrl: 'https://spam.example' },
    }))

    expect(response.status).toBe(403)
    expect(submitLeadIntakeForUserMock).not.toHaveBeenCalled()
    expect(saveLeadSubmitFailureMock).not.toHaveBeenCalled()
  })

  it('rejects submissions that arrive too quickly after load', async () => {
    const response = await POST(request({ ...validPayload, loadedAt: Date.now() - 1000 }))

    expect(response.status).toBe(403)
    expect(submitLeadIntakeForUserMock).not.toHaveBeenCalled()
  })

  it('rejects failed Turnstile verification', async () => {
    verifyTurnstileTokenMock.mockResolvedValue({ ok: false, reason: 'invalid-input-response' })

    const response = await POST(request())

    expect(response.status).toBe(403)
    expect(submitLeadIntakeForUserMock).not.toHaveBeenCalled()
  })

  it('rejects rate-limited IPs', async () => {
    checkLeadSubmitRateLimitMock.mockResolvedValue({ ok: false, retryAfterSeconds: 3600 })

    const response = await POST(request())

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('3600')
    expect(submitLeadIntakeForUserMock).not.toHaveBeenCalled()
  })

  it('dead-letters valid prospect payloads when the Neon save path fails', async () => {
    submitLeadIntakeForUserMock.mockResolvedValue({ error: 'Email is required.' })

    const response = await POST(request())
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('Unable to submit lead')
    expect(saveLeadSubmitFailureMock).toHaveBeenCalledWith(expect.objectContaining({
      ip: '203.0.113.10',
      stage: 'save',
      error: 'Email is required.',
      payload: validPayload,
    }))
  })
})
