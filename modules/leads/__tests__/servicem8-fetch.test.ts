// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const leadRow = vi.hoisted(() => ({
  id: 'lead-1',
  tier: 'B',
  servicem8JobUuid: 'job-uuid-1',
  createdAt: new Date('2026-06-08T10:00:00Z'),
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [leadRow]),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async () => undefined),
    })),
  },
}))

import { fetchLeadFromServiceM8, type ServiceM8FetchRequest } from '../servicem8-fetch'

describe('fetchLeadFromServiceM8', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters the job search by the lead created date', async () => {
    const request = vi.fn<ServiceM8FetchRequest>(async (path) => {
      if (path.startsWith('/job.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              uuid: 'job-uuid-1',
              job_description: 'RGTools Lead lead-1',
              status: 'Work Order',
            },
          ],
        }
      }

      throw new Error(`Unexpected request path: ${path}`)
    })

    await fetchLeadFromServiceM8('lead-1', 'actor-1', { request })

    const jobSearchPath = request.mock.calls.map((c) => c[0]).find((p) => p.startsWith('/job.json'))
    expect(jobSearchPath).toBe(`/job.json?%24filter=${encodeURIComponent("date gt '2026-06-07'")}`)
  })
})
