// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const latestSnapshotRows = vi.hoisted(() => [] as unknown[])
const latestSuggestionRows = vi.hoisted(() => [] as unknown[])
const latestFailureRows = vi.hoisted(() => [] as unknown[])

vi.mock('drizzle-orm', () => ({
  desc: vi.fn((column: { name?: string }) => ({ direction: 'desc', column: column.name })),
  eq: vi.fn((column: { name?: string }, value: unknown) => ({ type: 'eq', column: column.name, value })),
  and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions })),
}))

vi.mock('@rgtools/db/schema-leads', () => ({
  leads: {
    id: { name: 'leads.id' },
  },
  leadConversationSnapshots: {
    leadId: { name: 'lead_id' },
    createdAt: { name: 'created_at' },
  },
  leadAiSuggestions: {
    leadId: { name: 'lead_id' },
    createdAt: { name: 'created_at' },
  },
  leadAiGenerationFailures: {
    leadId: { name: 'lead_id' },
    createdAt: { name: 'created_at' },
  },
}))

vi.mock('../queries', () => ({ getLeadDetail: vi.fn() }))
vi.mock('../reviewer-notes', () => ({ getLeadReviewerNotes: vi.fn() }))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => {
              if (table === leadConversationSnapshots) return latestSnapshotRows
              if (table === leadAiSuggestions) return latestSuggestionRows
              return latestFailureRows
            }),
          })),
        })),
      })),
    })),
  },
}))

import { getLatestLeadAiGuidance } from '../ai-guidance'
import {
  leadAiSuggestions,
  leadConversationSnapshots,
} from '@rgtools/db/schema-leads'

const leadId = '11111111-1111-4111-8111-111111111111'

describe('getLatestLeadAiGuidance', () => {
  beforeEach(() => {
    latestSnapshotRows.length = 0
    latestSuggestionRows.length = 0
    latestFailureRows.length = 0
  })

  it('returns the latest Lead Conversation Snapshot and AI Suggestion', async () => {
    const snapshot = {
      id: 'snapshot-latest',
      leadId,
      summary: 'Customer needs ensuite shower timing confirmed.',
      createdAt: new Date('2026-07-09T01:00:00Z'),
    }
    const suggestion = {
      id: 'suggestion-latest',
      leadId,
      conversationSnapshotId: snapshot.id,
      recommendedMove: 'call today',
      createdAt: new Date('2026-07-09T01:05:00Z'),
    }
    latestSnapshotRows.push(snapshot)
    latestSuggestionRows.push(suggestion)

    await expect(getLatestLeadAiGuidance(leadId)).resolves.toEqual({
      conversationSnapshot: snapshot,
      aiSuggestion: suggestion,
      generationFailure: null,
    })
  })

  it('returns the latest retryable failure when no newer Lead guidance succeeded', async () => {
    const failure = {
      id: 'failure-latest',
      leadId,
      conversationSnapshotId: 'snapshot-1',
      failureStage: 'ai_suggestion',
      errorMessage: 'AI provider returned HTTP 429.',
      createdAt: new Date('2026-07-09T01:10:00Z'),
    }
    latestFailureRows.push(failure)

    await expect(getLatestLeadAiGuidance(leadId)).resolves.toEqual({
      conversationSnapshot: null,
      aiSuggestion: null,
      generationFailure: failure,
    })
  })

  it('hides a stale failure after a newer Lead AI Suggestion succeeds', async () => {
    const suggestion = {
      id: 'suggestion-newer',
      leadId,
      conversationSnapshotId: 'snapshot-1',
      recommendedMove: 'send follow-up email',
      createdAt: new Date('2026-07-09T02:00:00Z'),
    }
    const failure = {
      id: 'failure-old',
      leadId,
      conversationSnapshotId: 'snapshot-1',
      failureStage: 'ai_suggestion',
      errorMessage: 'Lead AI Suggestion output missing emailDraft',
      createdAt: new Date('2026-07-09T01:55:00Z'),
    }
    latestSuggestionRows.push(suggestion)
    latestFailureRows.push(failure)

    await expect(getLatestLeadAiGuidance(leadId)).resolves.toEqual({
      conversationSnapshot: null,
      aiSuggestion: suggestion,
      generationFailure: null,
    })
  })

  it('returns null records for an invalid lead id', async () => {
    await expect(getLatestLeadAiGuidance('not-a-uuid')).resolves.toEqual({
      conversationSnapshot: null,
      aiSuggestion: null,
      generationFailure: null,
    })
  })
})
