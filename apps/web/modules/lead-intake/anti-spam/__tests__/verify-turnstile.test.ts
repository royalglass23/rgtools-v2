import { beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyTurnstileToken } from '../verify-turnstile'

beforeEach(() => {
  vi.restoreAllMocks()
  delete process.env.TURNSTILE_SECRET
})

describe('verifyTurnstileToken', () => {
  it('skips verification when no secret is configured', async () => {
    const fetchFn = vi.fn()

    await expect(verifyTurnstileToken('token', '203.0.113.10', { fetchFn })).resolves.toEqual({
      ok: true,
      skipped: true,
    })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('posts the token and remote IP to Cloudflare siteverify', async () => {
    process.env.TURNSTILE_SECRET = 'secret'
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })

    await expect(verifyTurnstileToken('token', '203.0.113.10', { fetchFn })).resolves.toEqual({
      ok: true,
      skipped: false,
    })

    const body = fetchFn.mock.calls[0]?.[1]?.body as URLSearchParams
    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(body.get('secret')).toBe('secret')
    expect(body.get('response')).toBe('token')
    expect(body.get('remoteip')).toBe('203.0.113.10')
  })

  it('returns a failed result when Cloudflare rejects the token', async () => {
    process.env.TURNSTILE_SECRET = 'secret'
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    })

    await expect(verifyTurnstileToken('bad-token', '203.0.113.10', { fetchFn })).resolves.toEqual({
      ok: false,
      reason: 'invalid-input-response',
    })
  })
})
