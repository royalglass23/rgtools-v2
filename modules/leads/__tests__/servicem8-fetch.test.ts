// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const linkedLeadRow = vi.hoisted(() => ({
  id: 'lead-1',
  tier: 'B',
  servicem8JobUuid: 'job-uuid-1',
  servicem8JobNumber: null,
  createdAt: new Date('2026-06-08T10:00:00Z'),
}))

const unlinkedLeadRow = vi.hoisted(() => ({
  id: 'lead-2',
  tier: 'A',
  servicem8JobUuid: null,
  servicem8JobNumber: null,
  createdAt: new Date('2026-06-08T10:00:00Z'),
}))

// Switch between lead rows per test
const activeLeadRow = vi.hoisted(() => ({ current: linkedLeadRow as typeof linkedLeadRow | typeof unlinkedLeadRow }))

const capturedSetValues = vi.hoisted(() => [] as unknown[])

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [activeLeadRow.current]),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => {
        capturedSetValues.push(values)
        return { where: vi.fn(async () => undefined) }
      }),
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
    capturedSetValues.length = 0
    activeLeadRow.current = linkedLeadRow
  })

  it('fetches directly by UUID when the lead is already linked', async () => {
    const request = vi.fn<ServiceM8FetchRequest>(async (path) => {
      if (path === '/job/job-uuid-1.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            uuid: 'job-uuid-1',
            status: 'Work Order',
            generated_job_id: 'R260210',
          }),
        }
      }
      throw new Error(`Unexpected request path: ${path}`)
    })

    await fetchLeadFromServiceM8('lead-1', 'actor-1', { request })

    expect(request.mock.calls[0][0]).toBe('/job/job-uuid-1.json')
  })

  it('filters the job search by the lead created date when not yet linked', async () => {
    activeLeadRow.current = unlinkedLeadRow

    const request = vi.fn<ServiceM8FetchRequest>(async (path) => {
      if (path.startsWith('/job.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              uuid: 'job-uuid-2',
              job_description: 'RGTools Lead lead-2',
              status: 'Work Order',
            },
          ],
        }
      }
      throw new Error(`Unexpected request path: ${path}`)
    })

    await fetchLeadFromServiceM8('lead-2', 'actor-1', { request })

    const jobSearchPath = request.mock.calls.map((c) => c[0]).find((p) => p.startsWith('/job.json'))
    expect(jobSearchPath).toBe(`/job.json?%24filter=${encodeURIComponent("date gt '2026-06-07'")}`)
  })

  it('stores the generated_job_id from the matched job', async () => {
    const request = vi.fn<ServiceM8FetchRequest>(async (path) => {
      if (path === '/job/job-uuid-1.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            uuid: 'job-uuid-1',
            status: 'Work Order',
            generated_job_id: 'R260210',
          }),
        }
      }
      throw new Error(`Unexpected request path: ${path}`)
    })

    await fetchLeadFromServiceM8('lead-1', 'actor-1', { request })

    expect(capturedSetValues[0]).toMatchObject({ servicem8JobNumber: 'R260210' })
  })
})
