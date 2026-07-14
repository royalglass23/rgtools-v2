import type { LatestLeadAiGuidance } from './ai-guidance'
import { AiGuidanceSubmitButton } from '@/modules/quote-tracker/AiGuidanceSubmitButton'
import { CopyLinkButton } from '@/modules/quote-tracker/CopyLinkButton'
import { formatDateTime } from '@/modules/quote-tracker/presentation'
import { DismissibleNotice } from '@/modules/ui/DismissibleNotice'

const AI_GUIDANCE_REGENERATION_COOLDOWN_MS = 5 * 60 * 1000

export function LeadAiGuidancePanel({
  guidance,
  leadId,
  generateGuidanceAction,
  generationDisabledReason,
}: {
  guidance: LatestLeadAiGuidance
  leadId?: string
  generateGuidanceAction?: (formData: FormData) => void | Promise<void>
  generationDisabledReason?: string
}) {
  const hasSavedGuidance = Boolean(guidance.conversationSnapshot || guidance.aiSuggestion)
  const hasFailure = Boolean(guidance.generationFailure)
  const actionLabel = guidance.generationFailure
    ? 'Retry and regenerate'
    : guidance.aiSuggestion
      ? 'Regenerate'
      : 'Generate'
  const disabledUntil = guidance.aiSuggestion
    ? new Date(guidance.aiSuggestion.createdAt.getTime() + AI_GUIDANCE_REGENERATION_COOLDOWN_MS)
    : null
  const canGenerate = Boolean(generateGuidanceAction && leadId && !generationDisabledReason)

  return (
    <details
      data-testid="lead-ai-guidance-details"
      open={hasSavedGuidance || hasFailure}
      className="space-y-3 rounded border border-gray-200 bg-white p-5 shadow-sm"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <div>
          <h2 className="text-base font-semibold text-gray-950">AI Guidance</h2>
          {!hasSavedGuidance && (
            <p className="mt-1 text-sm text-gray-600">No Conversation Snapshot or AI Suggestion saved yet.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canGenerate ? (
            <form action={generateGuidanceAction}>
              <input type="hidden" name="leadId" value={leadId} />
              <AiGuidanceSubmitButton label={actionLabel} disabledUntil={disabledUntil} />
            </form>
          ) : (
            <button
              type="button"
              disabled
              className="rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-500"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </summary>

      {(hasSavedGuidance || hasFailure || generationDisabledReason) && (
        <div className="space-y-4 border-t border-gray-200 pt-4">
          {generationDisabledReason && (
            <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {generationDisabledReason}
            </p>
          )}
          {guidance.generationFailure && (
            <DismissibleNotice tone="error" noticeKey={`${guidance.generationFailure.createdAt.toISOString()}:${guidance.generationFailure.errorMessage}`}>
              Last {formatFailureStage(guidance.generationFailure.failureStage)} attempt failed: {guidance.generationFailure.errorMessage}
              {guidance.generationFailure.retryAfter && (
                <>
                  <br />
                  Retry available after {formatDateTime(guidance.generationFailure.retryAfter)}.
                </>
              )}
            </DismissibleNotice>
          )}
          {guidance.conversationSnapshot?.sourceStatus === 'partial' && guidance.conversationSnapshot.safeError && (
            <DismissibleNotice tone="warning" noticeKey={guidance.conversationSnapshot.safeError}>
              Partial context: {guidance.conversationSnapshot.safeError}
            </DismissibleNotice>
          )}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="space-y-3 border-l-2 border-blue-200 pl-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-950">Conversation Snapshot</h3>
                <p className="text-xs text-gray-500">
                  Captured {formatDateTime(guidance.conversationSnapshot?.capturedAt ?? null)}
                </p>
              </div>
              {guidance.conversationSnapshot ? (
                <>
                  <SnapshotFields
                    structuredSummary={guidance.conversationSnapshot.structuredSummary}
                    fallbackSummary={guidance.conversationSnapshot.summary}
                  />
                  <SnapshotMetadataFields
                    sourceStatus={guidance.conversationSnapshot.sourceStatus}
                    sourceMetadata={guidance.conversationSnapshot.sourceMetadata}
                  />
                </>
              ) : (
                <p className="text-sm text-gray-600">No Conversation Snapshot saved yet.</p>
              )}
            </section>

            <section className="space-y-3 border-l-2 border-green-200 pl-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-950">AI Suggestion</h3>
                <p className="text-xs text-gray-500">
                  Created {formatDateTime(guidance.aiSuggestion?.createdAt ?? null)}
                </p>
              </div>
              {guidance.aiSuggestion ? (
                <dl className="space-y-3">
                  <Field label="Recommended Move" value={formatRecommendedMove(guidance.aiSuggestion.recommendedMove)} />
                  <Field label="Suggested Timing" value={guidance.aiSuggestion.suggestedTiming} />
                  <Field label="Confidence" value={`${guidance.aiSuggestion.confidence}\n${guidance.aiSuggestion.confidenceReason}`} />
                  <Field label="Why This Move" value={guidance.aiSuggestion.reasoning} />
                  {guidance.aiSuggestion.partialContextNote && (
                    <Field label="Partial Context" value={guidance.aiSuggestion.partialContextNote} />
                  )}
                  <EmailDraft
                    subject={guidance.aiSuggestion.emailDraftSubject}
                    body={guidance.aiSuggestion.emailDraftBody}
                  />
                  <ListField label="Phone Talking Points" values={formatStringList(guidance.aiSuggestion.phoneTalkingPoints)} />
                  <Field label="Handoff Notes" value={guidance.aiSuggestion.handoffNotes} />
                </dl>
              ) : (
                <p className="text-sm text-gray-600">No AI Suggestion saved yet.</p>
              )}
            </section>
          </div>
        </div>
      )}
    </details>
  )
}

function SnapshotMetadataFields({
  sourceStatus,
  sourceMetadata,
}: {
  sourceStatus: string
  sourceMetadata: unknown
}) {
  const historyWindowLabel = parseHistoryWindowLabel(sourceMetadata)

  return (
    <dl className="space-y-3 border-t border-gray-100 pt-3">
      <Field label="Source Status" value={formatSourceStatus(sourceStatus)} />
      {historyWindowLabel && <Field label="History Window" value={historyWindowLabel} />}
    </dl>
  )
}

function EmailDraft({ subject, body }: { subject: string; body: string }) {
  const contentToCopy = `Subject: ${subject}\n\n${body}`

  return (
    <div className="space-y-3 rounded border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-950">Email Draft</h4>
        <CopyLinkButton value={contentToCopy} label="Copy content" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Subject</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-950">{subject}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Body</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-950">{body}</p>
      </div>
    </div>
  )
}

function SnapshotFields({
  structuredSummary,
  fallbackSummary,
}: {
  structuredSummary: unknown
  fallbackSummary: string
}) {
  const summary = parseStructuredSummary(structuredSummary)
  if (!summary) return <p className="whitespace-pre-wrap text-sm text-gray-800">{fallbackSummary}</p>

  return (
    <dl className="space-y-3">
      <Field label="Customer Need" value={summary.customerNeed} />
      <ListField label="Project Signals" values={summary.projectSignals} />
      <ListField label="Open Questions" values={summary.openQuestions} />
      <ListField label="Risks / Blockers" values={summary.risksBlockers} />
      <Field label="Known ServiceM8 Context" value={summary.knownServiceM8Context} />
      <ListField label="Interpreted File Summaries" values={summary.interpretedFileSummaries} />
      <ListField label="Handoff Notes" values={summary.handoffNotes} />
    </dl>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-950">{value || '-'}</p>
    </div>
  )
}

function ListField({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return <Field label={label} value="-" />

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-950">
        {values.map((value) => <li key={value}>{value}</li>)}
      </ul>
    </div>
  )
}

function parseStructuredSummary(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.customerNeed !== 'string' ||
    typeof candidate.knownServiceM8Context !== 'string' ||
    !isStringArray(candidate.projectSignals) ||
    !isStringArray(candidate.openQuestions) ||
    !isStringArray(candidate.risksBlockers) ||
    !isStringArray(candidate.interpretedFileSummaries) ||
    !isStringArray(candidate.handoffNotes)
  ) {
    return null
  }

  return {
    customerNeed: candidate.customerNeed,
    projectSignals: candidate.projectSignals,
    openQuestions: candidate.openQuestions,
    risksBlockers: candidate.risksBlockers,
    knownServiceM8Context: candidate.knownServiceM8Context,
    interpretedFileSummaries: candidate.interpretedFileSummaries,
    handoffNotes: candidate.handoffNotes,
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function formatStringList(value: unknown): string[] {
  return isStringArray(value) ? value : []
}

function formatRecommendedMove(value: string) {
  const readable = value.split('_').join(' ')
  return readable ? `${readable[0].toUpperCase()}${readable.slice(1)}` : '-'
}

function formatFailureStage(value: string) {
  if (value === 'conversation_snapshot') return 'snapshot'
  if (value === 'ai_suggestion') return 'AI Suggestion'
  return 'AI Guidance'
}

function formatSourceStatus(value: string) {
  if (value === 'complete') return 'Complete'
  if (value === 'partial') return 'Partial'
  return value || '-'
}

function parseHistoryWindowLabel(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  return typeof candidate.historyWindowLabel === 'string' && candidate.historyWindowLabel.trim()
    ? candidate.historyWindowLabel
    : null
}
