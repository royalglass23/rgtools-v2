// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  loadLifecycleHandoffContext,
  type LifecycleHandoffDeps,
  type LifecycleLeadContext,
  type LifecycleQuoteContext,
} from '../lifecycle-handoff'
import type { ServiceM8ConversationSnapshotHistory } from '@/lib/servicem8/client'
import type { ServiceM8FileContext } from '../servicem8-file-context'

const now = new Date('2026-07-09T02:30:00Z')

function leadContext(overrides: Partial<LifecycleLeadContext> = {}): LifecycleLeadContext {
  return {
    id: 'lead-1',
    clientId: 'client-1',
    contactId: 'contact-1',
    clientName: 'Vivi Zhang',
    companyName: 'Vivi Homes',
    phone: '021 000 000',
    email: 'vivi@example.test',
    location: 'Albany',
    channel: 'phone',
    source: 'existing_client_referral_repeat_builder_architect',
    product: 'Balustrade',
    projectType: 'new_build_commercial_fit_out',
    jobDescription: 'Balcony balustrade for new build.',
    tier: 'B',
    seedScore: 76,
    completeness: 11,
    scoreReason: 'Warm builder with clear scope.',
    servicem8JobUuid: 'job-1',
    servicem8JobNumber: 'JOB-101',
    servicem8Status: 'Quote',
    createdAt: new Date('2026-07-07T00:00:00Z'),
    updatedAt: new Date('2026-07-08T00:00:00Z'),
    client: {
      id: 'client-1',
      servicem8CompanyUuid: 'company-1',
      name: 'Vivi Zhang',
      companyName: 'Vivi Homes',
      email: 'vivi@example.test',
      phone: '021 000 000',
      identityType: 'company',
      reviewStatus: 'reviewed',
      updatedAt: new Date('2026-07-08T00:00:00Z'),
    },
    contacts: [
      {
        id: 'contact-1',
        name: 'Vivi Zhang',
        email: 'vivi@example.test',
        phone: '021 000 000',
        phoneNormalized: '6421000000',
        updatedAt: new Date('2026-07-08T00:00:00Z'),
      },
    ],
    ...overrides,
  }
}

function quoteContext(overrides: Partial<LifecycleQuoteContext> = {}): LifecycleQuoteContext {
  return {
    id: 'quote-1',
    servicem8Uuid: 'job-1',
    servicem8CompanyUuid: 'company-1',
    clientId: 'client-1',
    clientName: 'Vivi Zhang',
    companyName: 'Vivi Homes',
    jobDescription: 'Supply and install balcony balustrade.',
    jobAddress: '1 Queen Street',
    quoteValue: '12500.00',
    statusTag: 'hot',
    aiScore: 82,
    pipelineStage: 'quote_sent',
    createdAt: new Date('2026-07-08T00:00:00Z'),
    updatedAt: new Date('2026-07-08T02:00:00Z'),
    engagement: {
      totalOpens: 4,
      uniqueSessions: 2,
      totalTimeMs: 360000,
      maxScrollDepth: 92,
      forwardingSuspected: false,
      lastOpenedAt: new Date('2026-07-09T00:00:00Z'),
    },
    ...overrides,
  }
}

function history(overrides: Partial<ServiceM8ConversationSnapshotHistory> = {}): ServiceM8ConversationSnapshotHistory {
  return {
    notes: [{ date: '2026-07-08T01:00:00Z', text: 'Customer wants site measure next week.' }],
    emails: [{ date: '2026-07-08T03:00:00Z', subject: 'Balustrade quote', body: 'Please confirm timing.', direction: 'inbound' }],
    sourceStatus: {
      notes: { ok: true, count: 1, latestTimestamp: '2026-07-08T01:00:00Z' },
      emails: { ok: true, count: 1, latestTimestamp: '2026-07-08T03:00:00Z' },
    },
    ...overrides,
  }
}

function fileContext(overrides: Partial<ServiceM8FileContext> = {}): ServiceM8FileContext {
  return {
    servicem8JobUuid: 'job-1',
    files: [
      {
        servicem8AttachmentUuid: 'attachment-1',
        servicem8JobUuid: 'job-1',
        name: 'site-photo.jpg',
        fileType: 'image/jpeg',
        attachmentSource: 'JOB',
        editDate: '2026-07-08T00:00:00Z',
        status: 'interpreted',
        summary: 'Photo shows clear access to the balcony edge.',
        model: 'test-vision-model',
        interpretedAt: new Date('2026-07-08T04:00:00Z'),
        errorMessage: null,
        errorMetadata: {},
      },
    ],
    sourceStatus: { status: 'complete', total: 1, interpreted: 1, unsupported: 0, failed: 0 },
    ...overrides,
  }
}

function createDeps(overrides: Partial<LifecycleHandoffDeps> = {}): LifecycleHandoffDeps {
  return {
    findLeadContext: vi.fn(async () => leadContext()),
    findQuoteContext: vi.fn(async () => null),
    findLatestLeadGuidance: vi.fn(async () => ({ conversationSnapshot: null, aiSuggestion: null })),
    findLatestQuoteGuidance: vi.fn(async () => ({ conversationSnapshot: null, aiSuggestion: null })),
    findReviewerNotes: vi.fn(async () => []),
    fetchHistory: vi.fn(async () => history()),
    buildFileContext: vi.fn(async () => fileContext()),
    now: vi.fn(() => now),
    ...overrides,
  }
}

describe('loadLifecycleHandoffContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads Lead context for a ServiceM8-linked job', async () => {
    const deps = createDeps()

    const context = await loadLifecycleHandoffContext({ servicem8JobUuid: 'job-1' }, deps)

    expect(context.lead?.id).toBe('lead-1')
    expect(context.lead?.client.name).toBe('Vivi Zhang')
    expect(context.lead?.contacts).toHaveLength(1)
    expect(context.serviceM8History.notes[0]?.text).toContain('site measure')
    expect(context.sourceMetadata.sources.lead).toEqual({ status: 'found', id: 'lead-1' })
  })

  it('includes Quote Tracker context when a tracked quote exists for the same ServiceM8 job', async () => {
    const deps = createDeps({
      findQuoteContext: vi.fn(async () => quoteContext()),
    })

    const context = await loadLifecycleHandoffContext({ servicem8JobUuid: 'job-1' }, deps)

    expect(context.quote).toMatchObject({
      id: 'quote-1',
      servicem8Uuid: 'job-1',
      quoteValue: '12500.00',
      statusTag: 'hot',
    })
    expect(context.quote?.engagement?.totalOpens).toBe(4)
    expect(context.sourceMetadata.sources.quote).toEqual({ status: 'found', id: 'quote-1' })
  })

  it('keeps Lead and Quote guidance separate when both exist', async () => {
    const leadSnapshot = {
      id: 'lead-snapshot-1',
      summary: 'Lead handoff summary.',
      structuredSummary: { customerNeed: 'Balustrade' },
      sourceStatus: 'complete',
      sourceMetadata: { fetchedAt: '2026-07-08T01:00:00Z' },
      safeError: null,
      capturedAt: new Date('2026-07-08T01:00:00Z'),
      createdAt: new Date('2026-07-08T01:00:00Z'),
    }
    const quoteSuggestion = {
      id: 'quote-suggestion-1',
      recommendedMove: 'call today',
      reasoning: 'High engagement and clear timing.',
      partialContextNote: null,
      createdAt: new Date('2026-07-09T01:00:00Z'),
    }
    const deps = createDeps({
      findQuoteContext: vi.fn(async () => quoteContext()),
      findLatestLeadGuidance: vi.fn(async () => ({ conversationSnapshot: leadSnapshot, aiSuggestion: null })),
      findLatestQuoteGuidance: vi.fn(async () => ({ conversationSnapshot: null, aiSuggestion: quoteSuggestion })),
    })

    const context = await loadLifecycleHandoffContext({ servicem8JobUuid: 'job-1' }, deps)

    expect(context.guidance.lead.conversationSnapshot).toBe(leadSnapshot)
    expect(context.guidance.quote.aiSuggestion).toBe(quoteSuggestion)
    expect(context.sourceMetadata.latestTimestamps.latestLeadSnapshotAt).toBe('2026-07-08T01:00:00.000Z')
    expect(context.sourceMetadata.latestTimestamps.latestQuoteSuggestionAt).toBe('2026-07-09T01:00:00.000Z')
  })

  it('supports quote-only handoff context without Lead guidance or reviewer notes', async () => {
    const deps = createDeps({
      findLeadContext: vi.fn(async () => null),
      findQuoteContext: vi.fn(async () => quoteContext()),
    })

    const context = await loadLifecycleHandoffContext({ servicem8JobUuid: 'job-1' }, deps)

    expect(context.lead).toBeNull()
    expect(context.quote?.id).toBe('quote-1')
    expect(context.reviewerNotes).toEqual([])
    expect(deps.findReviewerNotes).not.toHaveBeenCalled()
    expect(deps.findLatestLeadGuidance).not.toHaveBeenCalled()
  })

  it('returns no-guidance records as nulls while preserving source metadata', async () => {
    const deps = createDeps({
      findQuoteContext: vi.fn(async () => quoteContext()),
      findLatestLeadGuidance: vi.fn(async () => ({ conversationSnapshot: null, aiSuggestion: null })),
      findLatestQuoteGuidance: vi.fn(async () => ({ conversationSnapshot: null, aiSuggestion: null })),
    })

    const context = await loadLifecycleHandoffContext({ servicem8JobUuid: 'job-1' }, deps)

    expect(context.guidance).toEqual({
      lead: { conversationSnapshot: null, aiSuggestion: null },
      quote: { conversationSnapshot: null, aiSuggestion: null },
    })
    expect(context.sourceMetadata.sources.leadGuidance).toEqual({ status: 'none' })
    expect(context.sourceMetadata.sources.quoteGuidance).toEqual({ status: 'none' })
  })

  it('captures partial ServiceM8 file context and safe history failures for downstream handoff', async () => {
    const deps = createDeps({
      fetchHistory: vi.fn(async () => history({
        sourceStatus: {
          notes: { ok: false, count: 0, latestTimestamp: null, safeError: 'ServiceM8 notes could not be fetched.' },
          emails: { ok: true, count: 1, latestTimestamp: '2026-07-08T03:00:00Z' },
        },
      })),
      buildFileContext: vi.fn(async () => fileContext({
        files: [
          fileContext().files[0]!,
          {
            servicem8AttachmentUuid: 'attachment-failed',
            servicem8JobUuid: 'job-1',
            name: 'broken.pdf',
            fileType: 'application/pdf',
            attachmentSource: 'JOB',
            editDate: '2026-07-08T05:00:00Z',
            status: 'failed',
            summary: null,
            model: null,
            interpretedAt: new Date('2026-07-08T05:05:00Z'),
            errorMessage: 'File interpretation failed for broken.pdf: AI provider returned HTTP 429.',
            errorMetadata: { errorType: 'ai_response_error' },
          },
        ],
        sourceStatus: { status: 'partial', total: 2, interpreted: 1, unsupported: 0, failed: 1 },
      })),
    })

    const context = await loadLifecycleHandoffContext({ servicem8JobUuid: 'job-1' }, deps)

    expect(context.fileContext.sourceStatus.status).toBe('partial')
    expect(context.sourceMetadata.sources.serviceM8History).toEqual({
      status: 'partial',
      safeError: 'ServiceM8 notes could not be fetched.',
    })
    expect(context.sourceMetadata.sources.files).toEqual({
      status: 'partial',
      total: 2,
      interpreted: 1,
      unsupported: 0,
      failed: 1,
    })
  })

  it('preserves unsupported-file metadata in the handoff read model', async () => {
    const deps = createDeps({
      buildFileContext: vi.fn(async () => fileContext({
        files: [
          {
            servicem8AttachmentUuid: 'attachment-cad',
            servicem8JobUuid: 'job-1',
            name: 'shop-drawing.dwg',
            fileType: 'application/acad',
            attachmentSource: 'JOB',
            editDate: '2026-07-08T05:00:00Z',
            status: 'unsupported',
            summary: null,
            model: null,
            interpretedAt: null,
            errorMessage: 'CAD files are detected but not interpreted in v1.',
            errorMetadata: { errorType: 'unsupported_cad' },
          },
        ],
        sourceStatus: { status: 'partial', total: 1, interpreted: 0, unsupported: 1, failed: 0 },
      })),
    })

    const context = await loadLifecycleHandoffContext({ servicem8JobUuid: 'job-1' }, deps)

    expect(context.fileContext.files[0]).toMatchObject({
      name: 'shop-drawing.dwg',
      status: 'unsupported',
      errorMessage: 'CAD files are detected but not interpreted in v1.',
      errorMetadata: { errorType: 'unsupported_cad' },
    })
    expect(context.sourceMetadata.sources.files).toMatchObject({ unsupported: 1, failed: 0 })
  })
})
