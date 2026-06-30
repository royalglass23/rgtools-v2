// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuth = vi.hoisted(() => vi.fn())
const mockImportLead = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/modules/leads/servicem8-fetch', () => ({
  importLeadFromServiceM8JobNumber: mockImportLead,
}))

import { importServiceM8LeadAction } from '../actions'

// Advance fake time by 11 s in each beforeEach so any cooldown from a prior
// test has expired before the next one starts.
let currentFakeTime = new Date('2026-01-01T00:00:00.000Z').getTime()

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  currentFakeTime += 11_000
  vi.setSystemTime(currentFakeTime)
  mockAuth.mockResolvedValue({ user: { id: 'actor-1' } })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('importServiceM8LeadAction', () => {
  it('returns { ok: false } for unauthenticated call', async () => {
    mockAuth.mockResolvedValue(null)

    const result = await importServiceM8LeadAction('Q260004')

    expect(result).toEqual({ ok: false, message: 'Sign in to import from ServiceM8.' })
    expect(mockImportLead).not.toHaveBeenCalled()
  })

  it('returns a lead detail redirect path after a successful import', async () => {
    mockImportLead.mockResolvedValue({
      ok: true,
      leadId: 'lead-1',
      message: 'Imported job Q260004.',
      missingContact: false,
      reusedExisting: false,
    })

    const result = await importServiceM8LeadAction('Q260004')

    expect(mockImportLead).toHaveBeenCalledWith('Q260004', 'actor-1')
    expect(result).toEqual({
      ok: true,
      redirectPath: '/leads/lead-1',
      message: 'Imported job Q260004.',
      missingContact: false,
      reusedExisting: false,
    })
  })

  it('returns the ServiceM8 rejection message without a redirect', async () => {
    mockImportLead.mockResolvedValue({
      ok: false,
      reason: 'not_quote',
      message: 'ServiceM8 job Q260005 is Work Order, not Quote. Import a Quote job only.',
    })

    await expect(importServiceM8LeadAction('Q260005')).resolves.toEqual({
      ok: false,
      message: 'ServiceM8 job Q260005 is Work Order, not Quote. Import a Quote job only.',
    })
  })

  it('rate-limits rapid successive imports for the same user', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'rate-limit-test-user' } })
    mockImportLead.mockResolvedValue({
      ok: true,
      leadId: 'lead-1',
      message: 'Imported.',
      missingContact: false,
      reusedExisting: false,
    })

    await importServiceM8LeadAction('Q260010') // first call — sets cooldown
    const result = await importServiceM8LeadAction('Q260011') // immediate second

    expect(result).toEqual({ ok: false, message: 'Please wait a moment before importing again.' })
    expect(mockImportLead).toHaveBeenCalledTimes(1)
  })

  it('lets an immediate reused-existing import open the existing lead instead of showing the cooldown', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'reuse-existing-user' } })
    mockImportLead
      .mockResolvedValueOnce({
        ok: true,
        leadId: 'lead-1',
        message: 'Imported.',
        missingContact: false,
        reusedExisting: false,
      })
      .mockResolvedValueOnce({
        ok: true,
        leadId: 'lead-1',
        message: 'Opened existing lead for job Q260010.',
        missingContact: false,
        reusedExisting: true,
      })

    await importServiceM8LeadAction('Q260010')
    const result = await importServiceM8LeadAction('Q260010')

    expect(mockImportLead).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      ok: true,
      redirectPath: '/leads/lead-1',
      message: 'Opened existing lead for job Q260010.',
      missingContact: false,
      reusedExisting: true,
    })
  })
})
