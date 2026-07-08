// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const linkedLeadRow = vi.hoisted(() => ({
  id: 'lead-1',
  tier: 'B',
  seedScore: 70,
  scoreReason: 'Tier B (70): good fit',
  strikeFlag: null,
  completeness: 86,
  clientProfileKey: 'builder_developer_pool_builder_landscaper',
  projectType: 'pool_fence',
  complexity: 'new_build_commercial_fit_out',
  freeText: null,
  servicem8JobUuid: 'job-uuid-1',
  servicem8JobNumber: null,
  createdAt: new Date('2026-06-08T10:00:00Z'),
  updatedAt: new Date('2026-07-06T00:00:00Z'),
}))

const unlinkedLeadRow = vi.hoisted(() => ({
  id: 'lead-2',
  tier: 'A',
  seedScore: 82,
  scoreReason: 'Tier A (82): strong fit',
  strikeFlag: null,
  completeness: 100,
  clientProfileKey: 'builder_developer_pool_builder_landscaper',
  projectType: 'pool_fence',
  complexity: 'standard_non_custom',
  freeText: null,
  servicem8JobUuid: null,
  servicem8JobNumber: null,
  createdAt: new Date('2026-06-08T10:00:00Z'),
  updatedAt: new Date('2026-07-06T00:00:00Z'),
}))

const unscoredLeadRow = vi.hoisted(() => ({
  id: 'lead-3',
  tier: null,
  seedScore: null,
  scoreReason: null,
  strikeFlag: null,
  completeness: null,
  clientProfileKey: null,
  projectType: null,
  complexity: null,
  freeText: null,
  servicem8JobUuid: null,
  servicem8JobNumber: null,
  createdAt: new Date('2026-06-08T10:00:00Z'),
  updatedAt: new Date('2026-07-06T00:00:00Z'),
}))

// Switch between lead rows per test
const activeLeadRow = vi.hoisted(() => ({ current: linkedLeadRow as typeof linkedLeadRow | typeof unlinkedLeadRow | typeof unscoredLeadRow }))

const capturedSetValues = vi.hoisted(() => [] as unknown[])
const capturedInsertValues = vi.hoisted(() => [] as unknown[])
const resolveJobUuidMock = vi.hoisted(() => vi.fn())
const getJobQuoteMetaMock = vi.hoisted(() => vi.fn())
const getJobContactMock = vi.hoisted(() => vi.fn())
const getCompanyContactMock = vi.hoisted(() => vi.fn())
const writeRequestMock = vi.hoisted(() => vi.fn())
const createServiceM8WriteRequestFromEnvMock = vi.hoisted(() => vi.fn(() => writeRequestMock))
const setJobLeadCardFieldsMock = vi.hoisted(() => vi.fn())
const resolveClientMock = vi.hoisted(() => vi.fn())
const selectLimit = vi.hoisted(() => vi.fn())
const insertReturning = vi.hoisted(() => vi.fn(async () => [{ id: 'new-lead-1' }]))
const txInsertValues = vi.hoisted(() => vi.fn((values: unknown) => {
  capturedInsertValues.push(values)
  return { returning: insertReturning }
}))
const mockTransaction = vi.hoisted(() =>
  vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
    insert: vi.fn(() => ({ values: txInsertValues })),
  })),
)

vi.mock('@/lib/servicem8/client', () => ({
  createServiceM8RequestFromEnv: vi.fn(),
  createServiceM8WriteRequestFromEnv: createServiceM8WriteRequestFromEnvMock,
  resolveJobUuid: resolveJobUuidMock,
  getJobQuoteMeta: getJobQuoteMetaMock,
  getJobContact: getJobContactMock,
  getCompanyContact: getCompanyContactMock,
  setJobLeadCardFields: setJobLeadCardFieldsMock,
}))

vi.mock('@/modules/clients/client-resolver', () => ({
  resolveClient: resolveClientMock,
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
    transaction: mockTransaction,
  },
}))

import {
  fetchLeadFromServiceM8,
  importLeadFromServiceM8JobNumber,
  linkLeadToServiceM8JobByNumber,
  type ServiceM8FetchRequest,
} from '../servicem8-fetch'

describe('fetchLeadFromServiceM8', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedSetValues.length = 0
    capturedInsertValues.length = 0
    resolveJobUuidMock.mockReset()
    getJobQuoteMetaMock.mockReset()
    getJobContactMock.mockReset()
    getCompanyContactMock.mockReset()
    createServiceM8WriteRequestFromEnvMock.mockClear()
    writeRequestMock.mockReset()
    setJobLeadCardFieldsMock.mockReset()
    setJobLeadCardFieldsMock.mockResolvedValue({ updated: ['jobDescription', 'clientType', 'leadsQuality', 'note'], skipped: [] })
    resolveClientMock.mockReset()
    insertReturning.mockClear()
    txInsertValues.mockClear()
    mockTransaction.mockClear()
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

  it('does not push Leads Quality when a fetched unlinked lead has no real tier yet', async () => {
    activeLeadRow.current = unscoredLeadRow
    const request = vi.fn<ServiceM8FetchRequest>(async (path, init) => {
      if (path.startsWith('/job.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              uuid: 'job-uuid-3',
              job_description: 'RGTools Lead lead-3',
              status: 'Quote',
              generated_job_id: 'Q260003',
            },
          ],
        }
      }
      throw new Error(`Unexpected request path: ${path} ${JSON.stringify(init)}`)
    })

    const result = await fetchLeadFromServiceM8('lead-3', 'actor-1', { request })

    expect(result).toMatchObject({
      ok: true,
      leadsQuality: 'Not set',
      customFieldUpdated: false,
    })
    expect(setJobLeadCardFieldsMock).not.toHaveBeenCalled()
  })

  it('does not block the RG Tools link when ServiceM8 rejects a job card write', async () => {
    activeLeadRow.current = unlinkedLeadRow
    setJobLeadCardFieldsMock.mockRejectedValue(new Error('ServiceM8 lead job card write failed with HTTP 403'))
    const request = vi.fn<ServiceM8FetchRequest>(async (path) => {
      if (path.startsWith('/job.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              uuid: 'job-uuid-2',
              job_description: 'RGTools Lead lead-2',
              status: 'Quote',
              generated_job_id: 'Q260002',
            },
          ],
        }
      }
      throw new Error(`Unexpected request path: ${path}`)
    })

    const result = await fetchLeadFromServiceM8('lead-2', 'actor-1', { request })

    expect(result).toMatchObject({
      ok: true,
      jobUuid: 'job-uuid-2',
      customFieldUpdated: false,
      customFieldError: 'ServiceM8 lead job card write failed with HTTP 403',
    })
    expect(capturedSetValues[0]).toMatchObject({
      servicem8JobUuid: 'job-uuid-2',
      servicem8Status: 'Quote',
      syncStatus: 'synced',
    })
  })
})

describe('linkLeadToServiceM8JobByNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedSetValues.length = 0
    capturedInsertValues.length = 0
    resolveJobUuidMock.mockReset()
    getJobQuoteMetaMock.mockReset()
    getJobContactMock.mockReset()
    getCompanyContactMock.mockReset()
    resolveClientMock.mockReset()
    insertReturning.mockClear()
    txInsertValues.mockClear()
    mockTransaction.mockClear()
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
        jobUuid: { to: 'job-uuid-2' },
        jobNumber: { to: 'R260210' },
        jobStatus: { to: 'Quote' },
      },
    })
  })

  it('accepts a target job only when its status normalizes to Quote', async () => {
    resolveJobUuidMock.mockResolvedValue('job-uuid-2')
    const request = vi.fn<ServiceM8FetchRequest>(async (path) => {
      if (path === '/job/job-uuid-2.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            uuid: 'job-uuid-2',
            status: ' quote ',
            generated_job_id: 'R260210',
          }),
        }
      }
      throw new Error(`Unexpected request path: ${path}`)
    })

    const result = await linkLeadToServiceM8JobByNumber('lead-2', 'R260210', 'actor-1', { request })

    expect(result).toMatchObject({
      ok: true,
      jobUuid: 'job-uuid-2',
      jobStatus: ' quote ',
    })
  })

  it('rejects non-Quote target jobs without partially updating the lead', async () => {
    resolveJobUuidMock.mockResolvedValue('job-uuid-2')
    const request = vi.fn<ServiceM8FetchRequest>(async (path) => {
      if (path === '/job/job-uuid-2.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            uuid: 'job-uuid-2',
            status: 'Work Order',
            generated_job_id: 'R260210',
          }),
        }
      }
      throw new Error(`Unexpected request path: ${path}`)
    })

    const result = await linkLeadToServiceM8JobByNumber('lead-2', 'R260210', 'actor-1', { request })

    expect(result).toEqual({
      ok: false,
      reason: 'error',
      message: 'ServiceM8 job R260210 is Work Order, not Quote. Choose a Quote job to link this lead.',
    })
    expect(capturedSetValues).toHaveLength(0)
    expect(capturedInsertValues).toHaveLength(0)
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

describe('importLeadFromServiceM8JobNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedSetValues.length = 0
    capturedInsertValues.length = 0
    resolveJobUuidMock.mockReset()
    getJobQuoteMetaMock.mockReset()
    getJobContactMock.mockReset()
    getCompanyContactMock.mockReset()
    resolveClientMock.mockReset()
    insertReturning.mockClear()
    txInsertValues.mockClear()
    mockTransaction.mockClear()
    selectLimit.mockReset()
    selectLimit.mockResolvedValue([])
    resolveClientMock.mockResolvedValue({ clientId: 'client-1', contactId: 'contact-1' })
  })

  it('creates an unscored linked lead immediately for a valid Quote job', async () => {
    resolveJobUuidMock.mockResolvedValue('job-uuid-4')
    getJobQuoteMetaMock.mockResolvedValue({
      jobUuid: 'job-uuid-4',
      status: 'Quote',
      jobNumber: 'Q260004',
      jobDescription: 'Frameless shower install',
      jobAddress: '10 Glass Lane',
      companyUuid: 'company-1',
      clientName: 'Top View',
    })
    getJobContactMock.mockResolvedValue({ name: 'Vivi', phone: '021 111 222', mobile: null, email: 'vivi@example.test' })

    const result = await importLeadFromServiceM8JobNumber(' q260004 ', 'actor-1', { request: vi.fn() })

    expect(result).toMatchObject({
      ok: true,
      leadId: 'new-lead-1',
      jobUuid: 'job-uuid-4',
      jobNumber: 'Q260004',
      jobStatus: 'Quote',
      reusedExisting: false,
      missingContact: false,
    })
    expect(resolveJobUuidMock).toHaveBeenCalledWith({ jobNumber: 'Q260004' }, expect.any(Function))
    expect(resolveClientMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      servicem8CompanyUuid: 'company-1',
      clientName: 'Top View',
      companyName: 'Top View',
      phone: '021 111 222',
      email: 'vivi@example.test',
    }))
    expect(capturedInsertValues[0]).toMatchObject({
      clientId: 'client-1',
      contactId: 'contact-1',
      channel: 'other',
      externalRef: 'Q260004',
      syncStatus: 'synced',
      servicem8JobUuid: 'job-uuid-4',
      servicem8JobNumber: 'Q260004',
      servicem8Status: 'Quote',
      product: 'shower',
      location: '10 Glass Lane',
      freeText: null,
      createdBy: 'actor-1',
    })
    expect(capturedInsertValues[0]).not.toHaveProperty('tier')
    expect(capturedInsertValues[0]).not.toHaveProperty('seedScore')
    expect(capturedInsertValues[0]).not.toHaveProperty('completeness')
  })

  it('rejects non-Quote jobs without creating a lead', async () => {
    resolveJobUuidMock.mockResolvedValue('job-uuid-5')
    getJobQuoteMetaMock.mockResolvedValue({
      jobUuid: 'job-uuid-5',
      status: 'Work Order',
      jobNumber: 'Q260005',
      jobDescription: null,
      jobAddress: null,
      companyUuid: null,
      clientName: null,
    })

    const result = await importLeadFromServiceM8JobNumber('Q260005', 'actor-1', { request: vi.fn() })

    expect(result).toEqual({
      ok: false,
      reason: 'not_quote',
      message: 'ServiceM8 job Q260005 is Work Order, not Quote. Import a Quote job only.',
    })
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(capturedInsertValues).toHaveLength(0)
  })

  it('routes to the existing linked lead instead of creating a duplicate', async () => {
    selectLimit.mockResolvedValue([{ id: 'existing-lead-1' }])
    resolveJobUuidMock.mockResolvedValue('job-uuid-6')
    getJobQuoteMetaMock.mockResolvedValue({
      jobUuid: 'job-uuid-6',
      status: 'Quote',
      jobNumber: 'Q260006',
      jobDescription: null,
      jobAddress: null,
      companyUuid: null,
      clientName: null,
    })

    const result = await importLeadFromServiceM8JobNumber('Q260006', 'actor-1', { request: vi.fn() })

    expect(result).toMatchObject({
      ok: true,
      leadId: 'existing-lead-1',
      reusedExisting: true,
    })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('creates the lead and flags missing contact details when ServiceM8 has no phone or email', async () => {
    resolveJobUuidMock.mockResolvedValue('job-uuid-7')
    getJobQuoteMetaMock.mockResolvedValue({
      jobUuid: 'job-uuid-7',
      status: 'Quote',
      jobNumber: 'Q260007',
      jobDescription: 'Mirror measure',
      jobAddress: '22 Clear Road',
      companyUuid: 'company-7',
      clientName: 'Clear Homes',
    })
    getJobContactMock.mockResolvedValue(null)
    getCompanyContactMock.mockResolvedValue(null)

    const result = await importLeadFromServiceM8JobNumber('Q260007', 'actor-1', { request: vi.fn() })

    expect(result).toMatchObject({
      ok: true,
      missingContact: true,
      message: 'Imported job Q260007. Contact details are missing and need manual follow-up.',
    })
    expect(capturedInsertValues[0]).toMatchObject({
      servicem8JobUuid: 'job-uuid-7',
      freeText: '[Import flag] Missing phone/email in ServiceM8 at import time.',
    })
  })
})
