import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const selectRows = vi.fn<() => unknown[]>()
  const insertValues = vi.fn()
  const conflictSet = vi.fn()
  const insertReturningRows = vi.fn<() => unknown[]>()
  const auditValues = vi.fn()
  const put = vi.fn()
  const deleteObject = vi.fn()
  const createServiceM8RequestFromEnv = vi.fn()
  const getJobQuoteMeta = vi.fn()
  const getQuoteAttachmentPdf = vi.fn()
  const generateShortCode = vi.fn()

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(selectRows())),
        })),
      })),
    })),
    insert: vi.fn((table: unknown) => {
      if (table && typeof table === 'object' && 'action' in table) {
        return {
          values: auditValues,
        }
      }

      return {
        values: insertValues.mockImplementation(() => ({
          onConflictDoUpdate: conflictSet.mockImplementation(() => ({
            returning: vi.fn(() => Promise.resolve(insertReturningRows())),
          })),
        })),
      }
    }),
  }

  return {
    auditValues,
    conflictSet,
    createServiceM8RequestFromEnv,
    db,
    deleteObject,
    generateShortCode,
    getJobQuoteMeta,
    getQuoteAttachmentPdf,
    insertReturningRows,
    insertValues,
    put,
    selectRows,
  }
})

vi.mock('@/lib/db', () => ({ db: mocks.db }))
vi.mock('@/lib/storage', () => ({
  getStorage: () => ({ put: mocks.put, delete: mocks.deleteObject }),
  getStorageDriver: () => 'memory',
}))
vi.mock('@/lib/servicem8/client', () => ({
  createServiceM8RequestFromEnv: () => mocks.createServiceM8RequestFromEnv(),
  getJobQuoteMeta: (jobUuid: string, request: unknown) => mocks.getJobQuoteMeta(jobUuid, request),
  getQuoteAttachmentPdf: (jobUuid: string, request: unknown) =>
    mocks.getQuoteAttachmentPdf(jobUuid, request),
  resolveJobUuid: vi.fn(),
}))
vi.mock('@/lib/short-code', () => ({
  generateShortCode: (length: number) => mocks.generateShortCode(length),
}))

import { createTrackedQuote } from '../create-tracked-quote'

describe('createTrackedQuote', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    process.env.VIEWER_BASE_URL = 'https://quotes.example'
    mocks.createServiceM8RequestFromEnv.mockReturnValue({ request: true })
    mocks.getJobQuoteMeta.mockResolvedValue({
      clientName: 'Acme Ltd',
      jobDescription: 'Replace shopfront',
      jobAddress: '12 Glass St',
      totalIncGst: 1234.5,
    })
    mocks.getQuoteAttachmentPdf.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]) })
    mocks.generateShortCode.mockReturnValue('NEWCODE1')
    mocks.insertReturningRows.mockReturnValue([{ id: 'quote-1', shortCode: 'EXISTING1' }])
    mocks.auditValues.mockResolvedValue(undefined)
  })

  it('returns the existing live Tracked Quote without re-downloading the Quote PDF by default', async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    mocks.selectRows.mockReturnValueOnce([{ id: 'quote-1', shortCode: 'EXISTING1', expiresAt }])

    const result = await createTrackedQuote({ jobUuid: 'job-1' })

    expect(result).toEqual({
      ok: false,
      reason: 'quote_exists',
      message: 'A live tracked quote already exists for this job.',
      link: 'https://quotes.example/q/EXISTING1',
      expiresAt,
    })
    expect(mocks.getJobQuoteMeta).not.toHaveBeenCalled()
    expect(mocks.getQuoteAttachmentPdf).not.toHaveBeenCalled()
    expect(mocks.put).not.toHaveBeenCalled()
    expect(mocks.db.insert).not.toHaveBeenCalled()
  })

  it('refreshes an existing live Tracked Quote while preserving its short code and expiry', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-22T00:00:00Z'))
    const expiresAt = new Date('2026-06-30T12:00:00Z')
    mocks.selectRows.mockReturnValueOnce([{ id: 'quote-1', shortCode: 'EXISTING1', expiresAt }])

    const result = await createTrackedQuote({ jobUuid: 'job-1', refresh: true })

    expect(mocks.getJobQuoteMeta).toHaveBeenCalledWith('job-1', { request: true })
    expect(mocks.getQuoteAttachmentPdf).toHaveBeenCalledWith('job-1', { request: true })
    expect(mocks.put).toHaveBeenCalledWith(
      'quotes/EXISTING1.pdf',
      Buffer.from(new Uint8Array([1, 2, 3])),
      'application/pdf',
    )
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        servicem8Uuid: 'job-1',
        shortCode: 'EXISTING1',
        clientName: 'Acme Ltd',
        jobAddress: '12 Glass St',
        quoteValue: '1234.50',
        pdfStorageKey: 'quotes/EXISTING1.pdf',
        expiresAt,
      }),
    )
    expect(mocks.conflictSet).toHaveBeenCalledWith({
      target: expect.anything(),
      set: expect.objectContaining({
        shortCode: 'EXISTING1',
        quoteValue: '1234.50',
        pdfStorageKey: 'quotes/EXISTING1.pdf',
        expiresAt,
      }),
    })
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        quoteId: 'quote-1',
        shortCode: 'EXISTING1',
        link: 'https://quotes.example/q/EXISTING1',
        expiresAt,
      }),
    )
  })
})
