import { describe, expect, it } from 'vitest'
import { createMemoryLeadSubmitAttemptStore, checkLeadSubmitRateLimit } from '../rate-limit'

describe('checkLeadSubmitRateLimit', () => {
  it('allows 10 submissions per IP in a sliding hour and rejects the 11th', async () => {
    const store = createMemoryLeadSubmitAttemptStore()
    const now = new Date('2026-06-12T00:00:00.000Z')

    for (let i = 0; i < 10; i += 1) {
      await expect(checkLeadSubmitRateLimit('203.0.113.10', { store, now })).resolves.toEqual({
        ok: true,
        remaining: 9 - i,
      })
    }

    await expect(checkLeadSubmitRateLimit('203.0.113.10', { store, now })).resolves.toEqual({
      ok: false,
      retryAfterSeconds: 3600,
    })
  })

  it('deletes attempts older than one hour before counting', async () => {
    const store = createMemoryLeadSubmitAttemptStore()
    const ip = '203.0.113.10'

    for (let i = 0; i < 10; i += 1) {
      await checkLeadSubmitRateLimit(ip, {
        store,
        now: new Date('2026-06-12T00:00:00.000Z'),
      })
    }

    await expect(checkLeadSubmitRateLimit(ip, {
      store,
      now: new Date('2026-06-12T01:00:01.000Z'),
    })).resolves.toEqual({
      ok: true,
      remaining: 9,
    })
  })
})
