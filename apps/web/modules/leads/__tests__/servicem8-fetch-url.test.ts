// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createServiceM8RequestFromEnv } from '../servicem8-fetch'

describe('createServiceM8RequestFromEnv', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.SERVICEM8_API_KEY = 'test-api-key'
  })

  it('uses the ServiceM8 api_1.0 base path to avoid the legacy redirect loop', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    } as Response)

    const request = createServiceM8RequestFromEnv()
    await request('/job.json')

    const headers = fetchMock.mock.calls[0]?.[1]?.headers
    expect(headers).toBeInstanceOf(Headers)
    expect((headers as Headers).get('X-API-Key')).toBe('test-api-key')
    expect((headers as Headers).get('Authorization')).toBeNull()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.servicem8.com/api_1.0/job.json',
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    )
  })

  it('retries throttled env-backed requests without changing headers or base URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Too Many Requests' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ uuid: 'job-uuid-1' }],
      } as Response)
    const sleeps: number[] = []

    const request = createServiceM8RequestFromEnv({
      retry: {
        sleep: async (ms) => {
          sleeps.push(ms)
        },
        random: () => 0,
      },
    })
    const response = await request('/job.json')

    await expect(response.json()).resolves.toEqual([{ uuid: 'job-uuid-1' }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.servicem8.com/api_1.0/job.json')
    expect(sleeps).toEqual([0])
  })
})
