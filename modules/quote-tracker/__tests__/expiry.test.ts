import { describe, expect, it, vi } from 'vitest'

import { isExpired, resolveExpiry } from '../expiry'

describe('resolveExpiry', () => {
  it('resolves the 1h preset relative to now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T00:00:00.000Z'))

    expect(resolveExpiry('1h')).toEqual(new Date('2026-06-16T01:00:00.000Z'))

    vi.useRealTimers()
  })

  it('defaults to 1h relative to now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T00:00:00.000Z'))

    expect(resolveExpiry()).toEqual(new Date('2026-06-16T01:00:00.000Z'))

    vi.useRealTimers()
  })

  it('honors a custom expiry date', () => {
    expect(resolveExpiry({ customDate: '2026-06-20T12:30:00.000Z' })).toEqual(
      new Date('2026-06-20T12:30:00.000Z'),
    )
  })
})

describe('isExpired', () => {
  const now = new Date('2026-06-17T12:00:00.000Z')

  it('is true when the expiry is in the past', () => {
    expect(isExpired(new Date('2026-06-17T11:59:59.000Z'), now)).toBe(true)
  })

  it('is true at exactly the expiry instant', () => {
    expect(isExpired(new Date('2026-06-17T12:00:00.000Z'), now)).toBe(true)
  })

  it('is false when the expiry is in the future', () => {
    expect(isExpired(new Date('2026-06-17T12:00:01.000Z'), now)).toBe(false)
  })

  it('treats a missing date as not expired', () => {
    expect(isExpired(null, now)).toBe(false)
  })
})
