// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { classifyQuoteSignal } from '../quote-signals'
import { generateAiSuggestionForQuote, realAiSuggestionDeps, type AiSuggestionDeps } from '../ai-suggestion'

const quoteId = '11111111-1111-4111-8111-111111111111'
const userId = '22222222-2222-4222-8222-222222222222'
const snapshotId = '33333333-3333-4333-8333-333333333333'

function deps(overrides: Partial<AiSuggestionDeps> = {}): AiSuggestionDeps {
  return {
    findQuote: vi.fn(async () => ({
      id: quoteId,
      quoteValue: '4200.00',
      statusTag: 'hot' as const,
      interestScore: 92,
      createdAt: new Date('2026-06-20T00:00:00Z'),
      expiresAt: new Date('2026-07-20T00:00:00Z'),
      archivedAt: null,
      updatedAt: new Date('2026-06-24T00:00:00Z'),
      ownerUserId: userId,
      clientName: 'Jane Smith',
      companyName: 'Smith Renovations',
      jobDescription: 'Frameless shower',
      jobAddress: '1 Queen Street',
      shortCode: 'abc123',
    })),
    findEngagement: vi.fn(async () => ({
      totalOpens: 3,
      uniqueViewers: 1,
      totalTimeMs: 6 * 60 * 1000,
      maxScrollDepth: 96,
      hasDownload: true,
      hasCta: false,
      forwardingSuspected: false,
      hasReturnVisit: true,
      lastOpenedAt: new Date('2026-06-24T22:00:00Z'),
    })),
    findLatestConversationSnapshot: vi.fn(async () => ({
      id: snapshotId,
      createdAt: new Date('2026-06-24T00:00:00Z'),
      sourceStatus: 'complete',
      safeError: null,
      structuredSummary: {
        customerEmailSummary: 'Jane asked whether low iron glass can be included.',
        internalNotesSummary: 'Install timing before July is the key internal follow-up.',
        openQuestions: ['Can Royal Glass install before July?'],
        lastKnownPosition: 'Customer is reviewing the quote details.',
        importantDates: ['before July'],
        decisionMakers: ['Jane Smith'],
        risksBlockers: ['Timing may decide the job.'],
      },
    })),
    findLatestFailure: vi.fn(async () => null),
    generateSuggestion: vi.fn(async () => ({
      nextViableMove: 'Call today to confirm timing and low iron glass scope.',
      recommendedMove: 'call today',
      suggestedTiming: 'Today before 4pm',
      timingReason: 'The customer has returned and downloaded the quote.',
      confidence: 'High',
      confidenceReason: 'High engagement and a clear open question are both present.',
      likelyCustomerState: 'Interested and checking whether scope and timing work.',
      reasoning: 'Strong engagement plus a specific scope question makes a call useful.',
      emailDraft: {
        subject: 'Frameless shower quote timing',
        body: 'Hi Jane, I saw you had a chance to review the quote. Happy to confirm low iron glass and timing today.',
        includeQuoteLink: true,
      },
      phoneTalkingPoints: [
        'Confirm whether low iron glass should be included.',
        'Ask whether install before July is the key decision point.',
      ],
      suggestedWinPath: 'Confirm scope, update the quote if needed, then resend the tracked link.',
      useCareGuidance: 'Do not imply the customer has been personally tracked.',
      partialContextNote: null,
      waitRecommendation: null,
    })),
    insertSuggestion: vi.fn(async () => ({ id: 'suggestion-1' })),
    recordFailure: vi.fn(async () => undefined),
    now: () => new Date('2026-06-25T00:00:00Z'),
    model: 'gpt-4o-mini',
    ...overrides,
  }
}

describe('generateAiSuggestionForQuote', () => {
  it('saves a validated structured Next Viable Move from mocked AI output', async () => {
    const d = deps()

    const result = await generateAiSuggestionForQuote({ quoteId, triggeredByUserId: userId }, d)

    expect(result).toEqual({ ok: true, suggestionId: 'suggestion-1' })
    expect(d.generateSuggestion).toHaveBeenCalledWith(expect.objectContaining({
      quote: expect.objectContaining({
        clientName: 'Jane Smith',
        companyName: 'Smith Renovations',
        jobDescription: 'Frameless shower',
      }),
      signal: expect.objectContaining({
        bucket: 'high_intent',
        label: 'High intent',
      }),
      conversationSnapshot: expect.objectContaining({
        id: snapshotId,
        structuredSummary: expect.objectContaining({
          lastKnownPosition: 'Customer is reviewing the quote details.',
        }),
      }),
    }))
    expect(d.insertSuggestion).toHaveBeenCalledWith(expect.objectContaining({
      quoteId,
      conversationSnapshotId: snapshotId,
      triggeredByUserId: userId,
      signalBucket: 'high_intent',
      signalLabel: 'High intent',
      recommendedMove: 'call today',
      nextViableMove: 'Call today to confirm timing and low iron glass scope.',
      suggestedTiming: 'Today before 4pm',
      timingReason: 'The customer has returned and downloaded the quote.',
      confidence: 'High',
      confidenceReason: 'High engagement and a clear open question are both present.',
      likelyCustomerState: 'Interested and checking whether scope and timing work.',
      reasoning: 'Strong engagement plus a specific scope question makes a call useful.',
      emailDraftSubject: 'Frameless shower quote timing',
      includeQuoteLink: true,
      phoneTalkingPoints: [
        'Confirm whether low iron glass should be included.',
        'Ask whether install before July is the key decision point.',
      ],
      suggestedWinPath: 'Confirm scope, update the quote if needed, then resend the tracked link.',
      useCareGuidance: 'Do not imply the customer has been personally tracked.',
      model: 'gpt-4o-mini',
      promptVersion: 'quote-ai-guidance-v1',
      inputSnapshotVersion: 'quote-ai-guidance-input-v1',
      createdAt: new Date('2026-06-25T00:00:00Z'),
    }))
  })

  it('creates a new AI Suggestion row each time staff regenerates guidance', async () => {
    const d = deps({
      insertSuggestion: vi.fn()
        .mockResolvedValueOnce({ id: 'suggestion-1' })
        .mockResolvedValueOnce({ id: 'suggestion-2' }),
    })

    await expect(generateAiSuggestionForQuote({ quoteId, triggeredByUserId: userId }, d))
      .resolves.toEqual({ ok: true, suggestionId: 'suggestion-1' })
    await expect(generateAiSuggestionForQuote({ quoteId, triggeredByUserId: userId }, d))
      .resolves.toEqual({ ok: true, suggestionId: 'suggestion-2' })

    expect(d.insertSuggestion).toHaveBeenCalledTimes(2)
    expect(d.insertSuggestion).toHaveBeenNthCalledWith(1, expect.objectContaining({ quoteId }))
    expect(d.insertSuggestion).toHaveBeenNthCalledWith(2, expect.objectContaining({ quoteId }))
  })

  it('records a failure and does not save malformed AI output', async () => {
    const d = deps({
      generateSuggestion: vi.fn(async () => ({
        nextViableMove: 'Call today.',
        recommendedMove: 'call today',
        confidence: '94%',
      })),
    })

    const result = await generateAiSuggestionForQuote({ quoteId, triggeredByUserId: userId }, d)

    expect(result).toEqual({ ok: false, message: 'AI Suggestion output has invalid confidence' })
    expect(d.insertSuggestion).not.toHaveBeenCalled()
    expect(d.recordFailure).toHaveBeenCalledWith({
      quoteId,
      conversationSnapshotId: snapshotId,
      triggeredByUserId: userId,
      failureStage: 'ai_suggestion',
      errorType: 'validation_error',
      errorMessage: 'AI Suggestion output has invalid confidence',
      attemptedAt: new Date('2026-06-25T00:00:00Z'),
      retryAfter: new Date('2026-06-25T00:01:00Z'),
    })
  })

  it('blocks repeated AI suggestion generation until the failure cooldown expires', async () => {
    const d = deps({
      findLatestFailure: vi.fn(async () => ({
        retryAfter: new Date('2026-06-25T00:01:00Z'),
        errorMessage: 'AI provider returned HTTP 429.',
      })),
    })

    const result = await generateAiSuggestionForQuote({ quoteId, triggeredByUserId: userId }, d)

    expect(result).toEqual({
      ok: false,
      message: 'AI Guidance can be retried after 25 Jun 2026, 12:01 pm.',
    })
    expect(d.generateSuggestion).not.toHaveBeenCalled()
    expect(d.insertSuggestion).not.toHaveBeenCalled()
    expect(d.recordFailure).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'missing AI configuration',
      overrides: {
        generateSuggestion: vi.fn(async () => {
          throw new Error('OPENAI_API_KEY is not configured')
        }),
      },
      message: 'OPENAI_API_KEY is not configured',
      errorType: 'configuration_error',
    },
    {
      name: 'AI non-2xx response',
      overrides: {
        generateSuggestion: vi.fn(async () => {
          throw new Error('OpenAI AI Suggestion failed with HTTP 500: upstream unavailable')
        }),
      },
      message: 'AI provider returned HTTP 500.',
      errorType: 'ai_response_error',
    },
    {
      name: 'malformed JSON',
      overrides: {
        generateSuggestion: vi.fn(async () => {
          throw new SyntaxError('Unexpected token')
        }),
      },
      message: 'AI Suggestion response was not valid JSON.',
      errorType: 'malformed_json',
    },
    {
      name: 'AI timeout',
      overrides: {
        generateSuggestion: vi.fn(async () => {
          throw Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' })
        }),
      },
      message: 'AI Guidance took longer than 5 minutes, so it was stopped. Please try again.',
      errorType: 'timeout',
    },
    {
      name: 'persistence failure',
      overrides: {
        insertSuggestion: vi.fn(async () => {
          throw new Error('AI Suggestion was not saved')
        }),
      },
      message: 'AI Suggestion was not saved',
      errorType: 'save_error',
    },
  ])('records a retryable failed attempt for $name', async ({ overrides, message, errorType }) => {
    const d = deps(overrides)

    const result = await generateAiSuggestionForQuote({ quoteId, triggeredByUserId: userId }, d)

    expect(result).toEqual({ ok: false, message })
    expect(d.recordFailure).toHaveBeenCalledWith(expect.objectContaining({
      quoteId,
      conversationSnapshotId: snapshotId,
      triggeredByUserId: userId,
      failureStage: 'ai_suggestion',
      errorType,
      errorMessage: message,
      retryAfter: new Date('2026-06-25T00:01:00Z'),
    }))
  })

  it('requests a strict AI Suggestion JSON schema from OpenAI', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    const d = deps()
    const quote = await d.findQuote(quoteId)
    const engagement = await d.findEngagement(quoteId)
    const conversationSnapshot = await d.findLatestConversationSnapshot(quoteId)
    if (!quote) throw new Error('missing test quote')
    const signal = classifyQuoteSignal({
      quote,
      engagement,
      conversationSnapshot: {
        id: snapshotId,
        createdAt: new Date('2026-06-24T00:00:00Z'),
        structuredSummary: {
          openQuestions: ['Can Royal Glass install before July?'],
          risksBlockers: ['Timing may decide the job.'],
          lastKnownPosition: 'Customer is reviewing the quote details.',
        },
      },
      now: new Date('2026-06-25T00:00:00Z'),
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              nextViableMove: 'Call today to confirm timing and low iron glass scope.',
              recommendedMove: 'call today',
              suggestedTiming: 'Today before 4pm',
              timingReason: 'The customer has returned and downloaded the quote.',
              confidence: 'High',
              confidenceReason: 'High engagement and a clear open question are both present.',
              likelyCustomerState: 'Interested and checking whether scope and timing work.',
              reasoning: 'Strong engagement plus a specific scope question makes a call useful.',
              emailDraft: {
                subject: 'Frameless shower quote timing',
                body: 'Hi Jane, happy to confirm low iron glass and timing today.',
                includeQuoteLink: true,
              },
              phoneTalkingPoints: ['Confirm whether low iron glass should be included.'],
              suggestedWinPath: 'Confirm scope, update the quote if needed, then resend the tracked link.',
              useCareGuidance: 'Do not imply the customer has been personally tracked.',
              partialContextNote: null,
              waitRecommendation: null,
            }),
          },
        }],
      }),
      text: async () => '',
    } as Response)

    await realAiSuggestionDeps.generateSuggestion({
      quote,
      engagement,
      signal,
      conversationSnapshot,
      generatedAt: '2026-06-25T00:00:00.000Z',
    })

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body?.toString() ?? '{}')
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
    expect(requestBody.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: {
        name: 'quote_ai_suggestion',
        strict: true,
        schema: {
          required: expect.arrayContaining(['nextViableMove', 'recommendedMove', 'emailDraft']),
        },
      },
    })
  })
})
