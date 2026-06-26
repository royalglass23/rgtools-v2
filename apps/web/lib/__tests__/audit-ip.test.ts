import { describe, expect, it } from 'vitest'
import { resolveAuditIpAddress } from '../audit-ip'

describe('resolveAuditIpAddress', () => {
  it('prefers Cloudflare client IP over proxy headers', () => {
    const headers = new Headers({
      'cf-connecting-ip': '203.0.113.10',
      'x-forwarded-for': '198.51.100.5',
    })

    expect(resolveAuditIpAddress(headers)).toBe('203.0.113.10')
  })

  it('skips loopback and private forwarded hops', () => {
    const headers = new Headers({
      'x-forwarded-for': '::1, 10.0.0.2, 198.51.100.5',
    })

    expect(resolveAuditIpAddress(headers)).toBe('198.51.100.5')
  })

  it('returns null when only local proxy addresses are available', () => {
    const headers = new Headers({
      'x-real-ip': '127.0.0.1',
      'x-forwarded-for': '::1, 192.168.1.20',
    })

    expect(resolveAuditIpAddress(headers)).toBeNull()
  })
})
