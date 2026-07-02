// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => vi.fn())
const userCanAccessSlugMock = vi.hoisted(() => vi.fn())
const getStorageMock = vi.hoisted(() => vi.fn())
const selectMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/access-db', () => ({ userCanAccessSlug: userCanAccessSlugMock }))
vi.mock('@/lib/storage', () => ({ getStorage: getStorageMock }))
vi.mock('@/lib/db', () => ({ db: { select: selectMock } }))

import { GET } from '../route'

describe('GET /api/ps-generator/generated/[objectId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    userCanAccessSlugMock.mockResolvedValue(true)
    getStorageMock.mockReturnValue({ get: async () => Buffer.from('%PDF retained') })
  })

  it('returns retained PDF bytes for users with history access', async () => {
    selectMock.mockReturnValue(queryReturning([pdfObject()]))

    const response = await GET(new Request('https://rgtools.local/api/ps-generator/generated/pdf-1'), {
      params: Promise.resolve({ objectId: 'pdf-1' }),
    })

    expect(response.status).toBe(200)
    expect(userCanAccessSlugMock).toHaveBeenCalledWith('user-1', 'ps-generator/history')
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="PS1-Jane-Customer.pdf"')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from('%PDF retained'))
  })

  it('keeps expired objects visible as unavailable downloads', async () => {
    selectMock.mockReturnValue(queryReturning([
      pdfObject({ retainedUntil: new Date('2026-01-01T00:00:00.000Z') }),
    ]))

    const response = await GET(new Request('https://rgtools.local/api/ps-generator/generated/pdf-1'), {
      params: Promise.resolve({ objectId: 'pdf-1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(410)
    expect(body).toEqual({ error: 'Generated PDF is no longer retained' })
  })

  it('does not expose downloads without history access', async () => {
    userCanAccessSlugMock.mockResolvedValue(false)

    const response = await GET(new Request('https://rgtools.local/api/ps-generator/generated/pdf-1'), {
      params: Promise.resolve({ objectId: 'pdf-1' }),
    })

    expect(response.status).toBe(403)
    expect(selectMock).not.toHaveBeenCalled()
  })
})

function queryReturning(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: async () => rows,
      }),
    }),
  }
}

function pdfObject(overrides: Partial<{
  id: string
  documentKind: 'ps1' | 'ps3'
  filename: string
  r2ObjectKey: string
  retainedUntil: Date
  deletedAt: Date | null
}> = {}) {
  return {
    id: 'pdf-1',
    documentKind: 'ps1',
    filename: 'PS1-Jane-Customer.pdf',
    r2ObjectKey: 'ps-generator/generated/event-1/PS1-Jane-Customer.pdf',
    retainedUntil: new Date('2099-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  }
}
