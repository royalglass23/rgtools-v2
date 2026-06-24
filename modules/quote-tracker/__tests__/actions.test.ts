import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.fn()
const createTrackedQuote = vi.fn()
const revalidatePath = vi.fn()
const getExpirySettings = vi.fn()

vi.mock('@/lib/auth', () => ({ auth: () => auth() }))
vi.mock('../create-tracked-quote', () => ({
  createTrackedQuote: (opts: unknown) => createTrackedQuote(opts),
}))
vi.mock('../settings-query', () => ({
  getExpirySettings: () => getExpirySettings(),
}))
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidatePath(path) }))

import { createTrackedQuoteAction } from '../actions'

describe('createTrackedQuoteAction', () => {
  beforeEach(() => {
    auth.mockReset()
    createTrackedQuote.mockReset()
    revalidatePath.mockReset()
    getExpirySettings.mockReset()
    auth.mockResolvedValue({ user: { id: 'user-1' } })
    getExpirySettings.mockResolvedValue({ defaultPreset: '30d' })
  })

  it('rejects an unauthenticated caller', async () => {
    auth.mockResolvedValue(null)

    const result = await createTrackedQuoteAction('R260210')

    expect(result).toEqual({ ok: false, message: 'You must be signed in to create a tracked quote.' })
    expect(createTrackedQuote).not.toHaveBeenCalled()
  })

  it('rejects an empty job id', async () => {
    const result = await createTrackedQuoteAction('   ')

    expect(result).toEqual({ ok: false, message: 'Enter a ServiceM8 job ID.' })
    expect(createTrackedQuote).not.toHaveBeenCalled()
  })

  it('returns the success fields and revalidates the list', async () => {
    const expiresAt = new Date('2026-06-17T12:00:00Z')
    createTrackedQuote.mockResolvedValue({
      ok: true,
      quoteId: 'q1',
      shortCode: 'AB12CD34',
      link: 'https://quotes-worker.example/q/AB12CD34',
      expiresAt,
      clientName: 'Acme Ltd',
      jobAddress: '12 Glass St',
      quoteValue: '100.00',
      storageDriver: 'r2',
    })

    const result = await createTrackedQuoteAction('  R260210 ')

    expect(createTrackedQuote).toHaveBeenCalledWith({
      jobNumber: 'R260210',
      ownerUserId: 'user-1',
      expiry: '30d',
    })
    expect(result).toEqual({
      ok: true,
      link: 'https://quotes-worker.example/q/AB12CD34',
      clientName: 'Acme Ltd',
      jobAddress: '12 Glass St',
      expiresAt,
    })
    expect(revalidatePath).toHaveBeenCalledWith('/quote-tracker')
  })

  it('passes through a job_not_found error and does not revalidate', async () => {
    createTrackedQuote.mockResolvedValue({
      ok: false,
      reason: 'job_not_found',
      message: 'No matching ServiceM8 job found.',
    })

    const result = await createTrackedQuoteAction('R999999')

    expect(result).toEqual({ ok: false, message: 'No matching ServiceM8 job found.' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('passes through a no_quote_pdf error', async () => {
    createTrackedQuote.mockResolvedValue({
      ok: false,
      reason: 'no_quote_pdf',
      message: 'Generate the quote in ServiceM8 first.',
    })

    const result = await createTrackedQuoteAction('R260210')

    expect(result).toEqual({ ok: false, message: 'Generate the quote in ServiceM8 first.' })
  })

  it('passes through quote_exists with the existing link and expiry', async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    createTrackedQuote.mockResolvedValue({
      ok: false,
      reason: 'quote_exists',
      message: 'A live tracked quote already exists for this job.',
      link: 'https://quotes-worker.example/q/EXISTING1',
      expiresAt,
    })

    const result = await createTrackedQuoteAction('R260210')

    expect(result).toEqual({
      ok: false,
      message: 'A live tracked quote already exists for this job.',
      link: 'https://quotes-worker.example/q/EXISTING1',
      expiresAt,
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
