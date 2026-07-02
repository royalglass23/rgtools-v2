import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AiGuidancePanel } from '../AiGuidancePanel'

const quoteId = '11111111-1111-4111-8111-111111111111'
const userId = '22222222-2222-4222-8222-222222222222'
const quoteUrl = 'https://quotes.royalglass.co.nz/q/abc123'

describe('AiGuidancePanel', () => {
  it('shows a compact empty state and Generate AI suggestion placeholder', () => {
    render(
      <AiGuidancePanel
        guidance={{
          conversationSnapshot: null,
          aiSuggestion: null,
          generationFailure: null,
        }}
      />,
    )

    expect(screen.getByRole('heading', { name: 'AI Guidance' })).toBeInTheDocument()
    expect(screen.getByText('No Conversation Snapshot or AI Suggestion saved yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled()
    expect(screen.getByTestId('ai-guidance-details')).not.toHaveAttribute('open')
  })

  it('enables the Generate action when an action is provided', () => {
    render(
      <AiGuidancePanel
        quoteId={quoteId}
        generateSuggestionAction={() => undefined}
        guidance={{
          conversationSnapshot: null,
          aiSuggestion: null,
          generationFailure: null,
        }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Generate' })).toBeEnabled()
  })

  it('switches Generate to Regenerate after a suggestion is saved', () => {
    const action = () => undefined
    const { rerender } = render(
      <AiGuidancePanel
        quoteId={quoteId}
        generateSuggestionAction={action}
        guidance={{
          conversationSnapshot: null,
          aiSuggestion: null,
          generationFailure: null,
        }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Generate' })).toBeEnabled()

    rerender(
      <AiGuidancePanel
        quoteId={quoteId}
        generateSuggestionAction={action}
        guidance={{
          conversationSnapshot: null,
          aiSuggestion: {
            id: 'suggestion-1',
            quoteId,
            conversationSnapshotId: null,
            triggeredByUserId: userId,
            nextViableMove: 'Call today to confirm whether low iron glass should be included.',
            suggestedWinPath: 'Confirm scope, refresh the quote, then send the tracked link again.',
            recommendedMove: 'call today',
            suggestedTiming: 'Today',
            timingReason: 'High engagement.',
            confidence: 'High',
            confidenceReason: 'Customer returned to the quote.',
            likelyCustomerState: 'Interested.',
            reasoning: 'The quote has strong engagement.',
            emailDraftSubject: 'Frameless shower quote',
            emailDraftBody: 'Hi Jane, happy to confirm the details today.',
            phoneTalkingPoints: ['Confirm low iron glass scope.'],
            useCareGuidance: 'Keep the follow-up helpful.',
            includeQuoteLink: true,
            partialContextNote: null,
            waitReason: null,
            waitRevisitWindow: null,
            model: 'gpt-4o-mini',
            promptVersion: 'quote-ai-guidance-v1',
            inputSnapshotVersion: 'quote-ai-guidance-input-v1',
            signalBucket: 'high_intent',
            signalLabel: 'High intent',
            analyticsSnapshot: {},
            recommendationKind: 'act_now',
            revisitAt: null,
            watchForSignals: ['reply_or_new_context'],
            staleAt: null,
            staleReason: null,
            createdAt: new Date('2026-06-29T01:05:00Z'),
          },
          generationFailure: null,
        }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeEnabled()
  })

  it('disables Regenerate for 5 minutes after saved guidance is created', () => {
    render(
      <AiGuidancePanel
        quoteId={quoteId}
        generateSuggestionAction={() => undefined}
        guidance={{
          conversationSnapshot: null,
          aiSuggestion: suggestionFixture({
            createdAt: new Date(Date.now()),
          }),
          generationFailure: null,
        }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Regenerate in 5 min' })).toBeDisabled()
  })

  it('opens by default and shows saved Conversation Snapshot and AI Suggestion separately', () => {
    render(
      <AiGuidancePanel
        guidance={{
          conversationSnapshot: {
            id: 'snapshot-1',
            quoteId,
            summary: 'Customer asked whether the pool fence can be included in the same visit.',
            structuredSummary: {
              customerEmailSummary: 'Customer asked whether the pool fence can be included in the same visit.',
              internalNotesSummary: 'Staff noted a site visit may be needed.',
              openQuestions: ['Is the pool fence in scope?'],
              lastKnownPosition: 'Customer is comparing scope options.',
              importantDates: ['Site visit next week'],
              decisionMakers: ['Jane Smith'],
              risksBlockers: ['Scope is not final.'],
            },
            snapshotCursor: { lastNoteId: 'note-42' },
            sourceStatus: 'complete',
            sourceMetadata: {},
            safeError: null,
            triggeredByUserId: userId,
            capturedAt: new Date('2026-06-29T01:00:00Z'),
            createdAt: new Date('2026-06-29T01:01:00Z'),
          },
          aiSuggestion: {
            id: 'suggestion-1',
            quoteId,
            conversationSnapshotId: 'snapshot-1',
            triggeredByUserId: '22222222-2222-4222-8222-222222222222',
            nextViableMove: 'Call and confirm whether the pool fence is in scope before revising the quote.',
            suggestedWinPath: 'Confirm scope, refresh the quote, then send the tracked link again.',
            recommendedMove: 'call today',
            suggestedTiming: 'Today',
            timingReason: 'The customer has active scope questions.',
            confidence: 'High',
            confidenceReason: 'The quote has useful engagement and a clear blocker.',
            likelyCustomerState: 'Interested but clarifying scope.',
            reasoning: 'A call is more useful than another generic email while scope is unclear.',
            emailDraftSubject: 'Pool fence scope',
            emailDraftBody: 'Hi Jane, happy to confirm whether the pool fence is included.',
            phoneTalkingPoints: ['Confirm whether the pool fence is in scope.'],
            useCareGuidance: 'Keep the follow-up focused on scope.',
            includeQuoteLink: true,
            partialContextNote: null,
            waitReason: null,
            waitRevisitWindow: null,
            model: 'gpt-4o-mini',
            promptVersion: 'quote-ai-guidance-v1',
            inputSnapshotVersion: 'quote-ai-guidance-input-v1',
            signalBucket: 'needs_clarification',
            signalLabel: 'Needs clarification',
            analyticsSnapshot: {},
            recommendationKind: 'act_now',
            revisitAt: null,
            watchForSignals: ['reply_or_new_context'],
            staleAt: null,
            staleReason: null,
            createdAt: new Date('2026-06-29T01:05:00Z'),
          },
          generationFailure: null,
        }}
      />,
    )

    expect(screen.getByTestId('ai-guidance-details')).toHaveAttribute('open')
    expect(screen.getByRole('heading', { name: 'Conversation Snapshot' })).toBeInTheDocument()
    expect(screen.getByText('Customer / Email Summary')).toBeInTheDocument()
    expect(screen.getByText('Customer asked whether the pool fence can be included in the same visit.')).toBeInTheDocument()
    expect(screen.getByText('Internal Notes Summary')).toBeInTheDocument()
    expect(screen.getByText('Staff noted a site visit may be needed.')).toBeInTheDocument()
    expect(screen.getByText('Open Questions')).toBeInTheDocument()
    expect(screen.getByText('Is the pool fence in scope?')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI Suggestion' })).toBeInTheDocument()
    expect(screen.getByText('Recommended Move')).toBeInTheDocument()
    expect(screen.getByText('Call and confirm whether the pool fence is in scope before revising the quote.')).toBeInTheDocument()
    expect(screen.getByText('Suggested Win Path')).toBeInTheDocument()
    expect(screen.getByText('Confirm scope, refresh the quote, then send the tracked link again.')).toBeInTheDocument()
  })

  it('shows staff-safe partial and retryable failure messages', () => {
    render(
      <AiGuidancePanel
        quoteId={quoteId}
        generateSuggestionAction={() => undefined}
        guidance={{
          conversationSnapshot: {
            id: 'snapshot-1',
            quoteId,
            summary: 'Customer is reviewing the quote.',
            structuredSummary: {},
            snapshotCursor: { latestNoteTimestamp: '2026-06-29T01:00:00Z' },
            sourceStatus: 'partial',
            sourceMetadata: {},
            safeError: 'Email history could not be fetched.',
            triggeredByUserId: userId,
            capturedAt: new Date('2026-06-29T01:00:00Z'),
            createdAt: new Date('2026-06-29T01:01:00Z'),
          },
          aiSuggestion: null,
          generationFailure: {
            id: 'failure-1',
            quoteId,
            conversationSnapshotId: null,
            triggeredByUserId: userId,
            failureStage: 'conversation_snapshot',
            errorType: 'ai_response_error',
            errorMessage: 'ServiceM8 history could not be fetched.',
            attemptedAt: new Date('2026-06-29T01:10:00Z'),
            retryAfter: new Date('2026-06-29T01:11:00Z'),
            createdAt: new Date('2026-06-29T01:10:00Z'),
          },
        }}
      />,
    )

    expect(screen.getByText('Partial context: Email history could not be fetched.')).toBeInTheDocument()
    expect(screen.getByText(/Last snapshot attempt failed: ServiceM8 history could not be fetched\./)).toBeInTheDocument()
    expect(screen.getByText(/Retry available after 29 Jun 2026, 1:11 pm\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry and regenerate' })).toBeEnabled()
  })

  it('renders one email draft with a single copy content action and includes the tracked quote link only when saved guidance allows it', () => {
    const clipboard = vi.fn(async () => undefined)
    Object.assign(navigator, { clipboard: { writeText: clipboard } })

    const { rerender } = render(
      <AiGuidancePanel
        quoteUrl={quoteUrl}
        guidance={{
          conversationSnapshot: null,
          aiSuggestion: suggestionFixture({
            emailDraftSubject: 'Frameless shower quote timing',
            emailDraftBody: 'Hi Jane, happy to confirm low iron glass and timing today.',
            includeQuoteLink: true,
          }),
          generationFailure: null,
        }}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Email Draft' })).toBeInTheDocument()
    expect(screen.getByText('Subject')).toBeInTheDocument()
    expect(screen.getByText('Frameless shower quote timing')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
    expect(screen.getByText('Hi Jane, happy to confirm low iron glass and timing today.')).toBeInTheDocument()
    expect(screen.getByText(quoteUrl)).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'Copy subject' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy body' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copy content' }))
    expect(clipboard).toHaveBeenLastCalledWith(`Subject: Frameless shower quote timing\n\nHi Jane, happy to confirm low iron glass and timing today.\n\n${quoteUrl}`)

    rerender(
      <AiGuidancePanel
        quoteUrl={quoteUrl}
        guidance={{
          conversationSnapshot: null,
          aiSuggestion: suggestionFixture({
            includeQuoteLink: false,
          }),
          generationFailure: null,
        }}
      />,
    )

    expect(screen.queryByText(quoteUrl)).not.toBeInTheDocument()
    expect(screen.queryByText('Do not include quote link.')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Copy content' }))
    expect(clipboard).toHaveBeenLastCalledWith('Subject: Frameless shower quote\n\nHi Jane, happy to confirm the details today.')
  })

  it('shows interpreted suggestion fields without raw analytics or internal recommendation flags', () => {
    render(
      <AiGuidancePanel
        quoteUrl={quoteUrl}
        guidance={{
          conversationSnapshot: null,
          aiSuggestion: suggestionFixture({
            analyticsSnapshot: {
              totalOpens: 7,
              uniqueViewers: 2,
              readTime: '6m',
              scrollDepth: 96,
              downloads: 1,
              events: ['open', 'download'],
            },
          }),
          generationFailure: null,
        }}
      />,
    )

    expect(screen.getByText('Signal')).toBeInTheDocument()
    expect(screen.getByText('High intent')).toBeInTheDocument()
    expect(screen.getByText('Recommended Move')).toBeInTheDocument()
    expect(screen.getByText('Call today to confirm whether low iron glass should be included.')).toBeInTheDocument()
    expect(screen.getByText('Suggested Timing')).toBeInTheDocument()
    expect(screen.getByText('Why This Move')).toBeInTheDocument()
    expect(screen.queryByText('Next Viable Move')).not.toBeInTheDocument()
    expect(screen.queryByText('call today')).not.toBeInTheDocument()
    expect(screen.queryByText('totalOpens')).not.toBeInTheDocument()
    expect(screen.queryByText('uniqueViewers')).not.toBeInTheDocument()
    expect(screen.queryByText('scrollDepth')).not.toBeInTheDocument()
    expect(screen.queryByText('download')).not.toBeInTheDocument()
  })

  it('shows snapshot source status and history window without exposing raw cursor data', () => {
    render(
      <AiGuidancePanel
        guidance={{
          conversationSnapshot: snapshotFixture({
            sourceStatus: 'complete',
            sourceMetadata: { historyWindowLabel: 'New ServiceM8 history since the last snapshot.' },
            snapshotCursor: {
              latestNoteTimestamp: '2026-06-29T01:00:00Z',
              latestEmailTimestamp: '2026-06-29T01:05:00Z',
            },
          }),
          aiSuggestion: null,
          generationFailure: null,
        }}
      />,
    )

    expect(screen.getByText('Source Status')).toBeInTheDocument()
    expect(screen.getByText('Complete')).toBeInTheDocument()
    expect(screen.getByText('History Window')).toBeInTheDocument()
    expect(screen.getByText('New ServiceM8 history since the last snapshot.')).toBeInTheDocument()
    expect(screen.queryByText('Snapshot Cursor')).not.toBeInTheDocument()
    expect(screen.queryByText(/latestNoteTimestamp/)).not.toBeInTheDocument()
  })

  it('shows stale AI Suggestion warnings without hiding the saved guidance', () => {
    render(
      <AiGuidancePanel
        guidance={{
          conversationSnapshot: null,
          aiSuggestion: suggestionFixture({
            staleAt: new Date('2026-06-29T02:00:00Z'),
            staleReason: 'New ServiceM8 email arrived after this suggestion was generated.',
          }),
          generationFailure: null,
        }}
      />,
    )

    expect(screen.getByText('This AI Suggestion may be stale.')).toBeInTheDocument()
    expect(screen.getByText('New ServiceM8 email arrived after this suggestion was generated.')).toBeInTheDocument()
    expect(screen.getByText('Recommended Move')).toBeInTheDocument()
    expect(screen.getByText('Call today to confirm whether low iron glass should be included.')).toBeInTheDocument()
  })
})

function suggestionFixture(overrides: Partial<{
  emailDraftSubject: string
  emailDraftBody: string
  includeQuoteLink: boolean
  analyticsSnapshot: unknown
  staleAt: Date | null
  staleReason: string | null
  createdAt: Date
}> = {}) {
  return {
    id: 'suggestion-1',
    quoteId,
    conversationSnapshotId: null,
    triggeredByUserId: userId,
    nextViableMove: 'Call today to confirm whether low iron glass should be included.',
    suggestedWinPath: 'Confirm scope, refresh the quote, then send the tracked link again.',
    recommendedMove: 'call today',
    suggestedTiming: 'Today',
    timingReason: 'High engagement.',
    confidence: 'High',
    confidenceReason: 'Customer returned to the quote.',
    likelyCustomerState: 'Interested.',
    reasoning: 'The quote has strong engagement.',
    emailDraftSubject: 'Frameless shower quote',
    emailDraftBody: 'Hi Jane, happy to confirm the details today.',
    phoneTalkingPoints: ['Confirm low iron glass scope.'],
    useCareGuidance: 'Keep the follow-up helpful.',
    includeQuoteLink: true,
    partialContextNote: null,
    waitReason: null,
    waitRevisitWindow: null,
    model: 'gpt-4o-mini',
    promptVersion: 'quote-ai-guidance-v1',
    inputSnapshotVersion: 'quote-ai-guidance-input-v1',
    signalBucket: 'high_intent',
    signalLabel: 'High intent',
    analyticsSnapshot: {},
    recommendationKind: 'act_now',
    revisitAt: null,
    watchForSignals: ['reply_or_new_context'],
    staleAt: null,
    staleReason: null,
    createdAt: new Date('2026-06-29T01:05:00Z'),
    ...overrides,
  }
}

function snapshotFixture(overrides: Partial<{
  sourceStatus: string
  sourceMetadata: unknown
  snapshotCursor: unknown
}> = {}) {
  return {
    id: 'snapshot-1',
    quoteId,
    summary: 'Customer asked whether the pool fence can be included in the same visit.',
    structuredSummary: {
      customerEmailSummary: 'Customer asked whether the pool fence can be included in the same visit.',
      internalNotesSummary: 'Staff noted a site visit may be needed.',
      openQuestions: ['Is the pool fence in scope?'],
      lastKnownPosition: 'Customer is comparing scope options.',
      importantDates: ['Site visit next week'],
      decisionMakers: ['Jane Smith'],
      risksBlockers: ['Scope is not final.'],
    },
    snapshotCursor: { latestNoteTimestamp: '2026-06-29T01:00:00Z' },
    sourceStatus: 'complete',
    sourceMetadata: {},
    safeError: null,
    triggeredByUserId: userId,
    capturedAt: new Date('2026-06-29T01:00:00Z'),
    createdAt: new Date('2026-06-29T01:01:00Z'),
    ...overrides,
  }
}
