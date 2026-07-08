import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.fn()
const expireQuoteLink = vi.fn()
const logAudit = vi.fn()
const revalidatePath = vi.fn()
const requireModule = vi.fn()

vi.mock('@/lib/auth', () => ({ auth: () => auth() }))
vi.mock('@/lib/guard', () => ({ requireModule: (slug: string) => requireModule(slug) }))
vi.mock('../expire-quote-link', () => ({
  expireQuoteLink: (...args: unknown[]) => expireQuoteLink(...args),
}))
vi.mock('@/lib/audit-db', () => ({
  logAudit: (...args: unknown[]) => logAudit(...args),
}))
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidatePath(path) }))

import { expireQuoteLinkAction } from '../actions'

describe('expireQuoteLinkAction', () => {
  beforeEach(() => {
    auth.mockReset()
    expireQuoteLink.mockReset()
    logAudit.mockReset()
    revalidatePath.mockReset()
    requireModule.mockReset()
    auth.mockResolvedValue({ user: { id: 'user-1' } })
    requireModule.mockResolvedValue(undefined)
  })

  it('expires an active quote, logs the audit entry, and revalidates the detail page', async () => {
    expireQuoteLink.mockResolvedValue({ ok: true, clientName: 'Acme Ltd' })

    const result = await expireQuoteLinkAction('quote-1')

    expect(result).toEqual({ ok: true })
    expect(requireModule).toHaveBeenCalledWith('quote-tracker')
    expect(expireQuoteLink).toHaveBeenCalledWith('quote-1')
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        action: 'quote.link_expired',
        targetId: 'quote-1',
        detail: { clientName: 'Acme Ltd' },
      }),
    )
    expect(revalidatePath).toHaveBeenCalledWith('/quote-tracker/quote-1')
  })

  it('rejects an unauthenticated caller', async () => {
    auth.mockResolvedValue(null)

    const result = await expireQuoteLinkAction('quote-1')

    expect(result).toEqual({ ok: false, message: 'You must be signed in.' })
    expect(expireQuoteLink).not.toHaveBeenCalled()
    expect(logAudit).not.toHaveBeenCalled()
  })

  // Covers both "already expired" and "archived" acceptance criteria — both
  // surface as already_inactive from the helper since isActiveLink() handles both.
  it('returns an error and does not log when the link is already inactive', async () => {
    expireQuoteLink.mockResolvedValue({
      ok: false,
      reason: 'already_inactive',
      message: 'This link is already inactive.',
    })

    const result = await expireQuoteLinkAction('quote-1')

    expect(result).toEqual({ ok: false, message: 'This link is already inactive.' })
    expect(logAudit).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('returns an error and does not log when the quote is not found', async () => {
    expireQuoteLink.mockResolvedValue({ ok: false, reason: 'not_found', message: 'Quote not found.' })

    const result = await expireQuoteLinkAction('quote-1')

    expect(result).toEqual({ ok: false, message: 'Quote not found.' })
    expect(logAudit).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
