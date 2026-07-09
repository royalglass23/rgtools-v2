import { createHash } from 'node:crypto'

import { desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  getJobConversationSnapshotHistory,
  type ServiceM8ConversationSnapshotHistory,
} from '@/lib/servicem8/client'
import {
  fetchAiGuidanceOpenAi,
  getAiGuidanceCooldown,
  isAiGuidanceTimeoutError,
  runAiGuidanceGeneration,
  type AiGuidanceFailureRecord,
} from '@/modules/ai-guidance/runtime'
import {
  buildServiceM8FileContext,
  type ServiceM8FileContext,
} from '@/modules/ai-guidance/servicem8-file-context'
import { formatDateTime } from '@/modules/quote-tracker/presentation'
import { getLeadDetail } from './queries'
import { getLeadReviewerNotes, type ReviewerNote } from './reviewer-notes'
import {
  leadAiGenerationFailures,
  leadAiSuggestions,
  leadConversationSnapshots,
  leads,
} from '@rgtools/db/schema-leads'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const LEAD_CONVERSATION_SNAPSHOT_PROMPT_VERSION = 'lead-conversation-snapshot-v1'
export const LEAD_CONVERSATION_SNAPSHOT_INPUT_VERSION = 'lead-conversation-snapshot-input-v1'
export const LEAD_AI_SUGGESTION_PROMPT_VERSION = 'lead-ai-guidance-v1'
export const LEAD_AI_SUGGESTION_INPUT_VERSION = 'lead-ai-guidance-input-v1'

const CONFIDENCE_LEVELS = ['Low', 'Medium', 'High'] as const
const RECOMMENDED_MOVES = [
  'call today',
  'send follow-up email',
  'wait',
  'clarify scope',
  'arrange site meeting',
  'send calculator link',
  'nurture',
] as const

const CONVERSATION_SNAPSHOT_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'lead_conversation_snapshot',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'customerNeed',
        'projectSignals',
        'openQuestions',
        'risksBlockers',
        'knownServiceM8Context',
        'interpretedFileSummaries',
        'handoffNotes',
      ],
      properties: {
        customerNeed: { type: 'string' },
        projectSignals: { type: 'array', items: { type: 'string' } },
        openQuestions: { type: 'array', items: { type: 'string' } },
        risksBlockers: { type: 'array', items: { type: 'string' } },
        knownServiceM8Context: { type: 'string' },
        interpretedFileSummaries: { type: 'array', items: { type: 'string' } },
        handoffNotes: { type: 'array', items: { type: 'string' } },
      },
    },
  },
} as const

const AI_SUGGESTION_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'lead_ai_suggestion',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'recommendedMove',
        'suggestedTiming',
        'confidence',
        'confidenceReason',
        'reasoning',
        'emailDraft',
        'phoneTalkingPoints',
        'handoffNotes',
        'partialContextNote',
      ],
      properties: {
        recommendedMove: { type: 'string', enum: RECOMMENDED_MOVES },
        suggestedTiming: { type: 'string' },
        confidence: { type: 'string', enum: CONFIDENCE_LEVELS },
        confidenceReason: { type: 'string' },
        reasoning: { type: 'string' },
        emailDraft: {
          type: 'object',
          additionalProperties: false,
          required: ['subject', 'body'],
          properties: {
            subject: { type: 'string' },
            body: { type: 'string' },
          },
        },
        phoneTalkingPoints: {
          type: 'array',
          minItems: 1,
          items: { type: 'string' },
        },
        handoffNotes: { type: 'string' },
        partialContextNote: { type: ['string', 'null'] },
      },
    },
  },
} as const

export type LeadConversationSnapshotSummary = {
  customerNeed: string
  projectSignals: string[]
  openQuestions: string[]
  risksBlockers: string[]
  knownServiceM8Context: string
  interpretedFileSummaries: string[]
  handoffNotes: string[]
}

export type LeadGuidanceLead = {
  id: string
  clientName: string
  companyName: string | null
  phone?: string | null
  email?: string | null
  location: string | null
  channel?: string | null
  source: string | null
  projectType: string | null
  product?: string | null
  jobDescription?: string | null
  freeText?: string | null
  tier: string | null
  seedScore: number | null
  completeness: number | null
  scoreReason: string | null
  strikeFlag: string | null
  servicem8JobUuid: string | null
  servicem8JobNumber: string | null
  servicem8Status: string | null
  followUpDate: Date | string | null
  scoredFields: Array<{
    category: number
    label: string
    answer: string
    points: number
  }>
}
type SuggestionConfidence = (typeof CONFIDENCE_LEVELS)[number]
type RecommendedMove = (typeof RECOMMENDED_MOVES)[number]

type SnapshotCursor = {
  latestNoteTimestamp?: string | null
  latestEmailTimestamp?: string | null
}

export type LeadConversationSnapshotRecord = {
  leadId: string
  triggeredByUserId: string
  summary: string
  structuredSummary: LeadConversationSnapshotSummary
  snapshotCursor: SnapshotCursor
  sourceStatus: 'complete' | 'partial'
  sourceMetadata: Record<string, unknown>
  safeError: string | null
  capturedAt: Date
  model: string
  promptVersion: string
  inputSnapshotVersion: string
}

export type LeadAiSuggestionOutput = {
  recommendedMove: RecommendedMove
  suggestedTiming: string
  confidence: SuggestionConfidence
  confidenceReason: string
  reasoning: string
  emailDraft: {
    subject: string
    body: string
  }
  phoneTalkingPoints: string[]
  handoffNotes: string
  partialContextNote: string | null
}

export type LeadAiSuggestionRecord = {
  leadId: string
  conversationSnapshotId: string
  triggeredByUserId: string
  recommendedMove: RecommendedMove
  suggestedTiming: string
  confidence: SuggestionConfidence
  confidenceReason: string
  reasoning: string
  emailDraftSubject: string
  emailDraftBody: string
  phoneTalkingPoints: string[]
  handoffNotes: string
  partialContextNote: string | null
  model: string
  promptVersion: string
  inputSnapshotVersion: string
  createdAt: Date
}

export type LeadAiGuidanceDeps = {
  findLead: (leadId: string) => Promise<LeadGuidanceLead | null>
  findReviewerNotes: (leadId: string) => Promise<ReviewerNote[]>
  findLatestSnapshot: (leadId: string) => Promise<{ snapshotCursor: unknown } | null>
  findLatestSuggestion: (leadId: string) => Promise<{ createdAt: Date } | null>
  findLatestFailure: (leadId: string) => Promise<{ retryAfter: Date | null; errorMessage: string } | null>
  fetchHistory: (jobUuid: string) => Promise<ServiceM8ConversationSnapshotHistory>
  buildFileContext: (jobUuid: string) => Promise<ServiceM8FileContext>
  summarizeConversation: (input: LeadConversationSnapshotPromptInput) => Promise<unknown>
  insertSnapshot: (record: LeadConversationSnapshotRecord) => Promise<{ id: string }>
  generateSuggestion: (input: LeadAiSuggestionPromptInput) => Promise<unknown>
  insertSuggestion: (record: LeadAiSuggestionRecord) => Promise<{ id: string }>
  recordFailure: (input: {
    leadId: string
    conversationSnapshotId: string | null
  } & AiGuidanceFailureRecord) => Promise<void>
  updateLeadSuggestion: (input: { leadId: string; text: string; generatedAt: Date }) => Promise<void>
  now: () => Date
  model: string
}

export type LeadConversationSnapshotPromptInput = {
  lead: LeadGuidanceLead
  history: ServiceM8ConversationSnapshotHistory
  reviewerNotes: ReviewerNote[]
  fileContext: ServiceM8FileContext
  previousCursor: SnapshotCursor | null
  generatedAt: string
}

export type LeadAiSuggestionPromptInput = {
  lead: LeadGuidanceLead
  conversationSnapshot: {
    id: string
    sourceStatus: 'complete' | 'partial'
    safeError: string | null
    structuredSummary: LeadConversationSnapshotSummary
  }
  generatedAt: string
}

export type GenerateLeadAiGuidanceResult =
  | { ok: true; snapshotId: string; suggestionId: string; text: string }
  | { ok: false; blocked?: boolean; message: string }

type SavedSnapshotContext = {
  lead: LeadGuidanceLead
  snapshotId: string
  sourceStatus: 'complete' | 'partial'
  safeError: string | null
  structuredSummary: LeadConversationSnapshotSummary
}

export async function generateLeadAiGuidance(
  input: { leadId: string; triggeredByUserId: string },
  deps: LeadAiGuidanceDeps = realLeadAiGuidanceDeps,
): Promise<GenerateLeadAiGuidanceResult> {
  if (!UUID_RE.test(input.leadId) || !UUID_RE.test(input.triggeredByUserId)) {
    return { ok: false, message: 'Lead not found.' }
  }

  const lead = await deps.findLead(input.leadId)
  if (!lead) return { ok: false, message: 'Lead not found.' }
  if (!lead.servicem8JobUuid) {
    return {
      ok: false,
      blocked: true,
      message: 'Link this lead to ServiceM8 to generate AI Guidance.',
    }
  }

  const generatedAt = deps.now()
  const [latestSuggestion, latestFailure] = await Promise.all([
    deps.findLatestSuggestion(input.leadId),
    deps.findLatestFailure(input.leadId),
  ])
  const cooldown = getAiGuidanceCooldown({
    latestSuccessAt: latestSuggestion?.createdAt ?? null,
    latestFailureRetryAfter: latestFailure?.retryAfter ?? null,
    now: generatedAt,
    formatDateTime,
  })
  if (cooldown) return { ok: false, message: cooldown.message }

  const snapshotResult = await createLeadConversationSnapshot({
    lead,
    leadId: input.leadId,
    triggeredByUserId: input.triggeredByUserId,
    generatedAt,
    deps,
  })
  if (!snapshotResult.ok) return { ok: false, message: snapshotResult.message }

  let savedSuggestionText: string | null = null
  const suggestionResult = await runAiGuidanceGeneration<SavedSnapshotContext, LeadAiSuggestionOutput, { id: string }>({
    stage: 'ai_suggestion',
    model: deps.model,
    promptVersion: LEAD_AI_SUGGESTION_PROMPT_VERSION,
    inputSnapshotVersion: LEAD_AI_SUGGESTION_INPUT_VERSION,
    triggeredByUserId: input.triggeredByUserId,
    now: () => generatedAt,
    async buildContext() {
      return snapshotResult.context
    },
    generate: ({ context }) => deps.generateSuggestion({
      lead: context.lead,
      conversationSnapshot: {
        id: context.snapshotId,
        sourceStatus: context.sourceStatus,
        safeError: context.safeError,
        structuredSummary: context.structuredSummary,
      },
      generatedAt: generatedAt.toISOString(),
    }),
    validate: validateLeadAiSuggestionOutput,
    async save({ context, output, metadata }) {
      const partialContextNote = context.sourceStatus === 'partial'
        ? output.partialContextNote ?? context.safeError ?? 'Generated with partial ServiceM8 context.'
        : output.partialContextNote
      const record: LeadAiSuggestionRecord = {
        leadId: input.leadId,
        conversationSnapshotId: context.snapshotId,
        triggeredByUserId: input.triggeredByUserId,
        recommendedMove: output.recommendedMove,
        suggestedTiming: output.suggestedTiming,
        confidence: output.confidence,
        confidenceReason: output.confidenceReason,
        reasoning: output.reasoning,
        emailDraftSubject: output.emailDraft.subject,
        emailDraftBody: output.emailDraft.body,
        phoneTalkingPoints: output.phoneTalkingPoints,
        handoffNotes: output.handoffNotes,
        partialContextNote,
        model: metadata.model,
        promptVersion: metadata.promptVersion,
        inputSnapshotVersion: metadata.inputSnapshotVersion ?? LEAD_AI_SUGGESTION_INPUT_VERSION,
        createdAt: generatedAt,
      }
      const text = formatLeadSuggestionText(output)
      const saved = await deps.insertSuggestion(record)
      await deps.updateLeadSuggestion({
        leadId: input.leadId,
        text,
        generatedAt,
      })
      savedSuggestionText = text
      return saved
    },
    recordFailure: (failure, { context }) => deps.recordFailure({
      ...failure,
      leadId: input.leadId,
      conversationSnapshotId: context?.snapshotId ?? snapshotResult.context.snapshotId,
    }),
    classifyError: classifyLeadAiSuggestionError,
    safeErrorMessage: safeLeadAiSuggestionErrorMessage,
  })

  if (!suggestionResult.ok) return suggestionResult
  return {
    ok: true,
    snapshotId: snapshotResult.context.snapshotId,
    suggestionId: suggestionResult.saved.id,
    text: savedSuggestionText ?? '',
  }
}

export type LatestLeadAiGuidance = {
  conversationSnapshot: typeof leadConversationSnapshots.$inferSelect | null
  aiSuggestion: typeof leadAiSuggestions.$inferSelect | null
  generationFailure: typeof leadAiGenerationFailures.$inferSelect | null
}

export async function getLatestLeadAiGuidance(leadId: string): Promise<LatestLeadAiGuidance> {
  if (!UUID_RE.test(leadId)) {
    return { conversationSnapshot: null, aiSuggestion: null, generationFailure: null }
  }

  const [snapshotRows, suggestionRows, failureRows] = await Promise.all([
    db
      .select()
      .from(leadConversationSnapshots)
      .where(eq(leadConversationSnapshots.leadId, leadId))
      .orderBy(desc(leadConversationSnapshots.createdAt))
      .limit(1),
    db
      .select()
      .from(leadAiSuggestions)
      .where(eq(leadAiSuggestions.leadId, leadId))
      .orderBy(desc(leadAiSuggestions.createdAt))
      .limit(1),
    db
      .select()
      .from(leadAiGenerationFailures)
      .where(eq(leadAiGenerationFailures.leadId, leadId))
      .orderBy(desc(leadAiGenerationFailures.createdAt))
      .limit(1),
  ])

  const conversationSnapshot = snapshotRows[0] ?? null
  const aiSuggestion = suggestionRows[0] ?? null
  const generationFailure = isStaleFailure(failureRows[0] ?? null, conversationSnapshot, aiSuggestion)
    ? null
    : failureRows[0] ?? null

  return { conversationSnapshot, aiSuggestion, generationFailure }
}

export const realLeadAiGuidanceDeps: LeadAiGuidanceDeps = {
  findLead: getLeadDetail,
  findReviewerNotes: getLeadReviewerNotes,
  async findLatestSnapshot(leadId) {
    const [snapshot] = await db
      .select({ snapshotCursor: leadConversationSnapshots.snapshotCursor })
      .from(leadConversationSnapshots)
      .where(eq(leadConversationSnapshots.leadId, leadId))
      .orderBy(desc(leadConversationSnapshots.createdAt))
      .limit(1)
    return snapshot ?? null
  },
  async findLatestSuggestion(leadId) {
    const [suggestion] = await db
      .select({ createdAt: leadAiSuggestions.createdAt })
      .from(leadAiSuggestions)
      .where(eq(leadAiSuggestions.leadId, leadId))
      .orderBy(desc(leadAiSuggestions.createdAt))
      .limit(1)
    return suggestion ?? null
  },
  async findLatestFailure(leadId) {
    const [failure] = await db
      .select({
        retryAfter: leadAiGenerationFailures.retryAfter,
        errorMessage: leadAiGenerationFailures.errorMessage,
      })
      .from(leadAiGenerationFailures)
      .where(eq(leadAiGenerationFailures.leadId, leadId))
      .orderBy(desc(leadAiGenerationFailures.createdAt))
      .limit(1)
    return failure ?? null
  },
  fetchHistory: getJobConversationSnapshotHistory,
  buildFileContext: (jobUuid) => buildServiceM8FileContext({ servicem8JobUuid: jobUuid }),
  summarizeConversation: generateLeadConversationSnapshotJson,
  async insertSnapshot(record) {
    const [snapshot] = await db
      .insert(leadConversationSnapshots)
      .values(record)
      .returning({ id: leadConversationSnapshots.id })
    if (!snapshot) throw new Error('Lead Conversation Snapshot was not saved')
    return snapshot
  },
  generateSuggestion: generateLeadAiSuggestionJson,
  async insertSuggestion(record) {
    const [suggestion] = await db
      .insert(leadAiSuggestions)
      .values(record)
      .returning({ id: leadAiSuggestions.id })
    if (!suggestion) throw new Error('Lead AI Suggestion was not saved')
    return suggestion
  },
  async recordFailure(input) {
    await db.insert(leadAiGenerationFailures).values(input)
  },
  async updateLeadSuggestion(input) {
    await db
      .update(leads)
      .set({
        aiSuggestion: input.text,
        aiSuggestionAt: input.generatedAt,
        updatedAt: input.generatedAt,
      })
      .where(eq(leads.id, input.leadId))
  },
  now: () => new Date(),
  model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
}

async function createLeadConversationSnapshot(input: {
  lead: LeadGuidanceLead
  leadId: string
  triggeredByUserId: string
  generatedAt: Date
  deps: LeadAiGuidanceDeps
}): Promise<
  | { ok: true; context: SavedSnapshotContext }
  | { ok: false; message: string }
> {
  try {
    const previousSnapshot = await input.deps.findLatestSnapshot(input.leadId)
    const previousCursor = parseSnapshotCursor(previousSnapshot?.snapshotCursor ?? null)
    const [history, reviewerNotes, fileContextResult] = await Promise.all([
      input.deps.fetchHistory(input.lead.servicem8JobUuid!),
      input.deps.findReviewerNotes(input.leadId),
      fetchFileContext(input.lead.servicem8JobUuid!, input.deps),
    ])
    const structuredSummary = validateConversationSnapshotSummary(
      await input.deps.summarizeConversation({
        lead: input.lead,
        history,
        reviewerNotes,
        fileContext: fileContextResult.fileContext,
        previousCursor,
        generatedAt: input.generatedAt.toISOString(),
      }),
    )
    const filePartialError = fileContextResult.fileSafeError ?? describePartialFileContext(fileContextResult.fileContext)
    const sourceStatus = history.sourceStatus.notes.ok
      && history.sourceStatus.emails.ok
      && fileContextResult.fileContext.sourceStatus.status === 'complete'
      ? 'complete'
      : 'partial'
    const safeError = collectSafeErrors(history.sourceStatus, filePartialError)
    const latestNoteTimestamp = history.sourceStatus.notes.latestTimestamp
    const latestEmailTimestamp = history.sourceStatus.emails.latestTimestamp
    const record: LeadConversationSnapshotRecord = {
      leadId: input.leadId,
      triggeredByUserId: input.triggeredByUserId,
      summary: formatSnapshotSummary(structuredSummary),
      structuredSummary,
      snapshotCursor: { latestNoteTimestamp, latestEmailTimestamp },
      sourceStatus,
      sourceMetadata: {
        fetchedAt: input.generatedAt.toISOString(),
        latestNoteTimestamp,
        latestEmailTimestamp,
        noteCount: history.sourceStatus.notes.count,
        emailCount: history.sourceStatus.emails.count,
        reviewerNoteCount: reviewerNotes.length,
        fileCount: fileContextResult.fileContext.sourceStatus.total,
        interpretedFileCount: fileContextResult.fileContext.sourceStatus.interpreted,
        unsupportedFileCount: fileContextResult.fileContext.sourceStatus.unsupported,
        failedFileCount: fileContextResult.fileContext.sourceStatus.failed,
        fileContextStatus: fileContextResult.fileContext.sourceStatus,
        partialContext: buildPartialContext(history.sourceStatus, filePartialError),
        sourceStatus: history.sourceStatus,
        sourceHash: sourceHash({ lead: input.lead, history, reviewerNotes, fileContext: fileContextResult.fileContext }),
      },
      safeError,
      capturedAt: input.generatedAt,
      model: input.deps.model,
      promptVersion: LEAD_CONVERSATION_SNAPSHOT_PROMPT_VERSION,
      inputSnapshotVersion: LEAD_CONVERSATION_SNAPSHOT_INPUT_VERSION,
    }
    const snapshot = await input.deps.insertSnapshot(record)
    return {
      ok: true,
      context: {
        lead: input.lead,
        snapshotId: snapshot.id,
        sourceStatus,
        safeError,
        structuredSummary,
      },
    }
  } catch (error) {
    const failure = buildLeadConversationSnapshotFailure({
      error,
      attemptedAt: input.generatedAt,
      triggeredByUserId: input.triggeredByUserId,
      model: input.deps.model,
    })
    await input.deps.recordFailure({
      ...failure,
      leadId: input.leadId,
      conversationSnapshotId: null,
    })
    return { ok: false, message: failure.errorMessage }
  }
}

function buildLeadConversationSnapshotFailure(input: {
  error: unknown
  attemptedAt: Date
  triggeredByUserId: string
  model: string
}): AiGuidanceFailureRecord {
  const errorMessage = safeConversationSnapshotErrorMessage(input.error)
  return {
    triggeredByUserId: input.triggeredByUserId,
    failureStage: 'conversation_snapshot',
    errorType: classifyConversationSnapshotError(input.error),
    errorMessage,
    attemptedAt: input.attemptedAt,
    retryAfter: new Date(input.attemptedAt.getTime() + 60_000),
    model: input.model,
    promptVersion: LEAD_CONVERSATION_SNAPSHOT_PROMPT_VERSION,
    inputSnapshotVersion: LEAD_CONVERSATION_SNAPSHOT_INPUT_VERSION,
  }
}

async function generateLeadConversationSnapshotJson(input: LeadConversationSnapshotPromptInput): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

  const response = await fetchAiGuidanceOpenAi('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: realLeadAiGuidanceDeps.model,
      response_format: CONVERSATION_SNAPSHOT_RESPONSE_FORMAT,
      messages: [
        {
          role: 'system',
          content: [
            'Summarise Royal Glass Lead qualification context as strict JSON.',
            'Use only known facts from the Lead, ServiceM8 notes/emails, interpreted files, and reviewer notes.',
            'Capture customer need, project signals, open questions, risks or blockers, ServiceM8 context, file summaries, and handoff notes.',
            'Do not include raw full email bodies or unsupported promises.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            promptVersion: LEAD_CONVERSATION_SNAPSHOT_PROMPT_VERSION,
            inputSnapshotVersion: LEAD_CONVERSATION_SNAPSHOT_INPUT_VERSION,
            input,
          }),
        },
      ],
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`OpenAI Lead Conversation Snapshot failed with HTTP ${response.status}${body ? `: ${body}` : ''}`)
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> }
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI Lead Conversation Snapshot response did not include JSON')
  return JSON.parse(content)
}

async function generateLeadAiSuggestionJson(input: LeadAiSuggestionPromptInput): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

  const response = await fetchAiGuidanceOpenAi('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: realLeadAiGuidanceDeps.model,
      response_format: AI_SUGGESTION_RESPONSE_FORMAT,
      messages: [
        {
          role: 'system',
          content: [
            'You generate Royal Glass Lead AI Guidance as JSON matching the provided schema.',
            `recommendedMove must be one of: ${RECOMMENDED_MOVES.join(', ')}.`,
            'Use only known facts from the Lead Conversation Snapshot and Lead fields.',
            'Do not invent prices, consent status, deadlines, product specifications, or promises.',
            'Email drafts and phone talking points must avoid unsupported claims and use placeholders when staff must confirm a fact.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            promptVersion: LEAD_AI_SUGGESTION_PROMPT_VERSION,
            inputSnapshotVersion: LEAD_AI_SUGGESTION_INPUT_VERSION,
            input,
          }),
        },
      ],
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`OpenAI Lead AI Suggestion failed with HTTP ${response.status}${body ? `: ${body}` : ''}`)
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> }
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI Lead AI Suggestion response did not include JSON')
  return JSON.parse(content)
}

function validateConversationSnapshotSummary(value: unknown): LeadConversationSnapshotSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Lead Conversation Snapshot output was not valid JSON')
  }
  const candidate = value as Record<string, unknown>
  return {
    customerNeed: requireString(candidate.customerNeed, 'customerNeed', 'Lead Conversation Snapshot'),
    projectSignals: requireStringArray(candidate.projectSignals, 'projectSignals', 'Lead Conversation Snapshot'),
    openQuestions: requireStringArray(candidate.openQuestions, 'openQuestions', 'Lead Conversation Snapshot'),
    risksBlockers: requireStringArray(candidate.risksBlockers, 'risksBlockers', 'Lead Conversation Snapshot'),
    knownServiceM8Context: requireString(candidate.knownServiceM8Context, 'knownServiceM8Context', 'Lead Conversation Snapshot'),
    interpretedFileSummaries: requireStringArray(candidate.interpretedFileSummaries, 'interpretedFileSummaries', 'Lead Conversation Snapshot'),
    handoffNotes: requireStringArray(candidate.handoffNotes, 'handoffNotes', 'Lead Conversation Snapshot'),
  }
}

function validateLeadAiSuggestionOutput(value: unknown): LeadAiSuggestionOutput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Lead AI Suggestion output was not valid JSON')
  }
  const candidate = value as Record<string, unknown>
  const recommendedMove = requireEnum(candidate.recommendedMove, RECOMMENDED_MOVES, 'recommendedMove')
  const confidence = requireEnum(candidate.confidence, CONFIDENCE_LEVELS, 'confidence')
  const emailDraft = candidate.emailDraft
  if (!emailDraft || typeof emailDraft !== 'object' || Array.isArray(emailDraft)) {
    throw new Error('Lead AI Suggestion output missing emailDraft')
  }
  const email = emailDraft as Record<string, unknown>

  return {
    recommendedMove,
    suggestedTiming: requireString(candidate.suggestedTiming, 'suggestedTiming', 'Lead AI Suggestion'),
    confidence,
    confidenceReason: requireString(candidate.confidenceReason, 'confidenceReason', 'Lead AI Suggestion'),
    reasoning: requireString(candidate.reasoning, 'reasoning', 'Lead AI Suggestion'),
    emailDraft: {
      subject: requireString(email.subject, 'emailDraft.subject', 'Lead AI Suggestion'),
      body: requireString(email.body, 'emailDraft.body', 'Lead AI Suggestion'),
    },
    phoneTalkingPoints: requireStringArray(candidate.phoneTalkingPoints, 'phoneTalkingPoints', 'Lead AI Suggestion', { min: 1 }),
    handoffNotes: requireString(candidate.handoffNotes, 'handoffNotes', 'Lead AI Suggestion'),
    partialContextNote: requireNullableString(candidate.partialContextNote, 'partialContextNote'),
  }
}

function requireString(value: unknown, key: string, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} output missing ${key}`)
  }
  return value
}

function requireNullableString(value: unknown, key: string): string | null {
  if (value === null) return null
  if (typeof value === 'string') return value
  throw new Error(`Lead AI Suggestion output missing ${key}`)
}

function requireStringArray(
  value: unknown,
  key: string,
  label: string,
  options: { min?: number } = {},
): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${label} output missing ${key}`)
  }
  if (options.min && value.length < options.min) throw new Error(`${label} output missing ${key}`)
  return value
}

function requireEnum<T extends readonly string[]>(value: unknown, allowed: T, key: string): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(`Lead AI Suggestion output has invalid ${key}`)
  }
  return value as T[number]
}

function formatLeadSuggestionText(output: LeadAiSuggestionOutput): string {
  return `${output.recommendedMove.toUpperCase()}: ${output.suggestedTiming}\n\n${output.reasoning}`
}

function formatSnapshotSummary(summary: LeadConversationSnapshotSummary): string {
  return [
    summary.customerNeed,
    summary.knownServiceM8Context,
    ...summary.handoffNotes,
  ].filter(Boolean).join('\n\n')
}

async function fetchFileContext(
  jobUuid: string,
  deps: Pick<LeadAiGuidanceDeps, 'buildFileContext'>,
): Promise<{ fileContext: ServiceM8FileContext; fileSafeError: string | null }> {
  try {
    return { fileContext: await deps.buildFileContext(jobUuid), fileSafeError: null }
  } catch (error) {
    const message = `ServiceM8 file context could not be fetched: ${safeConversationSnapshotErrorMessage(error)}`
    return {
      fileSafeError: message,
      fileContext: {
        servicem8JobUuid: jobUuid,
        files: [],
        sourceStatus: { status: 'partial', total: 0, interpreted: 0, unsupported: 0, failed: 1 },
      },
    }
  }
}

function describePartialFileContext(fileContext: ServiceM8FileContext): string | null {
  if (fileContext.sourceStatus.status === 'complete') return null
  return `ServiceM8 file context is partial: ${fileContext.sourceStatus.unsupported} unsupported, ${fileContext.sourceStatus.failed} failed.`
}

function buildPartialContext(
  status: ServiceM8ConversationSnapshotHistory['sourceStatus'],
  filePartialError: string | null,
): Record<string, string> {
  const partialContext: Record<string, string> = {}
  if (status.notes.safeError) partialContext.notes = status.notes.safeError
  if (status.emails.safeError) partialContext.emails = status.emails.safeError
  if (filePartialError) partialContext.files = filePartialError
  return partialContext
}

function collectSafeErrors(
  status: ServiceM8ConversationSnapshotHistory['sourceStatus'],
  filePartialError: string | null,
): string | null {
  const errors = [status.notes.safeError, status.emails.safeError, filePartialError].filter(Boolean)
  return errors.length > 0 ? errors.join(' ') : null
}

function parseSnapshotCursor(value: unknown): SnapshotCursor | null {
  if (!value || typeof value !== 'object') return null
  const cursor = value as Record<string, unknown>
  return {
    latestNoteTimestamp: typeof cursor.latestNoteTimestamp === 'string' ? cursor.latestNoteTimestamp : null,
    latestEmailTimestamp: typeof cursor.latestEmailTimestamp === 'string' ? cursor.latestEmailTimestamp : null,
  }
}

function sourceHash(source: unknown): string {
  return createHash('sha256').update(JSON.stringify(source)).digest('hex')
}

function safeConversationSnapshotErrorMessage(error: unknown): string {
  if (isAiGuidanceTimeoutError(error)) return 'AI Guidance took longer than 5 minutes, so it was stopped. Please try again.'
  if (error instanceof SyntaxError) return 'Lead Conversation Snapshot response was not valid JSON.'
  if (error instanceof Error && error.message) {
    const httpMatch = error.message.match(/HTTP\s+(\d{3})/)
    if (httpMatch) return `AI provider returned HTTP ${httpMatch[1]}.`
    return error.message.slice(0, 300)
  }
  return 'Lead Conversation Snapshot generation failed.'
}

function safeLeadAiSuggestionErrorMessage(error: unknown): string {
  if (isAiGuidanceTimeoutError(error)) return 'AI Guidance took longer than 5 minutes, so it was stopped. Please try again.'
  if (error instanceof SyntaxError) return 'Lead AI Suggestion response was not valid JSON.'
  if (error instanceof Error && error.message) {
    const httpMatch = error.message.match(/HTTP\s+(\d{3})/)
    if (httpMatch) return `AI provider returned HTTP ${httpMatch[1]}.`
    return error.message.slice(0, 300)
  }
  return 'Lead AI Suggestion generation failed.'
}

function classifyConversationSnapshotError(error: unknown): string {
  if (isAiGuidanceTimeoutError(error)) return 'timeout'
  if (error instanceof SyntaxError) return 'malformed_json'
  if (!(error instanceof Error)) return 'generation_error'
  if (error.message.includes('OPENAI_API_KEY')) return 'configuration_error'
  if (error.message.includes('HTTP')) return 'ai_response_error'
  if (error.message.includes('was not saved')) return 'save_error'
  if (error.message.startsWith('Lead Conversation Snapshot output')) return 'validation_error'
  return 'generation_error'
}

function classifyLeadAiSuggestionError(error: unknown): string {
  if (isAiGuidanceTimeoutError(error)) return 'timeout'
  if (error instanceof SyntaxError) return 'malformed_json'
  if (!(error instanceof Error)) return 'generation_error'
  if (error.message.includes('OPENAI_API_KEY')) return 'configuration_error'
  if (error.message.includes('HTTP')) return 'ai_response_error'
  if (error.message.includes('was not saved')) return 'save_error'
  if (error.message.startsWith('Lead AI Suggestion output')) return 'validation_error'
  return 'generation_error'
}

function isStaleFailure(
  failure: typeof leadAiGenerationFailures.$inferSelect | null,
  snapshot: typeof leadConversationSnapshots.$inferSelect | null,
  suggestion: typeof leadAiSuggestions.$inferSelect | null,
): boolean {
  if (!failure) return false
  const newestSuccess = [snapshot?.createdAt, suggestion?.createdAt]
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0]
  if (!newestSuccess) return false
  return failure.createdAt <= newestSuccess
}
