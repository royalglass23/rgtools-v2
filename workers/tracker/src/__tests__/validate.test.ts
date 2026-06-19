import { describe, it, expect } from 'vitest'
import { validatePayload } from '../validate'

describe('validatePayload', () => {
  it('rejects null', () => {
    expect(validatePayload(null)).toBe(false)
  })

  it('rejects missing token', () => {
    expect(validatePayload({ event: 'open', session: 'abc' })).toBe(false)
  })

  it('rejects invalid event type', () => {
    expect(validatePayload({ token: 'abc', event: 'hover', session: 'abc' })).toBe(false)
  })

  it('rejects missing session', () => {
    expect(validatePayload({ token: 'abc', event: 'open' })).toBe(false)
  })

  it('accepts valid open payload', () => {
    expect(validatePayload({ token: 'some-uuid', event: 'open', session: 'session-uuid' })).toBe(true)
  })

  it('accepts valid scroll payload with depth', () => {
    expect(validatePayload({ token: 'uuid', event: 'scroll', session: 'uuid', depth: 75 })).toBe(true)
  })

  it('accepts valid close payload with duration', () => {
    expect(validatePayload({ token: 'uuid', event: 'close', session: 'uuid', duration: 12000 })).toBe(true)
  })

  it('accepts valid page view payload with a page number', () => {
    expect(validatePayload({ token: 'uuid', event: 'page_view', session: 'uuid', pageNumber: 3 })).toBe(true)
  })

  it('accepts page view timing payloads', () => {
    expect(validatePayload({
      token: 'uuid',
      event: 'page_view',
      session: 'uuid',
      pageNumber: 3,
      duration: 12000,
    })).toBe(true)
  })

  it('rejects invalid page numbers', () => {
    expect(validatePayload({ token: 'uuid', event: 'page_view', session: 'uuid', pageNumber: 0 })).toBe(false)
  })

  it('rejects negative duration values', () => {
    expect(validatePayload({
      token: 'uuid',
      event: 'page_view',
      session: 'uuid',
      pageNumber: 3,
      duration: -1,
    })).toBe(false)
  })

  it('accepts download and cta payloads', () => {
    expect(validatePayload({ token: 'uuid', event: 'download', session: 'uuid' })).toBe(true)
    expect(validatePayload({ token: 'uuid', event: 'cta', session: 'uuid', ctaType: 'accept' })).toBe(true)
  })
})
