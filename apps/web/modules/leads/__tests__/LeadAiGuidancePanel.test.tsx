import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LeadAiGuidancePanel } from '../LeadAiGuidancePanel'

const leadId = '11111111-1111-4111-8111-111111111111'
const userId = '22222222-2222-4222-8222-222222222222'

describe('LeadAiGuidancePanel', () => {
  it('shows the AI Guidance empty state and disables unlinked lead generation with agreed wording', () => {
    render(
      <LeadAiGuidancePanel
        leadId={leadId}
        guidance={{
          conversationSnapshot: null,
          aiSuggestion: null,
          generationFailure: null,
        }}
        generateGuidanceAction={() => undefined}
        generationDisabledReason="Link this lead to ServiceM8 to generate AI Guidance."
      />,
    )

    expect(screen.getByRole('heading', { name: 'AI Guidance' })).toBeInTheDocument()
    expect(screen.getByText('No Conversation Snapshot or AI Suggestion saved yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled()
    expect(screen.getByText('Link this lead to ServiceM8 to generate AI Guidance.')).toBeInTheDocument()
    expect(screen.queryByText('Suggested next step')).not.toBeInTheDocument()
    expect(screen.queryByText('Get suggestion')).not.toBeInTheDocument()
    expect(screen.queryByText('Refresh')).not.toBeInTheDocument()
  })

  it('enables Generate for linked Leads before saved guidance exists', () => {
    render(
      <LeadAiGuidancePanel
        leadId={leadId}
        guidance={{
          conversationSnapshot: null,
          aiSuggestion: null,
          generationFailure: null,
        }}
        generateGuidanceAction={() => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: 'Generate' })).toBeEnabled()
  })

  it('shows saved Conversation Snapshot and AI Suggestion separately with email draft copy and phone talking points', () => {
    const clipboard = vi.fn(async () => undefined)
    Object.assign(navigator, { clipboard: { writeText: clipboard } })

    render(
      <LeadAiGuidancePanel
        leadId={leadId}
        guidance={{
          conversationSnapshot: snapshotFixture(),
          aiSuggestion: suggestionFixture(),
          generationFailure: null,
        }}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Conversation Snapshot' })).toBeInTheDocument()
    expect(screen.getByText('Customer Need')).toBeInTheDocument()
    expect(screen.getByText('Ensuite shower needs a site check before pricing is final.')).toBeInTheDocument()
    expect(screen.getByText('Project Signals')).toBeInTheDocument()
    expect(screen.getByText('Ready for glazing')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI Suggestion' })).toBeInTheDocument()
    expect(screen.getByText('Recommended Move')).toBeInTheDocument()
    expect(screen.getByText('Call today')).toBeInTheDocument()
    expect(screen.getByText('Phone Talking Points')).toBeInTheDocument()
    expect(screen.getByText('Confirm the install date.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Email Draft' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copy content' }))
    expect(clipboard).toHaveBeenCalledWith('Subject: Ensuite shower follow-up\n\nHi Aroha, happy to confirm the next step today.')
  })

  it('uses regenerate, retry, cooldown, partial context, and failure wording without hiding saved guidance', () => {
    render(
      <LeadAiGuidancePanel
        leadId={leadId}
        guidance={{
          conversationSnapshot: snapshotFixture({
            sourceStatus: 'partial',
            safeError: 'ServiceM8 emails could not be fetched.',
          }),
          aiSuggestion: suggestionFixture({
            createdAt: new Date(Date.now()),
            partialContextNote: 'Generated with partial ServiceM8 context.',
          }),
          generationFailure: {
            id: 'failure-1',
            leadId,
            conversationSnapshotId: 'snapshot-1',
            triggeredByUserId: userId,
            failureStage: 'ai_suggestion',
            errorType: 'ai_response_error',
            errorMessage: 'AI provider returned HTTP 429.',
            attemptedAt: new Date('2026-07-09T01:10:00Z'),
            retryAfter: new Date('2026-07-09T01:11:00Z'),
            model: 'gpt-4o-mini',
            promptVersion: 'lead-ai-guidance-v1',
            inputSnapshotVersion: 'lead-ai-guidance-input-v1',
            createdAt: new Date('2026-07-09T01:10:00Z'),
          },
        }}
        generateGuidanceAction={() => undefined}
      />,
    )

    expect(screen.getByText('Partial context: ServiceM8 emails could not be fetched.')).toBeInTheDocument()
    expect(screen.getByText(/Last AI Suggestion attempt failed: AI provider returned HTTP 429\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry and regenerate in 5 min' })).toBeDisabled()
    expect(screen.getByText('Generated with partial ServiceM8 context.')).toBeInTheDocument()
    expect(screen.getByText('Recommended Move')).toBeInTheDocument()
  })
})

function snapshotFixture(overrides: Partial<{
  sourceStatus: string
  safeError: string | null
}> = {}) {
  return {
    id: 'snapshot-1',
    leadId,
    triggeredByUserId: userId,
    summary: 'Ensuite shower needs a site check before pricing is final.',
    structuredSummary: {
      customerNeed: 'Ensuite shower needs a site check before pricing is final.',
      projectSignals: ['Ready for glazing'],
      openQuestions: ['Is low iron glass required?'],
      risksBlockers: ['Install date is not confirmed.'],
      knownServiceM8Context: 'Quote job is still open.',
      interpretedFileSummaries: ['No interpreted files yet.'],
      handoffNotes: ['Ask about access before booking.'],
    },
    snapshotCursor: {},
    sourceStatus: 'complete',
    sourceMetadata: { historyWindowLabel: 'Latest ServiceM8 job history.' },
    safeError: null,
    capturedAt: new Date('2026-07-09T01:00:00Z'),
    model: 'gpt-4o-mini',
    promptVersion: 'lead-conversation-snapshot-v1',
    inputSnapshotVersion: 'lead-conversation-snapshot-input-v1',
    createdAt: new Date('2026-07-09T01:00:00Z'),
    ...overrides,
  }
}

function suggestionFixture(overrides: Partial<{
  createdAt: Date
  partialContextNote: string | null
}> = {}) {
  return {
    id: 'suggestion-1',
    leadId,
    conversationSnapshotId: 'snapshot-1',
    triggeredByUserId: userId,
    recommendedMove: 'call today',
    suggestedTiming: 'Today',
    confidence: 'High',
    confidenceReason: 'The lead has a clear open question.',
    reasoning: 'A call is better than a generic email while the install date is unclear.',
    emailDraftSubject: 'Ensuite shower follow-up',
    emailDraftBody: 'Hi Aroha, happy to confirm the next step today.',
    phoneTalkingPoints: ['Confirm the install date.', 'Ask whether low iron glass is required.'],
    handoffNotes: 'Book a site check if timing works.',
    partialContextNote: null,
    model: 'gpt-4o-mini',
    promptVersion: 'lead-ai-guidance-v1',
    inputSnapshotVersion: 'lead-ai-guidance-input-v1',
    createdAt: new Date('2026-07-09T01:05:00Z'),
    ...overrides,
  }
}
