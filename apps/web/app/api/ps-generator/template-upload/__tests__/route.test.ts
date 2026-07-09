// @vitest-environment node

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => vi.fn())
const userCanAccessSlugMock = vi.hoisted(() => vi.fn())
const getStorageDriverMock = vi.hoisted(() => vi.fn())
const createR2PresignedPutUrlMock = vi.hoisted(() => vi.fn())
const selectMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/access-db', () => ({ userCanAccessSlug: userCanAccessSlugMock }))
vi.mock('@/lib/storage', () => ({ getStorageDriver: getStorageDriverMock }))
vi.mock('@/lib/storage/r2', () => ({ createR2PresignedPutUrl: createR2PresignedPutUrlMock }))
vi.mock('@/lib/db', () => ({ db: { select: selectMock } }))

import { POST } from '../route'

describe('POST /api/ps-generator/template-upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    userCanAccessSlugMock.mockResolvedValue(true)
    getStorageDriverMock.mockReturnValue('r2')
    createR2PresignedPutUrlMock.mockReturnValue({
      url: 'https://account.r2.cloudflarestorage.com/bucket/drafts/template.pdf?X-Amz-Signature=sig',
      headers: {
        'content-type': 'application/pdf',
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      },
    })
    selectMock.mockReturnValue(queryReturning([{ id: 'config-1', state: 'draft' }]))
  })

  it('returns a direct R2 upload URL for authorized configuration editors', async () => {
    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(userCanAccessSlugMock).toHaveBeenCalledWith('user-1', 'ps-generator/configuration')
    expect(createR2PresignedPutUrlMock).toHaveBeenCalledWith({
      key: 'drafts/ps-generator/templates/config-1/face-fixed/standard_ps1/Face-Fixed.pdf',
      contentType: 'application/pdf',
      expiresSeconds: 600,
    })
    expect(body).toEqual({
      objectKey: 'drafts/ps-generator/templates/config-1/face-fixed/standard_ps1/Face-Fixed.pdf',
      originalFilename: 'Face Fixed.pdf',
      uploadUrl: 'https://account.r2.cloudflarestorage.com/bucket/drafts/template.pdf?X-Amz-Signature=sig',
      headers: {
        'content-type': 'application/pdf',
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      },
    })
  })

  it('rejects large template metadata before issuing a signed URL', async () => {
    const response = await POST(request({ size: 26 * 1024 * 1024 }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: 'Template PDF must be 25 MB or smaller.' })
    expect(createR2PresignedPutUrlMock).not.toHaveBeenCalled()
  })

  it('does not issue upload URLs without configuration access', async () => {
    userCanAccessSlugMock.mockResolvedValue(false)

    const response = await POST(request())

    expect(response.status).toBe(403)
    expect(selectMock).not.toHaveBeenCalled()
  })
})

function request(overrides: Partial<{
  configVersionId: string
  systemPart: string
  variantKind: string
  filename: string
  contentType: string
  size: number
}> = {}) {
  return new NextRequest('https://rgtools.local/api/ps-generator/template-upload', {
    method: 'POST',
    body: JSON.stringify({
      configVersionId: 'config-1',
      systemPart: 'face fixed',
      variantKind: 'standard_ps1',
      filename: 'Face Fixed.pdf',
      contentType: 'application/pdf',
      size: 8 * 1024 * 1024,
      ...overrides,
    }),
    headers: { 'content-type': 'application/json' },
  })
}

function queryReturning(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: async () => rows,
      }),
    }),
  }
}
