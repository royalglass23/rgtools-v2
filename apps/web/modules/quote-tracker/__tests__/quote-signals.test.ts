import { describe, expect, it } from 'vitest'

import {
  QUOTE_SIGNAL_LABELS,
  classifyQuoteSignal,
  detectSuggestionStaleness,
  type QuoteSignalInput,
} from '../quote-signals'

const baseSignalInput: QuoteSignalInput = {
  quote: {
    id: 'quote-1',
    quoteValue: '4200.00',
    statusTag: 'cold',
    interestScore: 20,
    createdAt: new Date('2026-06-20T00:00:00Z'),
    expiresAt: new Date('2026-07-20T00:00:00Z'),
    archivedAt: null,
    updatedAt: new Date('2026-06-20T00:00:00Z'),
    ownerUserId: 'owner-1',
    clientName: 'Jane Smith',
    companyName: null,
    jobDescription: 'Frameless shower',
    jobAddress: '1 Queen Street',
  },
  engagement: {
    totalOpens: 0,
    uniqueViewers: 0,
    totalTimeMs: 0,
    maxScrollDepth: 0,
    hasDownload: false,
    hasCta: false,
    forwardingSuspected: false,
    hasReturnVisit: false,
    lastOpenedAt: null,
  },
  conversationSnapshot: null,
  now: new Date('2026-06-25T00:00:00Z'),
}

describe('quote signal classification', () => {
  it('classifies strong engagement as High intent for staff', () => {
    const result = classifyQuoteSignal({
      ...baseSignalInput,
      quote: {
        ...baseSignalInput.quote,
        statusTag: 'hot',
        interestScore: 92,
      },
      engagement: {
        ...baseSignalInput.engagement,
        totalOpens: 3,
        uniqueViewers: 1,
        totalTimeMs: 6 * 60 * 1000,
        maxScrollDepth: 96,
        hasDownload: true,
        hasCta: true,
        hasReturnVisit: true,
        lastOpenedAt: new Date('2026-06-24T22:00:00Z'),
      },
    })

    expect(result.bucket).toBe('high_intent')
    expect(result.label).toBe(QUOTE_SIGNAL_LABELS.high_intent)
    expect(result.reasons).toContain('Clicked a call-to-action or downloaded the Quote PDF.')
    expect(result.analyticsSnapshot).toMatchObject({
      bucket: 'high_intent',
      label: 'High intent',
      quote: {
        quoteValue: '4200.00',
        statusTag: 'hot',
        interestScore: 92,
        ownerUserId: 'owner-1',
      },
      engagement: {
        totalOpens: 3,
        maxScrollDepth: 96,
        hasDownload: true,
        hasCta: true,
      },
    })
  })

  it('maps common quote situations to controlled staff signal buckets', () => {
    expect(classifyQuoteSignal({
      ...baseSignalInput,
      now: new Date('2026-06-26T00:00:00Z'),
    }).bucket).toBe('likely_unopened')

    expect(classifyQuoteSignal({
      ...baseSignalInput,
      engagement: {
        ...baseSignalInput.engagement,
        totalOpens: 1,
        uniqueViewers: 1,
        maxScrollDepth: 62,
        lastOpenedAt: new Date('2026-06-24T22:00:00Z'),
      },
    }).bucket).toBe('gentle_nudge')

    expect(classifyQuoteSignal({
      ...baseSignalInput,
      conversationSnapshot: {
        id: 'snapshot-1',
        createdAt: new Date('2026-06-24T00:00:00Z'),
        structuredSummary: {
          lastKnownPosition: 'Customer is waiting for builder confirmation before deciding.',
          openQuestions: [],
          risksBlockers: [],
        },
      },
    }).bucket).toBe('waiting_on_customer_context')

    expect(classifyQuoteSignal({
      ...baseSignalInput,
      engagement: {
        ...baseSignalInput.engagement,
        totalOpens: 1,
        uniqueViewers: 1,
        lastOpenedAt: new Date('2026-06-24T22:00:00Z'),
      },
      conversationSnapshot: {
        id: 'snapshot-2',
        createdAt: new Date('2026-06-24T00:00:00Z'),
        structuredSummary: {
          lastKnownPosition: 'Customer asked whether low iron glass was included.',
          openQuestions: ['Does the quote include low iron glass?'],
          risksBlockers: ['Scope is unclear.'],
        },
      },
    }).bucket).toBe('needs_clarification')

    expect(classifyQuoteSignal({
      ...baseSignalInput,
      quote: {
        ...baseSignalInput.quote,
        archivedAt: new Date('2026-06-24T00:00:00Z'),
      },
    }).bucket).toBe('close_the_loop')

    expect(Object.values(QUOTE_SIGNAL_LABELS)).toEqual([
      'High intent',
      'Gentle nudge',
      'Likely unopened',
      'Waiting on customer context',
      'Needs clarification',
      'Low signal',
      'Close the loop',
    ])
  })

  it('flags saved suggestions stale when meaningful new activity could change the move', () => {
    const saved = classifyQuoteSignal({
      ...baseSignalInput,
      now: new Date('2026-06-26T00:00:00Z'),
    }).analyticsSnapshot

    const result = detectSuggestionStaleness(saved, {
      ...baseSignalInput,
      engagement: {
        ...baseSignalInput.engagement,
        totalOpens: 1,
        uniqueViewers: 1,
        lastOpenedAt: new Date('2026-06-26T03:00:00Z'),
      },
      now: new Date('2026-06-26T03:00:00Z'),
    })

    expect(result).toEqual({
      isStale: true,
      staleAt: '2026-06-26T03:00:00.000Z',
      reasons: [
        'Customer opened the Tracked Quote after likely-unopened guidance.',
        'Signal bucket changed from Likely unopened to Low signal.',
      ],
    })
  })

  it('ignores duplicate opens and tiny scroll changes that do not change the signal', () => {
    const saved = classifyQuoteSignal({
      ...baseSignalInput,
      engagement: {
        ...baseSignalInput.engagement,
        totalOpens: 1,
        uniqueViewers: 1,
        maxScrollDepth: 55,
        lastOpenedAt: new Date('2026-06-24T22:00:00Z'),
      },
    }).analyticsSnapshot

    const result = detectSuggestionStaleness(saved, {
      ...baseSignalInput,
      engagement: {
        ...baseSignalInput.engagement,
        totalOpens: 2,
        uniqueViewers: 1,
        maxScrollDepth: 58,
        lastOpenedAt: new Date('2026-06-25T00:00:05Z'),
      },
      now: new Date('2026-06-25T00:00:05Z'),
    })

    expect(result).toEqual({
      isStale: false,
      staleAt: null,
      reasons: [],
    })
  })
})
