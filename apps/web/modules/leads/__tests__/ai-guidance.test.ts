// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import {
  generateLeadAiGuidance,
  type LeadAiGuidanceDeps,
} from '../ai-guidance'

const leadId = '11111111-1111-4111-8111-111111111111'
const userId = '22222222-2222-4222-8222-222222222222'
const snapshotId = '33333333-3333-4333-8333-333333333333'

function deps(overrides: Partial<LeadAiGuidanceDeps> = {}): LeadAiGuidanceDeps {
  return {
    findLead: vi.fn(async () => ({
      id: leadId,
      clientName: 'Jane Smith',
      companyName: 'Smith Renovations',
      phone: '021 555 1212',
      email: 'jane@example.com',
      location: '1 Queen Street',
      channel: 'email',
      source: 'existing_client_referral_repeat_builder_architect',
      projectType: 'renovation_replacement',
      product: 'Frameless shower',
      jobDescription: 'Renovate ensuite shower glass.',
      tier: 'B',
      seedScore: 78,
      completeness: 9,
      scoreReason: 'Strong repeat builder signal with a near-term renovation.',
      strikeFlag: null,
      servicem8JobUuid: 'job-uuid-1',
      servicem8JobNumber: 'J1001',
      servicem8Status: 'Quote',
      followUpDate: new Date('2026-07-15T00:00:00Z'),
      scoredFields: [
        { category: 1, label: 'Client Type', answer: 'Builder / developer / pool builder / landscaper', points: 15 },
        { category: 2, label: 'Budget Band', answer: '$20k-$50k', points: 10 },
        { category: 5, label: 'Price-sensitivity Read', answer: 'Value focused', points: 5 },
      ],
    })),
    findReviewerNotes: vi.fn(async () => [
      {
        id: 'note-1',
        authorName: 'manager',
        text: 'Ask whether the July install date is fixed.',
        createdAt: new Date('2026-07-08T22:00:00Z'),
      },
    ]),
    findLatestSnapshot: vi.fn(async () => null),
    findLatestSuggestion: vi.fn(async () => null),
    findLatestFailure: vi.fn(async () => null),
    fetchHistory: vi.fn(async () => ({
      notes: [{ date: '2026-07-08T21:00:00Z', text: 'Customer asked if low iron glass is available.' }],
      emails: [{
        date: '2026-07-08T20:00:00Z',
        subject: 'Ensuite shower',
        body: 'Can we get this installed before the painters come back?',
        direction: 'inbound' as const,
      }],
      sourceStatus: {
        notes: { ok: true, count: 1, latestTimestamp: '2026-07-08T21:00:00Z' },
        emails: { ok: true, count: 1, latestTimestamp: '2026-07-08T20:00:00Z' },
      },
    })),
    buildFileContext: vi.fn(async () => ({
      servicem8JobUuid: 'job-uuid-1',
      files: [{
        servicem8AttachmentUuid: 'attachment-1',
        servicem8JobUuid: 'job-uuid-1',
        name: 'site-photo.jpg',
        fileType: 'image/jpeg',
        attachmentSource: 'JOB',
        status: 'interpreted' as const,
        summary: 'Photo shows tiled ensuite opening with a nib wall.',
        model: 'gpt-4o-mini',
        interpretedAt: new Date('2026-07-08T20:30:00Z'),
        editDate: '2026-07-08T20:25:00Z',
        errorMessage: null,
        errorMetadata: {},
      }],
      sourceStatus: { status: 'complete' as const, total: 1, interpreted: 1, unsupported: 0, failed: 0 },
    })),
    summarizeConversation: vi.fn(async () => ({
      customerNeed: 'Jane needs shower glass confirmed before painters return.',
      projectSignals: ['Repeat builder', 'Ensuite renovation', 'Low iron glass question'],
      openQuestions: ['Is the July installation date fixed?', 'Should low iron glass be included?'],
      risksBlockers: ['Timing may decide whether Royal Glass wins the work.'],
      knownServiceM8Context: 'Customer asked about low iron glass and install timing.',
      interpretedFileSummaries: ['Site photo shows tiled ensuite opening with a nib wall.'],
      handoffNotes: ['Call Jane before 15 July and confirm the glass option.'],
    })),
    insertSnapshot: vi.fn(async () => ({ id: snapshotId })),
    generateSuggestion: vi.fn(async () => ({
      recommendedMove: 'call today',
      suggestedTiming: 'Today before 4pm',
      confidence: 'High',
      confidenceReason: 'Known timing blocker and repeat builder signal.',
      reasoning: 'A call can resolve low iron glass and installation timing in one pass.',
      emailDraft: {
        subject: 'Ensuite shower timing',
        body: 'Hi Jane, thanks for the details on the ensuite shower. I can confirm the low iron glass option and talk through timing before the painters return. Would a quick call today suit?',
      },
      phoneTalkingPoints: [
        'Confirm whether low iron glass should be included.',
        'Ask whether the painters returning is the real deadline.',
      ],
      handoffNotes: 'Confirm scope, then update ServiceM8 notes for the quoting handoff.',
      partialContextNote: null,
    })),
    insertSuggestion: vi.fn(async () => ({ id: 'suggestion-1' })),
    recordFailure: vi.fn(async () => undefined),
    updateLeadSuggestion: vi.fn(async () => undefined),
    now: () => new Date('2026-07-09T00:00:00Z'),
    model: 'gpt-4o-mini',
    ...overrides,
  }
}

describe('generateLeadAiGuidance', () => {
  it('saves durable Conversation Snapshot and AI Suggestion records for a linked lead', async () => {
    const d = deps()

    const result = await generateLeadAiGuidance({ leadId, triggeredByUserId: userId }, d)

    expect(result).toEqual({
      ok: true,
      snapshotId,
      suggestionId: 'suggestion-1',
      text: 'CALL TODAY: Today before 4pm\n\nA call can resolve low iron glass and installation timing in one pass.',
    })
    expect(d.summarizeConversation).toHaveBeenCalledWith(expect.objectContaining({
      lead: expect.objectContaining({
        clientName: 'Jane Smith',
        servicem8JobUuid: 'job-uuid-1',
      }),
      history: expect.objectContaining({
        notes: expect.arrayContaining([expect.objectContaining({ text: 'Customer asked if low iron glass is available.' })]),
      }),
      reviewerNotes: expect.arrayContaining([expect.objectContaining({ text: 'Ask whether the July install date is fixed.' })]),
      fileContext: expect.objectContaining({
        files: expect.arrayContaining([expect.objectContaining({ summary: 'Photo shows tiled ensuite opening with a nib wall.' })]),
      }),
    }))
    expect(d.insertSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      leadId,
      triggeredByUserId: userId,
      sourceStatus: 'complete',
      structuredSummary: expect.objectContaining({
        customerNeed: 'Jane needs shower glass confirmed before painters return.',
        projectSignals: ['Repeat builder', 'Ensuite renovation', 'Low iron glass question'],
        openQuestions: ['Is the July installation date fixed?', 'Should low iron glass be included?'],
        risksBlockers: ['Timing may decide whether Royal Glass wins the work.'],
        knownServiceM8Context: 'Customer asked about low iron glass and install timing.',
        interpretedFileSummaries: ['Site photo shows tiled ensuite opening with a nib wall.'],
        handoffNotes: ['Call Jane before 15 July and confirm the glass option.'],
      }),
      snapshotCursor: {
        latestNoteTimestamp: '2026-07-08T21:00:00Z',
        latestEmailTimestamp: '2026-07-08T20:00:00Z',
      },
      model: 'gpt-4o-mini',
      promptVersion: 'lead-conversation-snapshot-v1',
      inputSnapshotVersion: 'lead-conversation-snapshot-input-v1',
      capturedAt: new Date('2026-07-09T00:00:00Z'),
    }))
    expect(d.insertSuggestion).toHaveBeenCalledWith(expect.objectContaining({
      leadId,
      conversationSnapshotId: snapshotId,
      triggeredByUserId: userId,
      recommendedMove: 'call today',
      suggestedTiming: 'Today before 4pm',
      confidence: 'High',
      confidenceReason: 'Known timing blocker and repeat builder signal.',
      emailDraftSubject: 'Ensuite shower timing',
      phoneTalkingPoints: [
        'Confirm whether low iron glass should be included.',
        'Ask whether the painters returning is the real deadline.',
      ],
      handoffNotes: 'Confirm scope, then update ServiceM8 notes for the quoting handoff.',
      partialContextNote: null,
      model: 'gpt-4o-mini',
      promptVersion: 'lead-ai-guidance-v1',
      inputSnapshotVersion: 'lead-ai-guidance-input-v1',
      createdAt: new Date('2026-07-09T00:00:00Z'),
    }))
    expect(d.updateLeadSuggestion).toHaveBeenCalledWith({
      leadId,
      text: 'CALL TODAY: Today before 4pm\n\nA call can resolve low iron glass and installation timing in one pass.',
      generatedAt: new Date('2026-07-09T00:00:00Z'),
    })
  })

  it('returns a safe blocked result when the lead is not linked to ServiceM8', async () => {
    const d = deps({
      findLead: vi.fn(async () => ({
        ...(await deps().findLead(leadId))!,
        servicem8JobUuid: null,
      })),
    })

    const result = await generateLeadAiGuidance({ leadId, triggeredByUserId: userId }, d)

    expect(result).toEqual({
      ok: false,
      blocked: true,
      message: 'Link this lead to a ServiceM8 job before generating AI Guidance.',
    })
    expect(d.fetchHistory).not.toHaveBeenCalled()
    expect(d.summarizeConversation).not.toHaveBeenCalled()
    expect(d.generateSuggestion).not.toHaveBeenCalled()
    expect(d.recordFailure).not.toHaveBeenCalled()
  })

  it('records partial ServiceM8 and file context while still saving guidance', async () => {
    const d = deps({
      fetchHistory: vi.fn(async () => ({
        notes: [],
        emails: [{
          date: '2026-07-08T20:00:00Z',
          subject: 'Ensuite shower',
          body: 'Please confirm the timing.',
          direction: 'inbound' as const,
        }],
        sourceStatus: {
          notes: {
            ok: false,
            count: 0,
            latestTimestamp: null,
            safeError: 'ServiceM8 note history could not be fetched.',
          },
          emails: { ok: true, count: 1, latestTimestamp: '2026-07-08T20:00:00Z' },
        },
      })),
      buildFileContext: vi.fn(async () => ({
        servicem8JobUuid: 'job-uuid-1',
        files: [],
        sourceStatus: { status: 'partial' as const, total: 2, interpreted: 1, unsupported: 1, failed: 0 },
      })),
      generateSuggestion: vi.fn(async () => ({
        recommendedMove: 'send follow-up email',
        suggestedTiming: 'Today',
        confidence: 'Medium',
        confidenceReason: 'Email context is available but notes are missing.',
        reasoning: 'A light email can confirm timing without over-promising.',
        emailDraft: {
          subject: 'Ensuite shower timing',
          body: 'Hi Jane, checking the timing details we have for the ensuite shower. Could you confirm the target date?',
        },
        phoneTalkingPoints: ['Confirm the target date if Jane replies asking for a call.'],
        handoffNotes: 'Generated with missing ServiceM8 notes.',
        partialContextNote: null,
      })),
    })

    const result = await generateLeadAiGuidance({ leadId, triggeredByUserId: userId }, d)

    expect(result).toMatchObject({ ok: true, snapshotId, suggestionId: 'suggestion-1' })
    expect(d.insertSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      sourceStatus: 'partial',
      safeError: expect.stringContaining('ServiceM8 note history could not be fetched.'),
      sourceMetadata: expect.objectContaining({
        partialContext: expect.objectContaining({
          notes: 'ServiceM8 note history could not be fetched.',
          files: 'ServiceM8 file context is partial: 1 unsupported, 0 failed.',
        }),
      }),
    }))
    expect(d.insertSuggestion).toHaveBeenCalledWith(expect.objectContaining({
      partialContextNote: expect.stringContaining('ServiceM8 note history could not be fetched.'),
    }))
  })

  it('records AI Suggestion validation failures with retry metadata', async () => {
    const d = deps({
      generateSuggestion: vi.fn(async () => ({
        recommendedMove: 'call today',
        suggestedTiming: 'Today',
        confidence: '95%',
      })),
    })

    const result = await generateLeadAiGuidance({ leadId, triggeredByUserId: userId }, d)

    expect(result).toEqual({ ok: false, message: 'Lead AI Suggestion output has invalid confidence' })
    expect(d.insertSuggestion).not.toHaveBeenCalled()
    expect(d.recordFailure).toHaveBeenCalledWith({
      leadId,
      conversationSnapshotId: snapshotId,
      triggeredByUserId: userId,
      failureStage: 'ai_suggestion',
      errorType: 'validation_error',
      errorMessage: 'Lead AI Suggestion output has invalid confidence',
      attemptedAt: new Date('2026-07-09T00:00:00Z'),
      retryAfter: new Date('2026-07-09T00:01:00Z'),
      model: 'gpt-4o-mini',
      promptVersion: 'lead-ai-guidance-v1',
      inputSnapshotVersion: 'lead-ai-guidance-input-v1',
    })
  })

  it('blocks generation during the saved suggestion cooldown without creating a snapshot', async () => {
    const d = deps({
      findLatestSuggestion: vi.fn(async () => ({
        createdAt: new Date('2026-07-09T00:00:00Z'),
      })),
      now: () => new Date('2026-07-09T00:04:59Z'),
    })

    const result = await generateLeadAiGuidance({ leadId, triggeredByUserId: userId }, d)

    expect(result).toEqual({
      ok: false,
      message: 'AI Guidance can be regenerated after 9 Jul 2026, 12:05 pm.',
    })
    expect(d.fetchHistory).not.toHaveBeenCalled()
    expect(d.insertSnapshot).not.toHaveBeenCalled()
    expect(d.generateSuggestion).not.toHaveBeenCalled()
  })

  it('blocks retry during the latest Conversation Snapshot failure cooldown before fetching ServiceM8 again', async () => {
    const d = deps({
      findLatestFailure: vi.fn(async () => ({
        retryAfter: new Date('2026-07-09T00:01:00Z'),
        errorMessage: 'AI provider returned HTTP 429.',
      })),
    })

    const result = await generateLeadAiGuidance({ leadId, triggeredByUserId: userId }, d)

    expect(result).toEqual({
      ok: false,
      message: 'AI Guidance can be retried after 9 Jul 2026, 12:01 pm.',
    })
    expect(d.fetchHistory).not.toHaveBeenCalled()
    expect(d.insertSnapshot).not.toHaveBeenCalled()
    expect(d.generateSuggestion).not.toHaveBeenCalled()
  })
})
