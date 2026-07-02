import { createHash } from 'node:crypto'

import { desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  getJobConversationSnapshotHistory,
  type LeadServiceM8History,
} from '@/lib/servicem8/client'
import { quoteAiGenerationFailures, quoteConversationSnapshots, quotes } from '@rgtools/db/schema'
import { AI_GUIDANCE_TIMEOUT_MESSAGE, fetchAiGuidanceOpenAi, isAiGuidanceTimeoutError } from './ai-timeout'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CONVERSATION_SNAPSHOT_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'quote_conversation_snapshot',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'customerEmailSummary',
        'internalNotesSummary',
        'openQuestions',
        'lastKnownPosition',
        'importantDates',
        'decisionMakers',
        'risksBlockers',
      ],
      properties: {
        customerEmailSummary: { type: 'string' },
        internalNotesSummary: { type: 'string' },
        openQuestions: {
          type: 'array',
          items: { type: 'string' },
        },
        lastKnownPosition: { type: 'string' },
        importantDates: {
          type: 'array',
          items: { type: 'string' },
        },
        decisionMakers: {
          type: 'array',
          items: { type: 'string' },
        },
        risksBlockers: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  },
} as const

export type ConversationSnapshotSummary = {
  customerEmailSummary: string
  internalNotesSummary: string
  openQuestions: string[]
  lastKnownPosition: string
  importantDates: string[]
  decisionMakers: string[]
  risksBlockers: string[]
}

export type ConversationSnapshotHistory = LeadServiceM8History & {
  sourceStatus: {
    notes: { ok: boolean; count: number; latestTimestamp: string | null; safeError?: string | null }
    emails: { ok: boolean; count: number; latestTimestamp: string | null; safeError?: string | null }
  }
}

export type ConversationSnapshotQuote = {
  id: string
  servicem8Uuid: string
  clientName: string
  companyName: string | null
  jobDescription: string | null
  jobAddress: string | null
  quoteValue: string | null
  createdAt: Date
}

type SnapshotCursor = {
  latestNoteTimestamp?: string | null
  latestEmailTimestamp?: string | null
}

export type ConversationSnapshotRecord = {
  quoteId: string
  triggeredByUserId: string
  summary: string
  structuredSummary: ConversationSnapshotSummary
  snapshotCursor: SnapshotCursor
  capturedAt: Date
  sourceStatus: 'complete' | 'partial'
  sourceMetadata: {
    fetchedAt: string
    latestNoteTimestamp: string | null
    latestEmailTimestamp: string | null
    noteCount: number
    emailCount: number
    sourceStatus: ConversationSnapshotHistory['sourceStatus']
    sourceHash: string
  }
  safeError: string | null
}

export type ConversationSnapshotDeps = {
  findQuote: (quoteId: string) => Promise<ConversationSnapshotQuote | null>
  findLatestSnapshot: (quoteId: string) => Promise<{ snapshotCursor: unknown } | null>
  fetchHistory: (jobUuid: string) => Promise<ConversationSnapshotHistory>
  summarizeHistory: (input: {
    quote: ConversationSnapshotQuote
    history: LeadServiceM8History
    previousCursor: SnapshotCursor | null
  }) => Promise<unknown>
  insertSnapshot: (record: ConversationSnapshotRecord) => Promise<{ id: string }>
  recordFailure: (input: {
    quoteId: string
    triggeredByUserId: string
    failureStage: string
    errorMessage: string
  }) => Promise<void>
  now: () => Date
}

export type GenerateConversationSnapshotResult =
  | { ok: true; snapshotId: string; partial: boolean }
  | { ok: false; message: string }

export async function generateConversationSnapshotForQuote(
  input: { quoteId: string; triggeredByUserId: string },
  deps: ConversationSnapshotDeps = realConversationSnapshotDeps,
): Promise<GenerateConversationSnapshotResult> {
  if (!UUID_RE.test(input.quoteId) || !UUID_RE.test(input.triggeredByUserId)) {
    return { ok: false, message: 'Tracked Quote not found.' }
  }

  const quote = await deps.findQuote(input.quoteId)
  if (!quote) return { ok: false, message: 'Tracked Quote not found.' }

  const previousSnapshot = await deps.findLatestSnapshot(input.quoteId)
  const previousCursor = parseSnapshotCursor(previousSnapshot?.snapshotCursor ?? null)

  try {
    const fetchedAt = deps.now()
    const historyResult = await deps.fetchHistory(quote.servicem8Uuid)
    const scopedHistory = scopeHistory(historyResult, quote.createdAt, previousCursor)
    const structuredSummary = validateConversationSnapshotSummary(
      await deps.summarizeHistory({
        quote,
        history: scopedHistory,
        previousCursor,
      }),
    )
    const sourceStatus = historyResult.sourceStatus.notes.ok && historyResult.sourceStatus.emails.ok
      ? 'complete'
      : 'partial'
    const safeError = collectSafeErrors(historyResult.sourceStatus)
    const latestNoteTimestamp = historyResult.sourceStatus.notes.latestTimestamp
    const latestEmailTimestamp = historyResult.sourceStatus.emails.latestTimestamp
    const snapshotCursor = { latestNoteTimestamp, latestEmailTimestamp }
    const record: ConversationSnapshotRecord = {
      quoteId: input.quoteId,
      triggeredByUserId: input.triggeredByUserId,
      summary: formatSnapshotSummary(structuredSummary),
      structuredSummary,
      snapshotCursor,
      capturedAt: fetchedAt,
      sourceStatus,
      sourceMetadata: {
        fetchedAt: fetchedAt.toISOString(),
        latestNoteTimestamp,
        latestEmailTimestamp,
        noteCount: historyResult.sourceStatus.notes.count,
        emailCount: historyResult.sourceStatus.emails.count,
        sourceStatus: historyResult.sourceStatus,
        sourceHash: sourceHash(scopedHistory),
      },
      safeError,
    }

    const snapshot = await deps.insertSnapshot(record)
    return { ok: true, snapshotId: snapshot.id, partial: sourceStatus === 'partial' }
  } catch (error) {
    const message = safeErrorMessage(error)
    await deps.recordFailure({
      quoteId: input.quoteId,
      triggeredByUserId: input.triggeredByUserId,
      failureStage: 'conversation_snapshot',
      errorMessage: message,
    })
    return { ok: false, message }
  }
}

export const realConversationSnapshotDeps: ConversationSnapshotDeps = {
  async findQuote(quoteId) {
    const [quote] = await db
      .select({
        id: quotes.id,
        servicem8Uuid: quotes.servicem8Uuid,
        clientName: quotes.clientName,
        companyName: quotes.companyName,
        jobDescription: quotes.jobDescription,
        jobAddress: quotes.jobAddress,
        quoteValue: quotes.quoteValue,
        createdAt: quotes.createdAt,
      })
      .from(quotes)
      .where(eq(quotes.id, quoteId))
      .limit(1)

    return quote ?? null
  },
  async findLatestSnapshot(quoteId) {
    const [snapshot] = await db
      .select({ snapshotCursor: quoteConversationSnapshots.snapshotCursor })
      .from(quoteConversationSnapshots)
      .where(eq(quoteConversationSnapshots.quoteId, quoteId))
      .orderBy(desc(quoteConversationSnapshots.createdAt))
      .limit(1)

    return snapshot ?? null
  },
  async fetchHistory(jobUuid) {
    const history = await getJobConversationSnapshotHistory(jobUuid)
    if (!history.sourceStatus.notes.ok && !history.sourceStatus.emails.ok) {
      throw new Error(collectSafeErrors(history.sourceStatus) ?? 'ServiceM8 history could not be fetched.')
    }
    return history
  },
  summarizeHistory: generateConversationSnapshotSummary,
  async insertSnapshot(record) {
    const [snapshot] = await db
      .insert(quoteConversationSnapshots)
      .values({
        quoteId: record.quoteId,
        triggeredByUserId: record.triggeredByUserId,
        summary: record.summary,
        structuredSummary: record.structuredSummary,
        snapshotCursor: record.snapshotCursor,
        capturedAt: record.capturedAt,
        sourceStatus: record.sourceStatus,
        sourceMetadata: record.sourceMetadata,
        safeError: record.safeError,
      })
      .returning({ id: quoteConversationSnapshots.id })

    if (!snapshot) throw new Error('Conversation Snapshot was not saved')
    return snapshot
  },
  async recordFailure(input) {
    await db.insert(quoteAiGenerationFailures).values({
      quoteId: input.quoteId,
      triggeredByUserId: input.triggeredByUserId,
      failureStage: input.failureStage,
      errorMessage: input.errorMessage,
    })
  },
  now: () => new Date(),
}

function scopeHistory(
  history: LeadServiceM8History,
  quoteCreatedAt: Date,
  previousCursor: SnapshotCursor | null,
): LeadServiceM8History {
  if (previousCursor) {
    return {
      notes: history.notes.filter((note) => isAfterCursor(note.date, previousCursor.latestNoteTimestamp)),
      emails: history.emails.filter((email) => isAfterCursor(email.date, previousCursor.latestEmailTimestamp)),
    }
  }

  const recent = {
    notes: history.notes.filter((note) => isOnOrAfter(note.date, quoteCreatedAt)),
    emails: history.emails.filter((email) => isOnOrAfter(email.date, quoteCreatedAt)),
  }

  return recent.notes.length > 0 || recent.emails.length > 0 ? recent : history
}

function validateConversationSnapshotSummary(value: unknown): ConversationSnapshotSummary {
  if (!value || typeof value !== 'object') throw new Error('Conversation Snapshot summary was not valid JSON')
  const candidate = value as Record<string, unknown>
  const requiredStrings = ['customerEmailSummary', 'internalNotesSummary', 'lastKnownPosition']
  const requiredArrays = ['openQuestions', 'importantDates', 'decisionMakers', 'risksBlockers']

  for (const key of requiredStrings) {
    if (typeof candidate[key] !== 'string') throw new Error(`Conversation Snapshot summary missing ${key}`)
  }
  for (const key of requiredArrays) {
    if (!Array.isArray(candidate[key]) || !(candidate[key] as unknown[]).every((item) => typeof item === 'string')) {
      throw new Error(`Conversation Snapshot summary missing ${key}`)
    }
  }

  return {
    customerEmailSummary: candidate.customerEmailSummary,
    internalNotesSummary: candidate.internalNotesSummary,
    openQuestions: candidate.openQuestions,
    lastKnownPosition: candidate.lastKnownPosition,
    importantDates: candidate.importantDates,
    decisionMakers: candidate.decisionMakers,
    risksBlockers: candidate.risksBlockers,
  } as ConversationSnapshotSummary
}

function formatSnapshotSummary(summary: ConversationSnapshotSummary): string {
  return [summary.customerEmailSummary, summary.internalNotesSummary].filter(Boolean).join('\n\n')
}

async function generateConversationSnapshotSummary(input: {
  quote: ConversationSnapshotQuote
  history: LeadServiceM8History
  previousCursor: SnapshotCursor | null
}): Promise<ConversationSnapshotSummary> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

  const response = await fetchAiGuidanceOpenAi('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o',
      response_format: CONVERSATION_SNAPSHOT_RESPONSE_FORMAT,
      messages: [
        {
          role: 'system',
          content: [
            'Summarise ServiceM8 history for Royal Glass staff as JSON matching the provided schema.',
            'Do not include raw full note or email bodies in the output.',
            'Separate customer/email context from internal notes context.',
            'Use empty arrays when there are no open questions, important dates, decision-makers, or risks/blockers.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify(input),
        },
      ],
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`OpenAI Conversation Snapshot failed with HTTP ${response.status}${body ? `: ${body}` : ''}`)
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> }
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI Conversation Snapshot response did not include JSON')
  return validateConversationSnapshotSummary(JSON.parse(content))
}

function parseSnapshotCursor(value: unknown): SnapshotCursor | null {
  if (!value || typeof value !== 'object') return null
  const cursor = value as Record<string, unknown>
  return {
    latestNoteTimestamp: typeof cursor.latestNoteTimestamp === 'string' ? cursor.latestNoteTimestamp : null,
    latestEmailTimestamp: typeof cursor.latestEmailTimestamp === 'string' ? cursor.latestEmailTimestamp : null,
  }
}

function isOnOrAfter(value: string | null, baseline: Date): boolean {
  if (!value) return false
  const time = Date.parse(value)
  return !Number.isNaN(time) && time >= baseline.getTime()
}

function isAfterCursor(value: string | null, cursorValue: string | null | undefined): boolean {
  if (!value || !cursorValue) return Boolean(value)
  const time = Date.parse(value)
  const cursorTime = Date.parse(cursorValue)
  return !Number.isNaN(time) && !Number.isNaN(cursorTime) && time > cursorTime
}

function sourceHash(history: LeadServiceM8History): string {
  return createHash('sha256').update(JSON.stringify(history)).digest('hex')
}

function collectSafeErrors(status: ConversationSnapshotHistory['sourceStatus']): string | null {
  const errors = [status.notes.safeError, status.emails.safeError].filter(Boolean)
  return errors.length > 0 ? errors.join(' ') : null
}

function safeErrorMessage(error: unknown): string {
  if (isAiGuidanceTimeoutError(error)) return AI_GUIDANCE_TIMEOUT_MESSAGE
  if (error instanceof Error && error.message) return error.message.slice(0, 300)
  return 'Conversation Snapshot generation failed.'
}
