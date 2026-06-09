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
})
