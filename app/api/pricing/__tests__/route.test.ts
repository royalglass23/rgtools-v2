import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSelect = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  db: {
    select: mockSelect,
  },
}))

import { DEFAULT_PRICING_CONFIG } from '@/modules/admin/pricing/config-admin'
import { GET } from '../route'

beforeEach(() => {
  vi.clearAllMocks()
})

function queueActivePricingRow(rows: unknown[]) {
  mockSelect.mockReturnValue({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve(rows)),
      })),
    })),
  })
}

describe('GET /api/pricing', () => {
  it('returns the active pricing config with public cache headers', async () => {
    queueActivePricingRow([{ config: DEFAULT_PRICING_CONFIG }])

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=300')
    expect(json).toEqual(DEFAULT_PRICING_CONFIG)
  })

  it('returns a no-body 503 when no active pricing config exists', async () => {
    queueActivePricingRow([])

    const response = await GET()

    expect(response.status).toBe(503)
    expect(await response.text()).toBe('')
  })

  it('returns a no-body 503 when pricing storage is unavailable', async () => {
    mockSelect.mockImplementation(() => {
      throw new Error('relation "pricing_config_versions" does not exist')
    })

    const response = await GET()

    expect(response.status).toBe(503)
    expect(await response.text()).toBe('')
  })
})
