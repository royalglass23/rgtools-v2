// @vitest-environment node

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => vi.fn())
const userCanAccessSlugMock = vi.hoisted(() => vi.fn())
const lookupLotDescriptionMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/access-db', () => ({ userCanAccessSlug: userCanAccessSlugMock }))
vi.mock('@/modules/ps-generator/linz-lot-description', () => ({
  lookupLinzLotDescription: lookupLotDescriptionMock,
}))

import { POST } from '../route'

describe('POST /api/ps-generator/lot-description', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a LINZ lot description for authorized PS Generator users', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    userCanAccessSlugMock.mockResolvedValue(true)
    lookupLotDescriptionMock.mockResolvedValue({
      found: true,
      lotDescription: 'LOT 18 DP 192386 756M2, LOT 27 DP 192386 236M2',
      confidence: 'high',
      source: 'linz-property-title-parcels',
    })

    const response = await POST(request({ address: '18 Lucia Glade Meadowbank, Auckland 1072' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(lookupLotDescriptionMock).toHaveBeenCalledWith('18 Lucia Glade Meadowbank, Auckland 1072')
    expect(body).toEqual({
      ok: true,
      found: true,
      lotDescription: 'LOT 18 DP 192386 756M2, LOT 27 DP 192386 236M2',
      confidence: 'high',
      source: 'linz-property-title-parcels',
    })
  })

  it('does not query LINZ for unauthenticated requests', async () => {
    authMock.mockResolvedValue(null)

    const response = await POST(request({ address: '18 Lucia Glade' }))

    expect(response.status).toBe(401)
    expect(lookupLotDescriptionMock).not.toHaveBeenCalled()
  })

  it('requires an address', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    userCanAccessSlugMock.mockResolvedValue(true)

    const response = await POST(request({ address: ' ' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'Job address is required' })
  })
})

function request(body: unknown) {
  return new NextRequest('https://rgtools.local/api/ps-generator/lot-description', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}
