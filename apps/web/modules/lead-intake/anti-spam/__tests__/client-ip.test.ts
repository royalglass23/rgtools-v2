import { describe, expect, it } from 'vitest'
import { getClientIp } from '../client-ip'

describe('getClientIp', () => {
  it('uses the first x-forwarded-for hop from Vercel', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.10, 10.0.0.2' })

    expect(getClientIp(headers)).toBe('203.0.113.10')
  })

  it('falls back to an unknown marker when no forwarded IP is present', () => {
    expect(getClientIp(new Headers())).toBe('unknown')
  })
})
