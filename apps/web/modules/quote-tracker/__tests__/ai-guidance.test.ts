// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const latestSnapshotRows = vi.hoisted(() => [] as unknown[])
const latestSuggestionRows = vi.hoisted(() => [] as unknown[])
const latestFailureRows = vi.hoisted(() => [] as unknown[])

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions })),
  desc: vi.fn((column: { name?: string }) => ({ direction: 'desc', column: column.name })),
  eq: vi.fn((column: { name?: string }, value: unknown) => ({ type: 'eq', column: column.name, value })),
}))

vi.mock('@rgtools/db/schema', () => ({
  quoteAiGenerationFailures: {
    quoteId: { name: 'quote_id' },
    failureStage: { name: 'failure_stage' },
    createdAt: { name: 'created_at' },
  },
  quoteAiSuggestions: {
    quoteId: { name: 'quote_id' },
    createdAt: { name: 'created_at' },
  },
  quoteConversationSnapshots: {
    quoteId: { name: 'quote_id' },
    createdAt: { name: 'created_at' },
  },
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn((condition: unknown) => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => {
              if (table === quoteConversationSnapshots) return latestSnapshotRows
              if (table === quoteAiGenerationFailures) {
                return latestFailureRows.filter((row) => matchesCondition(row, condition))
              }
              return latestSuggestionRows
            }),
          })),
        })),
      })),
    })),
  },
}))

function matchesCondition(row: unknown, condition: unknown): boolean {
  if (!condition || typeof condition !== 'object') return true
  const candidate = condition as { type?: string; conditions?: unknown[]; column?: string; value?: unknown }
  if (candidate.type === 'and') return candidate.conditions?.every((item) => matchesCondition(row, item)) ?? true
  if (candidate.type !== 'eq') return true

  const record = row as Record<string, unknown>
  if (candidate.column === 'quote_id') return record.quoteId === candidate.value
  if (candidate.column === 'failure_stage') return record.failureStage === candidate.value
  return true
}

import { getLatestQuoteAiGuidance } from '../ai-guidance'
import { quoteAiGenerationFailures, quoteConversationSnapshots } from '@rgtools/db/schema'

const quoteId = '11111111-1111-4111-8111-111111111111'

describe('getLatestQuoteAiGuidance', () => {
  beforeEach(() => {
    latestSnapshotRows.length = 0
    latestSuggestionRows.length = 0
    latestFailureRows.length = 0
  })

  it('returns the latest Conversation Snapshot and AI Suggestion for a Tracked Quote', async () => {
    const snapshot = {
      id: 'snapshot-latest',
      quoteId,
      summary: 'Customer asked whether the pool fence can be included in the same visit.',
      snapshotCursor: { lastNoteId: 'note-42' },
      capturedAt: new Date('2026-06-29T01:00:00Z'),
      createdAt: new Date('2026-06-29T01:01:00Z'),
    }
    const suggestion = {
      id: 'suggestion-latest',
      quoteId,
      conversationSnapshotId: snapshot.id,
      triggeredByUserId: '22222222-2222-4222-8222-222222222222',
      nextViableMove: 'Call and confirm whether the pool fence is in scope before revising the quote.',
      suggestedWinPath: 'Confirm scope, refresh the quote, then send the tracked link again.',
      createdAt: new Date('2026-06-29T01:05:00Z'),
    }
    latestSnapshotRows.push(snapshot)
    latestSuggestionRows.push(suggestion)

    await expect(getLatestQuoteAiGuidance(quoteId)).resolves.toEqual({
      conversationSnapshot: snapshot,
      aiSuggestion: suggestion,
      generationFailure: null,
    })
  })

  it('returns null records for a Tracked Quote with no saved AI Guidance', async () => {
    await expect(getLatestQuoteAiGuidance(quoteId)).resolves.toEqual({
      conversationSnapshot: null,
      aiSuggestion: null,
      generationFailure: null,
    })
  })

  it('does not query storage for an invalid quote id', async () => {
    await expect(getLatestQuoteAiGuidance('not-a-uuid')).resolves.toEqual({
      conversationSnapshot: null,
      aiSuggestion: null,
      generationFailure: null,
    })
  })

  it('returns the latest retryable Conversation Snapshot failure', async () => {
    const failure = {
      id: 'failure-latest',
      quoteId,
      conversationSnapshotId: null,
      triggeredByUserId: '22222222-2222-4222-8222-222222222222',
      failureStage: 'conversation_snapshot',
      errorMessage: 'ServiceM8 email history could not be fetched.',
      createdAt: new Date('2026-06-29T01:10:00Z'),
    }
    latestFailureRows.push(failure)

    await expect(getLatestQuoteAiGuidance(quoteId)).resolves.toEqual({
      conversationSnapshot: null,
      aiSuggestion: null,
      generationFailure: failure,
    })
  })

  it('returns the latest retryable AI Suggestion failure', async () => {
    const failure = {
      id: 'failure-latest',
      quoteId,
      conversationSnapshotId: 'snapshot-1',
      triggeredByUserId: '22222222-2222-4222-8222-222222222222',
      failureStage: 'ai_suggestion',
      errorType: 'ai_response_error',
      errorMessage: 'AI provider returned HTTP 429.',
      retryAfter: new Date('2026-06-29T01:11:00Z'),
      attemptedAt: new Date('2026-06-29T01:10:00Z'),
      createdAt: new Date('2026-06-29T01:10:00Z'),
    }
    latestFailureRows.push(failure)

    await expect(getLatestQuoteAiGuidance(quoteId)).resolves.toEqual({
      conversationSnapshot: null,
      aiSuggestion: null,
      generationFailure: failure,
    })
  })

  it('hides a stale Conversation Snapshot failure after a newer snapshot succeeds', async () => {
    const snapshot = {
      id: 'snapshot-latest',
      quoteId,
      summary: 'The latest snapshot saved successfully.',
      snapshotCursor: { lastNoteId: 'note-44' },
      capturedAt: new Date('2026-06-29T02:25:00Z'),
      createdAt: new Date('2026-06-29T02:25:00Z'),
    }
    const failure = {
      id: 'failure-old',
      quoteId,
      conversationSnapshotId: null,
      triggeredByUserId: '22222222-2222-4222-8222-222222222222',
      failureStage: 'conversation_snapshot',
      errorMessage: 'Conversation Snapshot summary missing customerEmailSummary',
      createdAt: new Date('2026-06-29T02:20:00Z'),
    }
    latestSnapshotRows.push(snapshot)
    latestFailureRows.push(failure)

    await expect(getLatestQuoteAiGuidance(quoteId)).resolves.toEqual({
      conversationSnapshot: snapshot,
      aiSuggestion: null,
      generationFailure: null,
    })
  })
})
