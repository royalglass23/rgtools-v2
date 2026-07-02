import type { LatestQuoteAiGuidance } from './ai-guidance'
import { AiGuidanceSubmitButton } from './AiGuidanceSubmitButton'
import { CopyLinkButton } from './CopyLinkButton'
import { formatDateTime } from './presentation'

const AI_GUIDANCE_REGENERATION_COOLDOWN_MS = 5 * 60 * 1000

export function AiGuidancePanel({
  guidance,
  quoteId,
  quoteUrl,
  generateSuggestionAction,
}: {
  guidance: LatestQuoteAiGuidance
  quoteId?: string
  quoteUrl?: string
  generateSnapshotAction?: (formData: FormData) => void | Promise<void>
  generateSuggestionAction?: (formData: FormData) => void | Promise<void>
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

  return (
    <details
      data-testid="ai-guidance-details"
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
        <div className="flex flex-wrap gap-2">
          {generateSuggestionAction && quoteId ? (
            <form action={generateSuggestionAction}>
              <input type="hidden" name="quoteId" value={quoteId} />
              <AiGuidanceSubmitButton label={actionLabel} disabledUntil={disabledUntil} />
            </form>
          ) : (
            <button
              type="button"
              disabled
              className="rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-500"
            >
              Generate
            </button>
          )}
        </div>
      </summary>

      {(hasSavedGuidance || hasFailure) && (
        <div className="space-y-4 border-t border-gray-200 pt-4">
          {guidance.generationFailure && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              Last {formatFailureStage(guidance.generationFailure.failureStage)} attempt failed: {guidance.generationFailure.errorMessage}
              {guidance.generationFailure.retryAfter && (
                <>
                  <br />
                  Retry available after {formatDateTime(guidance.generationFailure.retryAfter)}.
                </>
              )}
            </p>
          )}
          {guidance.conversationSnapshot?.sourceStatus === 'partial' && guidance.conversationSnapshot.safeError && (
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Partial context: {guidance.conversationSnapshot.safeError}
            </p>
          )}
          {(guidance.aiSuggestion?.staleAt || guidance.aiSuggestion?.staleReason) && (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-medium">This AI Suggestion may be stale.</p>
              {guidance.aiSuggestion.staleReason && (
                <p className="mt-1">{guidance.aiSuggestion.staleReason}</p>
              )}
            </div>
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
                <Field label="Signal" value={guidance.aiSuggestion.signalLabel} />
                <Field label="Recommended Move" value={guidance.aiSuggestion.nextViableMove} />
                <Field label="Suggested Timing" value={`${guidance.aiSuggestion.suggestedTiming}\n${guidance.aiSuggestion.timingReason}`} />
                <Field label="Confidence" value={`${guidance.aiSuggestion.confidence}\n${guidance.aiSuggestion.confidenceReason}`} />
                <Field label="Likely Customer State" value={guidance.aiSuggestion.likelyCustomerState} />
                <Field label="Why This Move" value={guidance.aiSuggestion.reasoning} />
                <Field label="Suggested Win Path" value={guidance.aiSuggestion.suggestedWinPath} />
                <Field label="Use Care" value={guidance.aiSuggestion.useCareGuidance} />
                {guidance.aiSuggestion.partialContextNote && (
                  <Field label="Partial Context" value={guidance.aiSuggestion.partialContextNote} />
                )}
                {guidance.aiSuggestion.waitReason && (
                  <Field
                    label="Wait Guidance"
                    value={[
                      guidance.aiSuggestion.waitReason,
                      guidance.aiSuggestion.waitRevisitWindow,
                      formatWatchForSignals(guidance.aiSuggestion.watchForSignals),
                    ].filter(Boolean).join('\n')}
                  />
                )}
                <EmailDraft
                  subject={guidance.aiSuggestion.emailDraftSubject}
                  body={guidance.aiSuggestion.emailDraftBody}
                  includeQuoteLink={guidance.aiSuggestion.includeQuoteLink}
                  quoteUrl={quoteUrl}
                />
                <ListField label="Phone Talking Points" values={formatStringList(guidance.aiSuggestion.phoneTalkingPoints)} />
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

function EmailDraft({
  subject,
  body,
  includeQuoteLink,
  quoteUrl,
}: {
  subject: string
  body: string
  includeQuoteLink: boolean
  quoteUrl?: string
}) {
  const contentToCopy = formatEmailDraftContent(subject, body, includeQuoteLink, quoteUrl)
  const shouldShowQuoteLink = includeQuoteLink && Boolean(quoteUrl)

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
        {shouldShowQuoteLink && (
          <p className="mt-2 break-all text-sm text-blue-700">{quoteUrl}</p>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-950">{value}</p>
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
      <Field label="Customer / Email Summary" value={summary.customerEmailSummary} />
      <Field label="Internal Notes Summary" value={summary.internalNotesSummary} />
      <Field label="Last Known Position" value={summary.lastKnownPosition} />
      <ListField label="Open Questions" values={summary.openQuestions} />
      <ListField label="Important Dates" values={summary.importantDates} />
      <ListField label="Decision-makers" values={summary.decisionMakers} />
      <ListField label="Risks / Blockers" values={summary.risksBlockers} />
    </dl>
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
    typeof candidate.customerEmailSummary !== 'string' ||
    typeof candidate.internalNotesSummary !== 'string' ||
    typeof candidate.lastKnownPosition !== 'string' ||
    !isStringArray(candidate.openQuestions) ||
    !isStringArray(candidate.importantDates) ||
    !isStringArray(candidate.decisionMakers) ||
    !isStringArray(candidate.risksBlockers)
  ) {
    return null
  }

  return {
    customerEmailSummary: candidate.customerEmailSummary,
    internalNotesSummary: candidate.internalNotesSummary,
    openQuestions: candidate.openQuestions,
    lastKnownPosition: candidate.lastKnownPosition,
    importantDates: candidate.importantDates,
    decisionMakers: candidate.decisionMakers,
    risksBlockers: candidate.risksBlockers,
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function formatStringList(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : []
}

function formatWatchForSignals(value: unknown): string | null {
  const signals = formatStringList(value)
  return signals.length > 0 ? `Watch for: ${signals.join(', ')}` : null
}

function formatFailureStage(value: string) {
  if (value === 'conversation_snapshot') return 'snapshot'
  if (value === 'ai_suggestion') return 'AI Suggestion'
  return 'AI Guidance'
}

function formatEmailDraftContent(subject: string, body: string, includeQuoteLink: boolean, quoteUrl?: string) {
  const content = `Subject: ${subject}\n\n${body}`
  return includeQuoteLink && quoteUrl ? `${content}\n\n${quoteUrl}` : content
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
