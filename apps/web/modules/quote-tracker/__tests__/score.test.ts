import { describe, expect, it, vi } from 'vitest'

import { STATUS_TAG_RULES, computeScore, computeStatusTag } from '../score'

describe('quote tracker scoring', () => {
  it('caps score at 100 from engagement signals', () => {
    expect(computeScore({
      totalOpens: 8,
      totalTimeMs: 10 * 60 * 1000,
      maxScrollDepth: 100,
      uniqueSessions: 3,
      uniqueDevices: 2,
      forwardingSuspected: true,
      hasCta: true,
      hasReturnVisit: true,
      createdAt: new Date('2026-06-16T00:00:00.000Z'),
    })).toBe(100)
  })

  it('marks quick deep quote review as hot', () => {
    expect(computeStatusTag({
      totalOpens: 1,
      totalTimeMs: 30 * 1000,
      maxScrollDepth: 75,
      uniqueSessions: 1,
      uniqueDevices: 1,
      forwardingSuspected: false,
      hasCta: false,
      hasReturnVisit: false,
      createdAt: new Date('2026-06-16T00:00:00.000Z'),
    })).toBe('hot')
  })

  it('marks steady mid-depth quote review as hot', () => {
    expect(computeStatusTag({
      totalOpens: 1,
      totalTimeMs: 45 * 1000,
      maxScrollDepth: 50,
      uniqueSessions: 1,
      uniqueDevices: 1,
      forwardingSuspected: false,
      hasCta: false,
      hasReturnVisit: false,
      createdAt: new Date('2026-06-16T00:00:00.000Z'),
    })).toBe('hot')
  })

  it('marks repeat opens with meaningful engagement as hot', () => {
    expect(computeStatusTag({
      totalOpens: 2,
      totalTimeMs: 30 * 1000,
      maxScrollDepth: 20,
      uniqueSessions: 1,
      uniqueDevices: 1,
      forwardingSuspected: false,
      hasCta: false,
      hasReturnVisit: false,
      createdAt: new Date('2026-06-16T00:00:00.000Z'),
    })).toBe('hot')
  })

  it('does not mark repeat accidental opens as hot', () => {
    expect(computeStatusTag({
      totalOpens: 2,
      totalTimeMs: 10 * 1000,
      maxScrollDepth: 20,
      uniqueSessions: 1,
      uniqueDevices: 1,
      forwardingSuspected: false,
      hasCta: false,
      hasReturnVisit: false,
      createdAt: new Date('2026-06-16T00:00:00.000Z'),
    })).toBe('cold')
  })

  it('marks partial quote engagement as warm', () => {
    expect(computeStatusTag({
      totalOpens: 1,
      totalTimeMs: 20 * 1000,
      maxScrollDepth: 30,
      uniqueSessions: 1,
      uniqueDevices: 1,
      forwardingSuspected: false,
      hasCta: false,
      hasReturnVisit: false,
      createdAt: new Date('2026-06-16T00:00:00.000Z'),
    })).toBe('warm')
  })

  it('marks low engagement opens as cold', () => {
    expect(computeStatusTag({
      totalOpens: 1,
      totalTimeMs: 15 * 1000,
      maxScrollDepth: 20,
      uniqueSessions: 1,
      uniqueDevices: 1,
      forwardingSuspected: false,
      hasCta: false,
      hasReturnVisit: false,
      createdAt: new Date('2026-06-16T00:00:00.000Z'),
    })).toBe('cold')
  })

  it('marks unopened quotes older than three days as dead', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T00:00:00.000Z'))

    expect(computeStatusTag({
      totalOpens: 0,
      totalTimeMs: 0,
      maxScrollDepth: 0,
      uniqueSessions: 0,
      uniqueDevices: 0,
      forwardingSuspected: false,
      hasCta: false,
      hasReturnVisit: false,
      createdAt: new Date('2026-06-12T23:59:59.000Z'),
    })).toBe('dead')

    vi.useRealTimers()
  })

  it('exports plain-English status rules for the dashboard', () => {
    expect(STATUS_TAG_RULES.hot).toContain('30+ sec')
    expect(STATUS_TAG_RULES.warm).toContain('20+ sec')
    expect(STATUS_TAG_RULES.cold).toContain('Opened')
    expect(STATUS_TAG_RULES.dead).toContain('Never opened')
  })
})
