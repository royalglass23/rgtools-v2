// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildServiceM8FileContext,
  type InterpretedServiceM8File,
  type ServiceM8FileContextDeps,
  type ServiceM8JobAttachment,
} from '../servicem8-file-context'

const interpretedAt = new Date('2026-07-09T01:00:00Z')

function attachment(overrides: Partial<ServiceM8JobAttachment> = {}): ServiceM8JobAttachment {
  return {
    servicem8AttachmentUuid: 'attachment-1',
    servicem8JobUuid: 'job-1',
    name: 'site-photo.jpg',
    fileType: 'image/jpeg',
    attachmentSource: 'JOB',
    editDate: '2026-07-09T00:00:00Z',
    ...overrides,
  }
}

function interpretedFile(overrides: Partial<InterpretedServiceM8File> = {}): InterpretedServiceM8File {
  return {
    servicem8AttachmentUuid: 'attachment-1',
    servicem8JobUuid: 'job-1',
    name: 'site-photo.jpg',
    fileType: 'image/jpeg',
    attachmentSource: 'JOB',
    editDate: '2026-07-09T00:00:00Z',
    status: 'interpreted',
    summary: 'Photo shows a balcony balustrade opening ready for measure.',
    model: 'test-vision-model',
    interpretedAt,
    errorMessage: null,
    errorMetadata: {},
    ...overrides,
  }
}

function createDeps(rows: ServiceM8JobAttachment[]): ServiceM8FileContextDeps {
  const saved: InterpretedServiceM8File[] = []

  return {
    listJobAttachments: vi.fn(async () => rows),
    findCachedFile: vi.fn(async () => null),
    downloadAttachment: vi.fn(async () => new TextEncoder().encode('raw-bytes').buffer),
    interpretFile: vi.fn(async ({ attachment }) => ({
      summary: `Interpreted ${attachment.name}`,
      model: 'test-vision-model',
    })),
    saveFile: vi.fn(async (record) => {
      saved.push(record)
      return record
    }),
    now: vi.fn(() => interpretedAt),
  }
}

describe('buildServiceM8FileContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reuses a cached interpretation when the ServiceM8 attachment UUID and edit date match', async () => {
    const deps = createDeps([attachment()])
    const cached = interpretedFile({ summary: 'Cached summary from the previous run.' })
    vi.mocked(deps.findCachedFile).mockResolvedValue(cached)

    const context = await buildServiceM8FileContext({ servicem8JobUuid: 'job-1' }, deps)

    expect(context.files).toEqual([cached])
    expect(context.sourceStatus).toEqual({ status: 'complete', total: 1, interpreted: 1, unsupported: 0, failed: 0 })
    expect(deps.findCachedFile).toHaveBeenCalledWith('attachment-1', '2026-07-09T00:00:00Z')
    expect(deps.downloadAttachment).not.toHaveBeenCalled()
    expect(deps.interpretFile).not.toHaveBeenCalled()
    expect(deps.saveFile).not.toHaveBeenCalled()
  })

  it('reinterprets and saves a new cache entry when the edit date has changed', async () => {
    const changed = attachment({ editDate: '2026-07-09T02:00:00Z' })
    const deps = createDeps([changed])

    const context = await buildServiceM8FileContext({ servicem8JobUuid: 'job-1' }, deps)

    expect(deps.findCachedFile).toHaveBeenCalledWith('attachment-1', '2026-07-09T02:00:00Z')
    expect(deps.downloadAttachment).toHaveBeenCalledWith('attachment-1')
    expect(context.files[0]).toMatchObject({
      servicem8AttachmentUuid: 'attachment-1',
      editDate: '2026-07-09T02:00:00Z',
      status: 'interpreted',
      summary: 'Interpreted site-photo.jpg',
      model: 'test-vision-model',
    })
  })

  it('interprets image and PDF attachments and saves interpreted cache rows', async () => {
    const image = attachment({ servicem8AttachmentUuid: 'image-1', name: 'balcony.jpg', fileType: 'image/jpeg' })
    const pdf = attachment({ servicem8AttachmentUuid: 'pdf-1', name: 'site-plan.pdf', fileType: 'application/pdf' })
    const deps = createDeps([image, pdf])

    const context = await buildServiceM8FileContext({ servicem8JobUuid: 'job-1' }, deps)

    expect(context.files).toHaveLength(2)
    expect(context.files.map((file) => file.status)).toEqual(['interpreted', 'interpreted'])
    expect(deps.downloadAttachment).toHaveBeenCalledWith('image-1')
    expect(deps.downloadAttachment).toHaveBeenCalledWith('pdf-1')
    expect(deps.saveFile).toHaveBeenCalledWith(expect.objectContaining({
      servicem8AttachmentUuid: 'image-1',
      status: 'interpreted',
      errorMessage: null,
    }))
    expect(deps.saveFile).toHaveBeenCalledWith(expect.objectContaining({
      servicem8AttachmentUuid: 'pdf-1',
      status: 'interpreted',
      errorMessage: null,
    }))
  })

  it('saves CAD and other unsupported files as unsupported metadata without downloading them', async () => {
    const cad = attachment({ servicem8AttachmentUuid: 'cad-1', name: 'shop-drawing.dwg', fileType: 'application/acad' })
    const spreadsheet = attachment({ servicem8AttachmentUuid: 'xlsx-1', name: 'supplier-list.xlsx', fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const deps = createDeps([cad, spreadsheet])

    const context = await buildServiceM8FileContext({ servicem8JobUuid: 'job-1' }, deps)

    expect(context.sourceStatus).toEqual({ status: 'partial', total: 2, interpreted: 0, unsupported: 2, failed: 0 })
    expect(deps.downloadAttachment).not.toHaveBeenCalled()
    expect(context.files).toEqual([
      expect.objectContaining({
        servicem8AttachmentUuid: 'cad-1',
        status: 'unsupported',
        errorMessage: 'CAD files are detected but not interpreted in v1.',
      }),
      expect.objectContaining({
        servicem8AttachmentUuid: 'xlsx-1',
        status: 'unsupported',
        errorMessage: 'Unsupported ServiceM8 attachment type for AI Guidance v1.',
      }),
    ])
  })

  it('records failed file interpretation and keeps building the rest of the job context', async () => {
    const brokenPdf = attachment({ servicem8AttachmentUuid: 'pdf-1', name: 'broken.pdf', fileType: 'application/pdf' })
    const usableImage = attachment({ servicem8AttachmentUuid: 'image-1', name: 'balcony.jpg', fileType: 'image/jpeg' })
    const deps = createDeps([brokenPdf, usableImage])
    vi.mocked(deps.interpretFile)
      .mockRejectedValueOnce(new Error('OpenAI returned HTTP 429: quota detail that should be trimmed safely'))
      .mockResolvedValueOnce({ summary: 'Interpreted balcony.jpg', model: 'test-vision-model' })

    const context = await buildServiceM8FileContext({ servicem8JobUuid: 'job-1' }, deps)

    expect(context.sourceStatus).toEqual({ status: 'partial', total: 2, interpreted: 1, unsupported: 0, failed: 1 })
    expect(context.files).toEqual([
      expect.objectContaining({
        servicem8AttachmentUuid: 'pdf-1',
        status: 'failed',
        summary: null,
        errorMessage: 'File interpretation failed for broken.pdf: OpenAI returned HTTP 429.',
        errorMetadata: { errorType: 'ai_response_error' },
      }),
      expect.objectContaining({
        servicem8AttachmentUuid: 'image-1',
        status: 'interpreted',
        summary: 'Interpreted balcony.jpg',
      }),
    ])
  })

  it('does not persist raw downloaded bytes in saved records or returned context', async () => {
    const deps = createDeps([attachment()])
    const rawBytes = new Uint8Array([1, 2, 3, 4]).buffer
    vi.mocked(deps.downloadAttachment).mockResolvedValue(rawBytes)

    const context = await buildServiceM8FileContext({ servicem8JobUuid: 'job-1' }, deps)

    expect(deps.interpretFile).toHaveBeenCalledWith(expect.objectContaining({ bytes: rawBytes }))
    const savedRecord = vi.mocked(deps.saveFile).mock.calls[0]?.[0] as Record<string, unknown>
    expect(savedRecord.bytes).toBeUndefined()
    expect((context.files[0] as Record<string, unknown>).bytes).toBeUndefined()
  })
})
