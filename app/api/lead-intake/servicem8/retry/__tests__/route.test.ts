import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const retryServiceM8LeadSyncBatchMock = vi.hoisted(() => vi.fn())

vi.mock('@/modules/lead-intake/servicem8/sync', () => ({
  retryServiceM8LeadSyncBatch: retryServiceM8LeadSyncBatchMock,
}))

import { POST } from '../route'

function request(secret: string | null, body: unknown = { limit: 3 }) {
  return new NextRequest('http://localhost/api/lead-intake/servicem8/retry', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SERVICEM8_SYNC_SECRET = 'retry-secret'
  retryServiceM8LeadSyncBatchMock.mockResolvedValue({
    total: 1,
    results: [{ ok: true, leadId: 'lead-1', reference: 'inbox:lead-1' }],
  })
})

describe('POST /api/lead-intake/servicem8/retry', () => {
  it('rejects requests without the sync secret', async () => {
    const response = await POST(request(null))

    expect(response.status).toBe(401)
    expect(retryServiceM8LeadSyncBatchMock).not.toHaveBeenCalled()
  })

  it('retries a bounded batch when authorized', async () => {
    const response = await POST(request('retry-secret', { limit: 5 }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.total).toBe(1)
    expect(retryServiceM8LeadSyncBatchMock).toHaveBeenCalledWith({ limit: 5 })
  })
})
