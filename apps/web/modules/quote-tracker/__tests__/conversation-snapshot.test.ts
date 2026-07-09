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
    buildFileContext: vi.fn(async () => ({
      servicem8JobUuid: 'job-uuid-1',
      files: [],
      sourceStatus: { status: 'complete' as const, total: 0, interpreted: 0, unsupported: 0, failed: 0 },
    })),
    summarizeHistory: vi.fn(async () => ({
      customerEmailSummary: 'Jane asked whether low iron glass can be included.',
      internalNotesSummary: 'Install timing before July is the key internal follow-up.',
      fileContextSummary: 'No ServiceM8 files were found for this quote.',
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
    expect(d.buildFileContext).toHaveBeenCalledWith('job-uuid-1')
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
      fileContext: expect.objectContaining({
        sourceStatus: { status: 'complete', total: 0, interpreted: 0, unsupported: 0, failed: 0 },
        files: [],
      }),
    }))
    expect(d.insertSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      quoteId,
      triggeredByUserId: userId,
      summary: 'Jane asked whether low iron glass can be included.\n\nInstall timing before July is the key internal follow-up.\n\nNo ServiceM8 files were found for this quote.',
      structuredSummary: expect.objectContaining({
        customerEmailSummary: 'Jane asked whether low iron glass can be included.',
        internalNotesSummary: 'Install timing before July is the key internal follow-up.',
        fileContextSummary: 'No ServiceM8 files were found for this quote.',
      }),
      sourceStatus: 'complete',
      sourceMetadata: expect.objectContaining({
        fetchedAt: '2026-06-13T00:00:00.000Z',
        latestNoteTimestamp: '2026-06-12T09:00:00Z',
        latestEmailTimestamp: '2026-06-11T09:00:00Z',
        noteCount: 2,
        emailCount: 1,
        fileCount: 0,
        interpretedFileCount: 0,
        unsupportedFileCount: 0,
        failedFileCount: 0,
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

  it('includes interpreted and unsupported ServiceM8 file context in the saved Conversation Snapshot', async () => {
    const d = deps({
      buildFileContext: vi.fn(async () => ({
        servicem8JobUuid: 'job-uuid-1',
        files: [
          {
            servicem8AttachmentUuid: 'attachment-photo-1',
            servicem8JobUuid: 'job-uuid-1',
            name: 'site-photo.jpg',
            fileType: 'image/jpeg',
            attachmentSource: 'Job',
            editDate: '2026-06-12T10:00:00Z',
            status: 'interpreted' as const,
            summary: 'Photo shows a tiled shower opening with a nib wall on the left.',
            model: 'gpt-4o-mini',
            interpretedAt: new Date('2026-06-13T00:00:00Z'),
            errorMessage: null,
            errorMetadata: {},
          },
          {
            servicem8AttachmentUuid: 'attachment-plan-1',
            servicem8JobUuid: 'job-uuid-1',
            name: 'layout.pdf',
            fileType: 'application/pdf',
            attachmentSource: 'Job',
            editDate: '2026-06-12T11:00:00Z',
            status: 'interpreted' as const,
            summary: 'PDF shows a 980mm wide shower screen beside the vanity.',
            model: 'gpt-4o-mini',
            interpretedAt: new Date('2026-06-13T00:00:00Z'),
            errorMessage: null,
            errorMetadata: {},
          },
          {
            servicem8AttachmentUuid: 'attachment-cad-1',
            servicem8JobUuid: 'job-uuid-1',
            name: 'shop-drawing.dwg',
            fileType: 'application/acad',
            attachmentSource: 'Job',
            editDate: '2026-06-12T12:00:00Z',
            status: 'unsupported' as const,
            summary: null,
            model: null,
            interpretedAt: null,
            errorMessage: 'CAD files are detected but not interpreted in v1.',
            errorMetadata: { errorType: 'unsupported_cad' },
          },
        ],
        sourceStatus: { status: 'partial' as const, total: 3, interpreted: 2, unsupported: 1, failed: 0 },
      })),
      summarizeHistory: vi.fn(async () => ({
        customerEmailSummary: 'Jane asked whether low iron glass can be included.',
        internalNotesSummary: 'Install timing before July is the key internal follow-up.',
        fileContextSummary: 'Site photo and PDF show a tiled shower opening with a 980mm shower screen. One CAD file was not interpreted.',
        openQuestions: ['Confirm whether the nib wall needs a channel detail.'],
        lastKnownPosition: 'Customer is reviewing the quote details.',
        importantDates: ['before July'],
        decisionMakers: ['Jane Smith'],
        risksBlockers: ['CAD detail needs manual review.'],
      })),
    })

    const result = await generateConversationSnapshotForQuote({ quoteId, triggeredByUserId: userId }, d)

    expect(result).toEqual({ ok: true, snapshotId: 'snapshot-1', partial: true })
    expect(d.summarizeHistory).toHaveBeenCalledWith(expect.objectContaining({
      fileContext: expect.objectContaining({
        sourceStatus: { status: 'partial', total: 3, interpreted: 2, unsupported: 1, failed: 0 },
        files: expect.arrayContaining([
          expect.objectContaining({
            name: 'site-photo.jpg',
            status: 'interpreted',
            summary: 'Photo shows a tiled shower opening with a nib wall on the left.',
          }),
          expect.objectContaining({
            name: 'layout.pdf',
            status: 'interpreted',
            summary: 'PDF shows a 980mm wide shower screen beside the vanity.',
          }),
          expect.objectContaining({
            name: 'shop-drawing.dwg',
            status: 'unsupported',
            errorMessage: 'CAD files are detected but not interpreted in v1.',
          }),
        ]),
      }),
    }))
    expect(d.insertSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      sourceStatus: 'partial',
      safeError: 'ServiceM8 file context is partial: 1 unsupported, 0 failed.',
      structuredSummary: expect.objectContaining({
        fileContextSummary: 'Site photo and PDF show a tiled shower opening with a 980mm shower screen. One CAD file was not interpreted.',
      }),
      sourceMetadata: expect.objectContaining({
        fileCount: 3,
        interpretedFileCount: 2,
        unsupportedFileCount: 1,
        failedFileCount: 0,
        partialContext: {
          files: 'ServiceM8 file context is partial: 1 unsupported, 0 failed.',
        },
      }),
    }))
  })

  it('keeps saving a partial Conversation Snapshot when file interpretation fails', async () => {
    const d = deps({
      buildFileContext: vi.fn(async () => ({
        servicem8JobUuid: 'job-uuid-1',
        files: [
          {
            servicem8AttachmentUuid: 'attachment-photo-2',
            servicem8JobUuid: 'job-uuid-1',
            name: 'balustrade-photo.jpg',
            fileType: 'image/jpeg',
            attachmentSource: 'Job',
            editDate: '2026-06-12T10:00:00Z',
            status: 'failed' as const,
            summary: null,
            model: null,
            interpretedAt: new Date('2026-06-13T00:00:00Z'),
            errorMessage: 'File interpretation failed for balustrade-photo.jpg: OpenAI returned HTTP 500.',
            errorMetadata: { errorType: 'ai_response_error' },
          },
        ],
        sourceStatus: { status: 'partial' as const, total: 1, interpreted: 0, unsupported: 0, failed: 1 },
      })),
      summarizeHistory: vi.fn(async () => ({
        customerEmailSummary: 'Jane asked whether low iron glass can be included.',
        internalNotesSummary: 'Install timing before July is the key internal follow-up.',
        fileContextSummary: 'One ServiceM8 photo could not be interpreted, so staff should review it manually.',
        openQuestions: ['Review failed photo manually before follow-up.'],
        lastKnownPosition: 'Customer is reviewing the quote details.',
        importantDates: ['before July'],
        decisionMakers: ['Jane Smith'],
        risksBlockers: ['File context is partial.'],
      })),
    })

    const result = await generateConversationSnapshotForQuote({ quoteId, triggeredByUserId: userId }, d)

    expect(result).toEqual({ ok: true, snapshotId: 'snapshot-1', partial: true })
    expect(d.insertSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      sourceStatus: 'partial',
      safeError: 'ServiceM8 file context is partial: 0 unsupported, 1 failed.',
      sourceMetadata: expect.objectContaining({
        fileCount: 1,
        interpretedFileCount: 0,
        unsupportedFileCount: 0,
        failedFileCount: 1,
        partialContext: {
          files: 'ServiceM8 file context is partial: 0 unsupported, 1 failed.',
        },
      }),
    }))
    expect(d.recordFailure).not.toHaveBeenCalled()
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

  it('returns a staff-readable message when OpenAI times out', async () => {
    const d = deps({
      summarizeHistory: vi.fn(async () => {
        throw Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' })
      }),
    })

    const result = await generateConversationSnapshotForQuote({ quoteId, triggeredByUserId: userId }, d)

    expect(result).toEqual({
      ok: false,
      message: 'AI Guidance took longer than 5 minutes, so it was stopped. Please try again.',
    })
    expect(d.recordFailure).toHaveBeenCalledWith(expect.objectContaining({
      failureStage: 'conversation_snapshot',
      errorMessage: 'AI Guidance took longer than 5 minutes, so it was stopped. Please try again.',
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
              fileContextSummary: 'No ServiceM8 files were found for this quote.',
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
      fileContext: {
        servicem8JobUuid: 'job-uuid-1',
        files: [],
        sourceStatus: { status: 'complete', total: 0, interpreted: 0, unsupported: 0, failed: 0 },
      },
      previousCursor: null,
    })

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body?.toString() ?? '{}')
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
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
