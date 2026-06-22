// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import { ServiceM8RateLimitError, type ServiceM8FetchRequest } from '@/lib/servicem8/client'
import { deriveProjectType, enrichImportRow } from '../enrich-row'
import type { LeadImportRow } from '../types'

function row(overrides: Partial<LeadImportRow> = {}): LeadImportRow {
  return {
    rowId: 'row-2',
    rowNumber: 2,
    jobNumber: 'R260227',
    input: {
      clientName: 'Aroha Smith',
      phone: '',
      email: '',
      clientProfileKey: 'repeat_builder',
      projectType: 'Other',
      location: 'Albany',
      source: 'other',
      externalRef: 'R260227',
    },
    issues: [],
    enriched: false,
    servicem8JobUuid: null,
    servicem8JobNumber: null,
    servicem8Status: null,
    existing: false,
    autoSkip: false,
    needsContact: true,
    notEnriched: true,
    enrichmentMessage: null,
    ...overrides,
  }
}

function requestFor(status = 'Work Order', contact = { mobile: '021 456', email: 'a@example.test' }) {
  return vi.fn<ServiceM8FetchRequest>(async (path) => {
    if (path.startsWith('/job.json')) {
      return { ok: true, status: 200, json: async () => [{ uuid: 'job-uuid-1' }] }
    }
    if (path === '/job/job-uuid-1.json') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          uuid: 'job-uuid-1',
          status,
          generated_job_id: 'R260227',
          job_description: 'Install glass pool fence',
          job_address: '1 Queen Street, Auckland',
          company_uuid: 'company-uuid-1',
        }),
      }
    }
    if (path.startsWith('/jobmaterial.json')) {
      return { ok: true, status: 200, json: async () => [] }
    }
    if (path === '/company/company-uuid-1.json') {
      return { ok: true, status: 200, json: async () => ({ name: 'Aroha Smith Ltd' }) }
    }
    if (path.startsWith('/jobcontact.json')) {
      return { ok: true, status: 200, json: async () => [contact] }
    }
    throw new Error(`Unexpected path ${path}`)
  })
}

describe('enrichImportRow', () => {
  it('fills contact details, status, uuid, and project type from ServiceM8', async () => {
    const enriched = await enrichImportRow(row(), requestFor())

    expect(enriched).toMatchObject({
      enriched: true,
      notEnriched: false,
      servicem8JobUuid: 'job-uuid-1',
      servicem8JobNumber: 'R260227',
      servicem8Status: 'Work Order',
      needsContact: false,
    })
    expect(enriched.input).toMatchObject({
      phone: '021 456',
      email: 'a@example.test',
      projectType: 'Pool Fencing',
    })
  })

  it('marks completed jobs for auto-skip', async () => {
    const enriched = await enrichImportRow(row(), requestFor('Completed'))

    expect(enriched.autoSkip).toBe(true)
  })

  it('keeps the row and defaults project type when ServiceM8 returns no matching job', async () => {
    const request = vi.fn<ServiceM8FetchRequest>(async () => ({
      ok: true,
      status: 200,
      json: async () => [],
    }))

    const enriched = await enrichImportRow(row(), request)

    expect(enriched).toMatchObject({
      enriched: false,
      notEnriched: true,
      autoSkip: false,
      needsContact: true,
      servicem8JobNumber: 'R260227',
      enrichmentMessage: 'Job Number R260227 was not found in ServiceM8.',
    })
    expect(enriched.input.projectType).toBe('Other')
  })

  it('reports exhausted ServiceM8 throttling as retryable instead of not found', async () => {
    const request = vi.fn<ServiceM8FetchRequest>(async () => {
      throw new ServiceM8RateLimitError(
        'ServiceM8 request failed after 5 attempts with HTTP 429',
        { path: '/job.json', status: 429, attempts: 5 },
      )
    })

    const enriched = await enrichImportRow(row(), request)

    expect(enriched).toMatchObject({
      enriched: false,
      notEnriched: true,
      servicem8JobNumber: 'R260227',
      enrichmentMessage: "ServiceM8 was busy / rate-limited and couldn't enrich this row. Re-run Upload and review to retry.",
    })
    expect(enriched.enrichmentMessage).not.toContain('was not found')
  })

  it('flags needsContact when ServiceM8 has no phone or email', async () => {
    const request = vi.fn<ServiceM8FetchRequest>(async (path) => {
      if (path.startsWith('/job.json')) return { ok: true, status: 200, json: async () => [{ uuid: 'job-uuid-1' }] }
      if (path === '/job/job-uuid-1.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            uuid: 'job-uuid-1',
            status: 'Work Order',
            job_description: 'Install glass pool fence',
            company_uuid: 'company-uuid-1',
          }),
        }
      }
      if (path.startsWith('/jobmaterial.json')) return { ok: true, status: 200, json: async () => [] }
      if (path === '/company/company-uuid-1.json') return { ok: true, status: 200, json: async () => ({ name: 'Company' }) }
      if (path.startsWith('/jobcontact.json')) return { ok: true, status: 200, json: async () => [{ mobile: '', email: '' }] }
      if (path.startsWith('/companycontact.json')) return { ok: true, status: 200, json: async () => [] }
      throw new Error(`Unexpected path ${path}`)
    })

    const enriched = await enrichImportRow(row(), request)

    expect(enriched.needsContact).toBe(true)
    expect(enriched.enrichmentMessage).toBe('Job found, but ServiceM8 has no phone/email on the job contact or linked company.')
  })

  it('fills contact details from the linked company when the job contact is empty', async () => {
    const request = vi.fn<ServiceM8FetchRequest>(async (path) => {
      if (path.startsWith('/job.json')) return { ok: true, status: 200, json: async () => [{ uuid: 'job-uuid-1' }] }
      if (path === '/job/job-uuid-1.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            uuid: 'job-uuid-1',
            status: 'Quote',
            job_description: 'Install shower',
            company_uuid: 'company-uuid-1',
          }),
        }
      }
      if (path.startsWith('/jobmaterial.json')) return { ok: true, status: 200, json: async () => [] }
      if (path === '/company/company-uuid-1.json') return { ok: true, status: 200, json: async () => ({ name: 'Company' }) }
      if (path.startsWith('/jobcontact.json')) return { ok: true, status: 200, json: async () => [{ mobile: '', email: '' }] }
      if (path.startsWith('/companycontact.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ name: 'Company Contact', phone: '09 555 111', email: 'office@example.test' }],
        }
      }
      throw new Error(`Unexpected path ${path}`)
    })

    const enriched = await enrichImportRow(row(), request)

    expect(enriched.needsContact).toBe(false)
    expect(enriched.input).toMatchObject({
      phone: '09 555 111',
      email: 'office@example.test',
      projectType: 'Showers',
    })
  })

  it('infers known project types and defaults to Other', () => {
    expect(deriveProjectType('glass pool fence')).toBe('Pool Fencing')
    expect(deriveProjectType('frameless shower')).toBe('Showers')
    expect(deriveProjectType('kitchen splashback')).toBe('Splashbacks')
    expect(deriveProjectType('office partition')).toBe('Partitions')
    expect(deriveProjectType('bathroom mirror')).toBe('Mirrors')
    expect(deriveProjectType('stair balustrade')).toBe('Balustrades')
    expect(deriveProjectType('aluminium joinery')).toBe('Aluminium')
    expect(deriveProjectType('miscellaneous work')).toBe('Other')
  })
})
