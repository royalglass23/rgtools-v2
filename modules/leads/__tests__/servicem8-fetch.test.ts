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
const capturedInsertValues = vi.hoisted(() => [] as unknown[])
const resolveJobUuidMock = vi.hoisted(() => vi.fn())
const selectLimit = vi.hoisted(() => vi.fn())

vi.mock('@/lib/servicem8/client', () => ({
  createServiceM8RequestFromEnv: vi.fn(),
  resolveJobUuid: resolveJobUuidMock,
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: selectLimit,
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
      values: vi.fn(async (values: unknown) => {
        capturedInsertValues.push(values)
        return undefined
      }),
    })),
  },
}))

import { fetchLeadFromServiceM8, linkLeadToServiceM8JobByNumber, type ServiceM8FetchRequest } from '../servicem8-fetch'

describe('fetchLeadFromServiceM8', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedSetValues.length = 0
    capturedInsertValues.length = 0
    resolveJobUuidMock.mockReset()
    selectLimit.mockReset()
    activeLeadRow.current = linkedLeadRow
    selectLimit.mockImplementation(async () => [activeLeadRow.current])
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

describe('linkLeadToServiceM8JobByNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedSetValues.length = 0
    capturedInsertValues.length = 0
    resolveJobUuidMock.mockReset()
    selectLimit.mockReset()
    activeLeadRow.current = unlinkedLeadRow
    selectLimit.mockImplementation(async () => [activeLeadRow.current])
  })

  it('links a lead to the ServiceM8 job resolved from its human job number', async () => {
    resolveJobUuidMock.mockResolvedValue('job-uuid-2')
    const request = vi.fn<ServiceM8FetchRequest>(async (path) => {
      if (path === '/job/job-uuid-2.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            uuid: 'job-uuid-2',
            status: 'Quote',
            generated_job_id: 'R260210',
          }),
        }
      }
      throw new Error(`Unexpected request path: ${path}`)
    })

    const result = await linkLeadToServiceM8JobByNumber('lead-2', ' r260210 ', 'actor-1', { request })

    expect(result).toEqual({
      ok: true,
      jobUuid: 'job-uuid-2',
      jobNumber: 'R260210',
      jobStatus: 'Quote',
      message: 'Linked to job R260210 (Quote)',
    })
    expect(resolveJobUuidMock).toHaveBeenCalledWith({ jobNumber: 'R260210' }, request)
    expect(capturedSetValues[0]).toMatchObject({
      servicem8JobUuid: 'job-uuid-2',
      servicem8JobNumber: 'R260210',
      servicem8Status: 'Quote',
      syncStatus: 'synced',
      syncError: null,
    })
    expect(capturedInsertValues[0]).toMatchObject({
      actorId: 'actor-1',
      action: 'lead.servicem8_manual_link',
      targetId: 'lead-2',
      detail: {
        jobUuid: 'job-uuid-2',
        jobNumber: 'R260210',
        jobStatus: 'Quote',
      },
    })
  })

  it('returns not_found and persists nothing when the job number does not resolve', async () => {
    resolveJobUuidMock.mockResolvedValue(null)
    const request = vi.fn<ServiceM8FetchRequest>()

    const result = await linkLeadToServiceM8JobByNumber('lead-2', 'R999999', 'actor-1', { request })

    expect(result).toEqual({
      ok: false,
      reason: 'not_found',
      message: 'No ServiceM8 job found with number R999999',
    })
    expect(capturedSetValues).toHaveLength(0)
    expect(capturedInsertValues).toHaveLength(0)
  })

  it('can resolve an imported pending lead by its stored ServiceM8 job number', async () => {
    selectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([unlinkedLeadRow])
    resolveJobUuidMock.mockResolvedValue('job-uuid-2')
    const request = vi.fn<ServiceM8FetchRequest>(async (path) => {
      if (path === '/job/job-uuid-2.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            uuid: 'job-uuid-2',
            status: 'Quote',
            generated_job_id: 'Q253011',
          }),
        }
      }
      throw new Error(`Unexpected request path: ${path}`)
    })

    const result = await linkLeadToServiceM8JobByNumber('Q253011', 'Q253011', 'actor-1', { request })

    expect(result).toMatchObject({
      ok: true,
      jobUuid: 'job-uuid-2',
      jobNumber: 'Q253011',
      jobStatus: 'Quote',
    })
    expect(capturedSetValues[0]).toMatchObject({
      servicem8JobUuid: 'job-uuid-2',
      servicem8JobNumber: 'Q253011',
      syncStatus: 'synced',
    })
  })
})
