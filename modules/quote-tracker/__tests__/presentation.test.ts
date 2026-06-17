import { describe, expect, it } from 'vitest'

import { formatDuration, maskIp } from '../presentation'

describe('formatDuration', () => {
  it('formats sub-minute as seconds', () => {
    expect(formatDuration(4500)).toBe('5s')
  })
  it('formats minutes and seconds', () => {
    expect(formatDuration(90_000)).toBe('1m 30s')
  })
  it('formats hours and minutes', () => {
    expect(formatDuration(3_900_000)).toBe('1h 5m')
  })
})

describe('maskIp', () => {
  it('masks the last octet of an IPv4', () => {
    expect(maskIp('203.0.113.42')).toBe('203.0.113.xxx')
  })
  it('returns a dash for null', () => {
    expect(maskIp(null)).toBe('-')
  })
  it('truncates non-IPv4 values', () => {
    expect(maskIp('2001:db8:abcd:0012:0000:0000:0000:0001')).toBe('2001:db8:abc...')
  })
})
