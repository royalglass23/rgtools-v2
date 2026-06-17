import { describe, expect, it } from 'vitest'

import {
  rollupDeviceSessions,
  rollupGatedEmails,
  type AnalyticsEvent,
  type EmailLink,
} from '../viewer-analytics'

function ev(partial: Partial<AnalyticsEvent>): AnalyticsEvent {
  return {
    sessionId: 's1',
    ip: '203.0.113.1',
    geoCity: null,
    geoIsp: null,
    geoCountry: null,
    deviceType: 'mobile',
    eventType: 'page_view',
    pageNumber: null,
    durationMs: null,
    scrollDepth: null,
    createdAt: new Date('2026-06-17T00:00:00Z'),
    ...partial,
  }
}

describe('rollupDeviceSessions', () => {
  it('groups by sessionId, not IP — two sessions on one IP stay separate', () => {
    const result = rollupDeviceSessions([
      ev({ sessionId: 'a', eventType: 'open' }),
      ev({ sessionId: 'b', eventType: 'open' }),
    ])
    expect(result).toHaveLength(2)
  })

  it('sums per-page active time from page_view durations', () => {
    const result = rollupDeviceSessions([
      ev({ sessionId: 'a', eventType: 'page_view', pageNumber: 1, durationMs: null }),
      ev({ sessionId: 'a', eventType: 'page_view', pageNumber: 1, durationMs: 4000 }),
      ev({ sessionId: 'a', eventType: 'page_view', pageNumber: 2, durationMs: 9000 }),
    ])
    expect(result[0].perPage).toEqual([
      { pageNumber: 1, activeMs: 4000 },
      { pageNumber: 2, activeMs: 9000 },
    ])
    expect(result[0].pagesSeen).toBe(2)
  })

  it('counts opens and total time, and flags CTA', () => {
    const result = rollupDeviceSessions([
      ev({ sessionId: 'a', eventType: 'open' }),
      ev({ sessionId: 'a', eventType: 'open' }),
      ev({ sessionId: 'a', eventType: 'close', durationMs: 12000 }),
      ev({ sessionId: 'a', eventType: 'cta' }),
    ])
    expect(result[0].opens).toBe(2)
    expect(result[0].totalTimeMs).toBe(12000)
    expect(result[0].hasCta).toBe(true)
  })

  it('does not fold the close total into per-page time', () => {
    const result = rollupDeviceSessions([
      ev({ sessionId: 'a', eventType: 'page_view', pageNumber: 1, durationMs: 3000 }),
      ev({ sessionId: 'a', eventType: 'close', pageNumber: null, durationMs: 50000 }),
    ])
    expect(result[0].perPage).toEqual([{ pageNumber: 1, activeMs: 3000 }])
  })
})

describe('rollupGatedEmails', () => {
  const links: EmailLink[] = [
    { email: 'a@x.com', name: 'A', sessionId: 'd1' },
    { email: 'a@x.com', name: 'A', sessionId: 'd2' },
    { email: 'b@x.com', name: null, sessionId: 'd3' },
  ]

  it('groups sessions by email and lists their devices', () => {
    const result = rollupGatedEmails(
      [
        ev({ sessionId: 'd1', eventType: 'open' }),
        ev({ sessionId: 'd2', eventType: 'open' }),
        ev({ sessionId: 'd3', eventType: 'open' }),
      ],
      links,
    )
    const a = result.find((r) => r.email === 'a@x.com')!
    const b = result.find((r) => r.email === 'b@x.com')!
    expect(a.devices).toHaveLength(2)
    expect(b.devices).toHaveLength(1)
  })

  it('flags forwarding when an email opened from more than one device', () => {
    const result = rollupGatedEmails(
      [ev({ sessionId: 'd1', eventType: 'open' }), ev({ sessionId: 'd2', eventType: 'open' })],
      links,
    )
    expect(result.find((r) => r.email === 'a@x.com')!.forwardingSuspected).toBe(true)
    expect(result.find((r) => r.email === 'b@x.com')).toBeUndefined()
  })

  it('does not flag forwarding for one device on two IPs', () => {
    const result = rollupGatedEmails(
      [
        ev({ sessionId: 'd3', ip: '1.1.1.1', eventType: 'open' }),
        ev({ sessionId: 'd3', ip: '2.2.2.2', eventType: 'open' }),
      ],
      links,
    )
    expect(result.find((r) => r.email === 'b@x.com')!.forwardingSuspected).toBe(false)
  })

  it('aggregates opens and pages across devices', () => {
    const result = rollupGatedEmails(
      [
        ev({ sessionId: 'd1', eventType: 'open' }),
        ev({ sessionId: 'd1', eventType: 'page_view', pageNumber: 1, durationMs: 1000 }),
        ev({ sessionId: 'd2', eventType: 'open' }),
        ev({ sessionId: 'd2', eventType: 'page_view', pageNumber: 2, durationMs: 1000 }),
      ],
      links,
    )
    const a = result.find((r) => r.email === 'a@x.com')!
    expect(a.opens).toBe(2)
    expect(a.pagesSeen).toBe(2)
  })
})
