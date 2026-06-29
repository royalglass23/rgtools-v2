// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { generateConversationSnapshotForQuote, realConversationSnapshotDeps, type ConversationSnapshotDeps } from '../conversation-snapshot'

const quoteId = '11111111-1111-4111-8111-111111111111'
const userId = '22222222-2222-4222-8222-222222222222'

function deps(overrides: Partial<ConversationSnapshotDeps> = {}): ConversationSnapshotDeps {
  return {
    findQuote: vi.fn(async () => ({
      id: quoteId,
      servicem8Uuid: 'job-uuid-1',
      clientName: 'Jane Smith',
      companyName: null,
      jobDescription: 'Frameless shower',
      jobAddress: '1 Queen Street',
      quoteValue: '4200.00',
      createdAt: new Date('2026-06-10T00:00:00Z'),
    })),
    findLatestSnapshot: vi.fn(async () => null),
    fetchHistory: vi.fn(async () => ({
      notes: [
        { date: '2026-06-12T09:00:00Z', text: 'Customer asked if install can be before July.' },
        { date: '2026-06-01T09:00:00Z', text: 'Older measure booked.' },
      ],
      emails: [
        {
          date: '2026-06-11T09:00:00Z',
          subject: 'Re: shower quote',
          body: 'Can you include low iron glass?',
          direction: 'inbound' as const,
        },
      ],
      sourceStatus: {
        notes: { ok: true, count: 2, latestTimestamp: '2026-06-12T09:00:00Z' },
        emails: { ok: true, count: 1, latestTimestamp: '2026-06-11T09:00:00Z' },
      },
    })),
    summarizeHistory: vi.fn(async () => ({
      customerEmailSummary: 'Jane asked whether low iron glass can be included.',
      internalNotesSummary: 'Install timing before July is the key internal follow-up.',
      openQuestions: ['Can Royal Glass install before July?', 'Does Jane want low iron glass?'],
      lastKnownPosition: 'Customer is reviewing the quote details.',
      importantDates: ['before July'],
      decisionMakers: ['Jane Smith'],
      risksBlockers: ['Timing may decide the job.'],
    })),
    insertSnapshot: vi.fn(async (record) => ({ id: 'snapshot-1', ...record })),
    recordFailure: vi.fn(async () => undefined),
    now: () => new Date('2026-06-13T00:00:00Z'),
    ...overrides,
  }
}

describe('generateConversationSnapshotForQuote', () => {
  it('saves a validated Conversation Snapshot from ServiceM8 history after quote production', async () => {
    const d = deps()

    const result = await generateConversationSnapshotForQuote({ quoteId, triggeredByUserId: userId }, d)

    expect(result).toEqual({ ok: true, snapshotId: 'snapshot-1', partial: false })
    expect(d.fetchHistory).toHaveBeenCalledWith('job-uuid-1')
    expect(d.summarizeHistory).toHaveBeenCalledWith(expect.objectContaining({
      quote: expect.objectContaining({ clientName: 'Jane Smith' }),
      history: {
        notes: [{ date: '2026-06-12T09:00:00Z', text: 'Customer asked if install can be before July.' }],
        emails: [
          {
            date: '2026-06-11T09:00:00Z',
            subject: 'Re: shower quote',
            body: 'Can you include low iron glass?',
            direction: 'inbound' as const,
          },
        ],
      },
    }))
    expect(d.insertSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      quoteId,
      triggeredByUserId: userId,
      summary: 'Jane asked whether low iron glass can be included.\n\nInstall timing before July is the key internal follow-up.',
      structuredSummary: expect.objectContaining({
        customerEmailSummary: 'Jane asked whether low iron glass can be included.',
        internalNotesSummary: 'Install timing before July is the key internal follow-up.',
      }),
      sourceStatus: 'complete',
      sourceMetadata: expect.objectContaining({
        fetchedAt: '2026-06-13T00:00:00.000Z',
        latestNoteTimestamp: '2026-06-12T09:00:00Z',
        latestEmailTimestamp: '2026-06-11T09:00:00Z',
        noteCount: 2,
        emailCount: 1,
      }),
      snapshotCursor: {
        latestNoteTimestamp: '2026-06-12T09:00:00Z',
        latestEmailTimestamp: '2026-06-11T09:00:00Z',
      },
    }))
    const savedRecord = JSON.stringify(vi.mocked(d.insertSnapshot).mock.calls[0]?.[0])
    expect(savedRecord).not.toContain('Customer asked if install can be before July.')
    expect(savedRecord).not.toContain('Can you include low iron glass?')
  })

  it('uses the Snapshot Cursor to summarise only new ServiceM8 history on refresh', async () => {
    const d = deps({
      findLatestSnapshot: vi.fn(async () => ({
        snapshotCursor: {
          latestNoteTimestamp: '2026-06-12T09:00:00Z',
          latestEmailTimestamp: '2026-06-11T09:00:00Z',
        },
      })),
      fetchHistory: vi.fn(async () => ({
        notes: [
          { date: '2026-06-15T09:00:00Z', text: 'Customer confirmed low iron glass.' },
          { date: '2026-06-12T09:00:00Z', text: 'Already summarised note.' },
        ],
        emails: [
          {
            date: '2026-06-16T09:00:00Z',
            subject: 'Go ahead',
            body: 'Please proceed with the revised quote.',
            direction: 'inbound' as const,
          },
          {
            date: '2026-06-11T09:00:00Z',
            subject: 'Already summarised',
            body: 'Old email.',
            direction: 'inbound' as const,
          },
        ],
        sourceStatus: {
          notes: { ok: true, count: 2, latestTimestamp: '2026-06-15T09:00:00Z' },
          emails: { ok: true, count: 2, latestTimestamp: '2026-06-16T09:00:00Z' },
        },
      })),
    })

    const result = await generateConversationSnapshotForQuote({ quoteId, triggeredByUserId: userId }, d)

    expect(result).toEqual({ ok: true, snapshotId: 'snapshot-1', partial: false })
    expect(d.summarizeHistory).toHaveBeenCalledWith(expect.objectContaining({
      previousCursor: {
        latestNoteTimestamp: '2026-06-12T09:00:00Z',
        latestEmailTimestamp: '2026-06-11T09:00:00Z',
      },
      history: {
        notes: [{ date: '2026-06-15T09:00:00Z', text: 'Customer confirmed low iron glass.' }],
        emails: [
          {
            date: '2026-06-16T09:00:00Z',
            subject: 'Go ahead',
            body: 'Please proceed with the revised quote.',
            direction: 'inbound' as const,
          },
        ],
      },
    }))
    expect(d.insertSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      snapshotCursor: {
        latestNoteTimestamp: '2026-06-15T09:00:00Z',
        latestEmailTimestamp: '2026-06-16T09:00:00Z',
      },
    }))
  })

  it('saves partial context when notes succeed but emails fail', async () => {
    const d = deps({
      fetchHistory: vi.fn(async () => ({
        notes: [
          { date: '2026-06-12T09:00:00Z', text: 'Customer needs the shower ready before July.' },
        ],
        emails: [],
        sourceStatus: {
          notes: { ok: true, count: 1, latestTimestamp: '2026-06-12T09:00:00Z' },
          emails: { ok: false, count: 0, latestTimestamp: null, safeError: 'Email history could not be fetched.' },
        },
      })),
    })

    const result = await generateConversationSnapshotForQuote({ quoteId, triggeredByUserId: userId }, d)

    expect(result).toEqual({ ok: true, snapshotId: 'snapshot-1', partial: true })
    expect(d.insertSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      sourceStatus: 'partial',
      safeError: 'Email history could not be fetched.',
      sourceMetadata: expect.objectContaining({
        emailCount: 0,
        sourceStatus: expect.objectContaining({
          emails: expect.objectContaining({ ok: false, safeError: 'Email history could not be fetched.' }),
        }),
      }),
    }))
  })

  it('saves partial context when emails succeed but notes fail', async () => {
    const d = deps({
      fetchHistory: vi.fn(async () => ({
        notes: [],
        emails: [
          {
            date: '2026-06-12T09:00:00Z',
            subject: 'Re: shower quote',
            body: 'Can you include low iron glass?',
            direction: 'inbound' as const,
          },
        ],
        sourceStatus: {
          notes: { ok: false, count: 0, latestTimestamp: null, safeError: 'Note history could not be fetched.' },
          emails: { ok: true, count: 1, latestTimestamp: '2026-06-12T09:00:00Z' },
        },
      })),
    })

    const result = await generateConversationSnapshotForQuote({ quoteId, triggeredByUserId: userId }, d)

    expect(result).toEqual({ ok: true, snapshotId: 'snapshot-1', partial: true })
    expect(d.insertSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      sourceStatus: 'partial',
      safeError: 'Note history could not be fetched.',
      sourceMetadata: expect.objectContaining({
        noteCount: 0,
        emailCount: 1,
        sourceStatus: expect.objectContaining({
          notes: expect.objectContaining({ ok: false, safeError: 'Note history could not be fetched.' }),
        }),
      }),
    }))
  })

  it('stores a failed attempt when ServiceM8 history cannot be fetched', async () => {
    const d = deps({
      fetchHistory: vi.fn(async () => {
        throw new Error('ServiceM8 request failed after 5 attempts with HTTP 429')
      }),
    })

    const result = await generateConversationSnapshotForQuote({ quoteId, triggeredByUserId: userId }, d)

    expect(result).toEqual({ ok: false, message: 'ServiceM8 request failed after 5 attempts with HTTP 429' })
    expect(d.summarizeHistory).not.toHaveBeenCalled()
    expect(d.insertSnapshot).not.toHaveBeenCalled()
    expect(d.recordFailure).toHaveBeenCalledWith({
      quoteId,
      triggeredByUserId: userId,
      failureStage: 'conversation_snapshot',
      errorMessage: 'ServiceM8 request failed after 5 attempts with HTTP 429',
    })
  })

  it('rejects non-structured AI output before saving', async () => {
    const d = deps({
      summarizeHistory: vi.fn(async () => ({
        customerEmailSummary: 'Missing required fields.',
      })),
    })

    const result = await generateConversationSnapshotForQuote({ quoteId, triggeredByUserId: userId }, d)

    expect(result.ok).toBe(false)
    expect(d.insertSnapshot).not.toHaveBeenCalled()
    expect(d.recordFailure).toHaveBeenCalledWith(expect.objectContaining({
      failureStage: 'conversation_snapshot',
      errorMessage: 'Conversation Snapshot summary missing internalNotesSummary',
    }))
  })

  it('requests a strict Conversation Snapshot JSON schema from OpenAI', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              customerEmailSummary: 'Jane asked whether low iron glass can be included.',
              internalNotesSummary: 'Install timing before July is the key internal follow-up.',
              openQuestions: ['Can Royal Glass install before July?'],
              lastKnownPosition: 'Customer is reviewing the quote details.',
              importantDates: ['before July'],
              decisionMakers: ['Jane Smith'],
              risksBlockers: ['Timing may decide the job.'],
            }),
          },
        }],
      }),
      text: async () => '',
    } as Response)

    await realConversationSnapshotDeps.summarizeHistory({
      quote: {
        id: quoteId,
        servicem8Uuid: 'job-uuid-1',
        clientName: 'Jane Smith',
        companyName: null,
        jobDescription: 'Frameless shower',
        jobAddress: '1 Queen Street',
        quoteValue: '4200.00',
        createdAt: new Date('2026-06-10T00:00:00Z'),
      },
      history: {
        notes: [{ date: '2026-06-12T09:00:00Z', text: 'Customer asked if install can be before July.' }],
        emails: [{
          date: '2026-06-11T09:00:00Z',
          subject: 'Re: shower quote',
          body: 'Can you include low iron glass?',
          direction: 'inbound',
        }],
      },
      previousCursor: null,
    })

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body?.toString() ?? '{}')
    expect(requestBody.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: {
        name: 'quote_conversation_snapshot',
        strict: true,
        schema: {
          required: expect.arrayContaining(['customerEmailSummary', 'internalNotesSummary']),
        },
      },
    })
  })
})
