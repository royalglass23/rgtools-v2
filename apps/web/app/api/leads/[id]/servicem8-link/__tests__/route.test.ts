// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => vi.fn())
const linkLeadToServiceM8JobByNumberMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/modules/leads/servicem8-fetch', () => ({
  linkLeadToServiceM8JobByNumber: linkLeadToServiceM8JobByNumberMock,
}))

import { POST } from '../route'

describe('POST /api/leads/[id]/servicem8-link', () => {
  it('allows a stored ServiceM8 job number as the lead identifier', async () => {
    authMock.mockResolvedValue({ user: { id: 'actor-1' } })
    linkLeadToServiceM8JobByNumberMock.mockResolvedValue({
      ok: true,
      jobUuid: 'job-uuid-1',
      jobNumber: 'Q253011',
      jobStatus: 'Quote',
      message: 'Linked to job Q253011 (Quote)',
    })

    const response = await POST(
      new Request('http://localhost/api/leads/Q253011/servicem8-link', {
        method: 'POST',
        body: JSON.stringify({ jobNumber: 'Q253011' }),
      }),
      { params: Promise.resolve({ id: 'Q253011' }) },
    )

    expect(response.status).toBe(200)
    expect(linkLeadToServiceM8JobByNumberMock).toHaveBeenCalledWith('Q253011', 'Q253011', 'actor-1')
  })
})
