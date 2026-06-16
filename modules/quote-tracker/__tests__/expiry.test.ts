import { describe, expect, it, vi } from 'vitest'

import { resolveExpiry } from '../expiry'

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
