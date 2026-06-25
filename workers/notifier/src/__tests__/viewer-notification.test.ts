import { describe, it, expect } from 'vitest'
import { findNewViewersToNotify } from '../viewer-notification'

const A = { ipHash: 'ip1', userAgentHash: 'ua1', sessionId: 'sess1', ip: '1.2.3.4' }
const B = { ipHash: 'ip2', userAgentHash: 'ua2', sessionId: 'sess2', ip: '5.6.7.8' }

describe('findNewViewersToNotify', () => {
  it('returns the viewer when a fresh open arrives from a non-internal viewer', () => {
    const result = findNewViewersToNotify([A, B], [])
    expect(result).toEqual([
      { ipHash: 'ip1', userAgentHash: 'ua1' },
      { ipHash: 'ip2', userAgentHash: 'ua2' },
    ])
  })

  it('skips a viewer combo already in notifiedViewers', () => {
    const result = findNewViewersToNotify([A, B], [{ ipHash: 'ip1', userAgentHash: 'ua1' }])
    expect(result).toEqual([{ ipHash: 'ip2', userAgentHash: 'ua2' }])
  })

  it('deduplicates the same combo appearing in multiple events', () => {
    const A2 = { ...A, sessionId: 'sess2' }
    const result = findNewViewersToNotify([A, A2, B], [])
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ ipHash: 'ip1', userAgentHash: 'ua1' })
  })

  it('returns empty array when all viewers are already notified', () => {
    const result = findNewViewersToNotify([A, B], [
      { ipHash: 'ip1', userAgentHash: 'ua1' },
      { ipHash: 'ip2', userAgentHash: 'ua2' },
    ])
    expect(result).toEqual([])
  })

  it('returns empty array for a single session from a single IP (internal-only)', () => {
    const result = findNewViewersToNotify([A], [])
    expect(result).toEqual([])
  })

  it('does not treat two sessions from the same IP as internal-only', () => {
    const A2 = { ...A, sessionId: 'sess2', userAgentHash: 'ua2' }
    const result = findNewViewersToNotify([A, A2], [])
    expect(result).toHaveLength(2)
  })

  it('skips events with null userAgentHash', () => {
    const noUa = { ipHash: 'ip1', userAgentHash: null, sessionId: 'sess1', ip: '1.2.3.4' }
    const result = findNewViewersToNotify([noUa, B], [])
    expect(result).toEqual([{ ipHash: 'ip2', userAgentHash: 'ua2' }])
  })

  it('returns empty array when there are no open events', () => {
    expect(findNewViewersToNotify([], [])).toEqual([])
  })
})
