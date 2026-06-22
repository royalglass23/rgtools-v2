// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import {
  getCompanyContact,
  getJobContact,
  getJobNotesAndEmails,
  resolveJobUuid,
  ServiceM8RateLimitError,
  stripEmailNoise,
  withServiceM8Retry,
  type ServiceM8FetchRequest,
} from '../client'

describe('withServiceM8Retry', () => {
  it('retries a throttled request and returns the eventual success', async () => {
    const request = vi.fn<ServiceM8FetchRequest>()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ uuid: 'job-uuid-1' }] })
    const sleeps: number[] = []

    const response = await withServiceM8Retry(request, {
      sleep: async (ms) => {
        sleeps.push(ms)
      },
      random: () => 0.5,
    })('/job.json')

    await expect(response.json()).resolves.toEqual([{ uuid: 'job-uuid-1' }])
    expect(request).toHaveBeenCalledTimes(2)
    expect(sleeps).toEqual([500])
  })

  it('throws a typed error after retryable responses are exhausted', async () => {
    const request = vi.fn<ServiceM8FetchRequest>(async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
    }))
    const sleeps: number[] = []

    await expect(withServiceM8Retry(request, {
      sleep: async (ms) => {
        sleeps.push(ms)
      },
      random: () => 1,
      maxAttempts: 3,
    })('/job.json')).rejects.toBeInstanceOf(ServiceM8RateLimitError)

    expect(request).toHaveBeenCalledTimes(3)
    expect(sleeps).toEqual([1000, 2000])
  })

  it('does not retry non-retryable client errors', async () => {
    const response = { ok: false, status: 404, json: async () => ({}) }
    const request = vi.fn<ServiceM8FetchRequest>(async () => response)
    const sleep = vi.fn(async () => undefined)

    await expect(withServiceM8Retry(request, { sleep })('/company/missing.json')).resolves.toBe(response)

    expect(request).toHaveBeenCalledOnce()
    expect(sleep).not.toHaveBeenCalled()
  })

  it('retries a network error and returns the eventual success', async () => {
    const request = vi.fn<ServiceM8FetchRequest>()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) })
    const sleep = vi.fn(async () => undefined)

    const response = await withServiceM8Retry(request, { sleep })('/job.json')

    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(request).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledOnce()
  })
})

describe('getJobContact', () => {
  it('returns the richest active contact for a ServiceM8 job', async () => {
    const request = vi.fn<ServiceM8FetchRequest>(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        { name: 'Inactive', phone: '111', active: 0 },
        { first: 'Roxy', last: 'Glass', phone: '09 123', mobile: '021 456', email: 'roxy@example.test', active: 1 },
      ],
    }))

    await expect(getJobContact('job-uuid-1', request)).resolves.toEqual({
      name: 'Roxy Glass',
      phone: '09 123',
      mobile: '021 456',
      email: 'roxy@example.test',
    })
    expect(request).toHaveBeenCalledOnce()
    expect(request.mock.calls[0]?.[0]).toContain('/jobcontact.json?%24filter=')
    expect(decodeURIComponent(request.mock.calls[0]?.[0] ?? '')).toContain("job_uuid eq 'job-uuid-1'")
  })

  it('merges usable email and phone details across active job contacts', async () => {
    const request = vi.fn<ServiceM8FetchRequest>(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        { first: 'Billing', email: '', phone: '021 311999', mobile: '021 311999', type: 'BILLING', active: 1 },
        { first: 'Paul', email: 'info@tailoredbuilding.co.nz', phone: 'https://example.test/', mobile: '', type: 'JOB', active: 1 },
      ],
    }))

    await expect(getJobContact('job-uuid-1', request)).resolves.toEqual({
      name: 'Paul',
      phone: '021 311999',
      mobile: '021 311999',
      email: 'info@tailoredbuilding.co.nz',
    })
  })
})

describe('getCompanyContact', () => {
  it('returns the richest active company contact', async () => {
    const request = vi.fn<ServiceM8FetchRequest>(async (path) => {
      expect(path).toContain('/companycontact.json?%24filter=')
      return {
        ok: true,
        status: 200,
        json: async () => [
          { name: 'No details', active: 1 },
          { name: 'Darin', mobile: '027 111 222', email: 'darin@example.test', active: 1 },
        ],
      }
    })

    await expect(getCompanyContact('company-uuid-1', request)).resolves.toEqual({
      name: 'Darin',
      phone: null,
      mobile: '027 111 222',
      email: 'darin@example.test',
    })
  })

  it('falls back to the company record when company contacts are empty', async () => {
    const request = vi.fn<ServiceM8FetchRequest>(async (path) => {
      if (path.startsWith('/companycontact.json')) {
        return { ok: true, status: 200, json: async () => [] }
      }
      expect(path).toBe('/company/company-uuid-1.json')
      return {
        ok: true,
        status: 200,
        json: async () => ({ name: 'Access', phone: '09 123', email: 'office@example.test' }),
      }
    })

    await expect(getCompanyContact('company-uuid-1', request)).resolves.toEqual({
      name: 'Access',
      phone: '09 123',
      mobile: null,
      email: 'office@example.test',
    })
  })
})

describe('getJobNotesAndEmails', () => {
  it('returns trimmed notes and emails for a ServiceM8 job', async () => {
    const longNote = 'n'.repeat(2000)
    const request = vi.fn<ServiceM8FetchRequest>(async (path) => {
      if (path.startsWith('/note.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { edit_date: '2026-06-10T09:00:00Z', note: 'older note' },
            { edit_date: '2026-06-15T09:00:00Z', note: longNote },
            { edit_date: '2026-06-14T09:00:00Z', note: 'note 2' },
            { edit_date: '2026-06-13T09:00:00Z', note: 'note 3' },
            { edit_date: '2026-06-12T09:00:00Z', note: 'note 4' },
            { edit_date: '2026-06-11T09:00:00Z', note: 'note 5' },
          ],
        }
      }

      if (path.startsWith('/email.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              edit_date: '2026-06-09T09:00:00Z',
              subject: 'Oldest email',
              message_text: 'drop me',
            },
            {
              edit_date: '2026-06-12T09:00:00Z',
              subject: 'Site measure',
              message_html: '<p>Hello <strong>Royal Glass</strong></p><p>Please measure.</p>',
            },
            {
              edit_date: '2026-06-11T09:00:00Z',
              subject: 'Quote timing',
              message_text: 'Can you quote this week?',
            },
            {
              edit_date: '2026-06-10T09:00:00Z',
              subject: 'Photos',
              message_text: 'Photos attached.',
            },
          ],
        }
      }

      return { ok: false, status: 404, json: async () => null }
    })

    await expect(getJobNotesAndEmails('job-uuid-1', request)).resolves.toEqual({
      notes: [
        { date: '2026-06-15T09:00:00Z', text: `${'n'.repeat(297)}...` },
        { date: '2026-06-14T09:00:00Z', text: 'note 2' },
        { date: '2026-06-13T09:00:00Z', text: 'note 3' },
        { date: '2026-06-12T09:00:00Z', text: 'note 4' },
        { date: '2026-06-11T09:00:00Z', text: 'note 5' },
      ],
      emails: [
        {
          date: '2026-06-12T09:00:00Z',
          subject: 'Site measure',
          body: 'Hello Royal Glass Please measure.',
        },
        {
          date: '2026-06-11T09:00:00Z',
          subject: 'Quote timing',
          body: 'Can you quote this week?',
        },
        {
          date: '2026-06-10T09:00:00Z',
          subject: 'Photos',
          body: 'Photos attached.',
        },
      ],
    })

    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[0]?.[0]).toContain('/note.json?%24filter=')
    expect(request.mock.calls[1]?.[0]).toContain('/email.json?%24filter=')
    expect(decodeURIComponent(request.mock.calls[0]?.[0] ?? '')).toContain("related_object_uuid eq 'job-uuid-1'")
    expect(decodeURIComponent(request.mock.calls[1]?.[0] ?? '')).toContain("related_object_uuid eq 'job-uuid-1'")
  })

  it('returns empty history when ServiceM8 reads fail or return non-arrays', async () => {
    const request = vi.fn<ServiceM8FetchRequest>(async (path) => {
      if (path.startsWith('/note.json')) {
        return { ok: false, status: 500, json: async () => [{ note: 'ignored' }] }
      }

      return { ok: true, status: 200, json: async () => ({ rows: [] }) }
    })

    await expect(getJobNotesAndEmails('job-uuid-1', request)).resolves.toEqual({
      notes: [],
      emails: [],
    })
  })

  it('propagates exhausted ServiceM8 retry errors instead of hiding them as empty history', async () => {
    const request = vi.fn<ServiceM8FetchRequest>(async () => {
      throw new ServiceM8RateLimitError(
        'ServiceM8 request failed after 5 attempts with HTTP 429',
        { path: '/note.json', status: 429, attempts: 5 },
      )
    })

    await expect(getJobNotesAndEmails('job-uuid-1', request)).rejects.toBeInstanceOf(ServiceM8RateLimitError)
  })
})

describe('stripEmailNoise', () => {
  it('strips HTML to readable text', () => {
    expect(stripEmailNoise('<p>Hello <strong>Jane</strong></p><p>Thanks &amp; bye.</p>'))
      .toBe('Hello Jane Thanks & bye.')
  })

  it('removes quoted reply chains and trailing signatures', () => {
    const body = [
      'Hi, please book the measure.',
      '',
      'Kind regards,',
      'Jane',
      '',
      'On Tue, Royal Glass wrote:',
      '> Previous message',
    ].join('\n')

    expect(stripEmailNoise(body)).toBe('Hi, please book the measure.')
  })
})

describe('resolveJobUuid', () => {
  it('returns null for a genuine empty ServiceM8 job search result', async () => {
    const request = vi.fn<ServiceM8FetchRequest>(async () => ({
      ok: true,
      status: 200,
      json: async () => [],
    }))

    await expect(resolveJobUuid({ jobNumber: 'R260227' }, request)).resolves.toBeNull()
  })

  it('propagates exhausted retry errors instead of reporting a missing job', async () => {
    const request = vi.fn<ServiceM8FetchRequest>(async () => {
      throw new ServiceM8RateLimitError(
        'ServiceM8 request failed after 5 attempts with HTTP 429',
        { path: '/job.json', status: 429, attempts: 5 },
      )
    })

    await expect(resolveJobUuid({ jobNumber: 'R260227' }, request)).rejects.toBeInstanceOf(ServiceM8RateLimitError)
  })
})
