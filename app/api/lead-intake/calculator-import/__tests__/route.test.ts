import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const importCalculatorLeadsMock = vi.hoisted(() => vi.fn())

vi.mock('@/modules/lead-intake/calculator/import-calculator-leads', () => ({
  importCalculatorLeads: importCalculatorLeadsMock,
}))

import { POST } from '../route'

function request(secret: string | null, body: unknown = { limit: 10 }) {
  return new NextRequest('http://localhost/api/lead-intake/calculator-import', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CALCULATOR_IMPORT_SECRET = 'import-secret'
  importCalculatorLeadsMock.mockResolvedValue({
    sinceId: 6, fetched: 2, imported: 2, failed: 0, results: [],
  })
})

describe('POST /api/lead-intake/calculator-import', () => {
  it('rejects requests without the import secret', async () => {
    const response = await POST(request(null))

    expect(response.status).toBe(401)
    expect(importCalculatorLeadsMock).not.toHaveBeenCalled()
  })

  it('imports a bounded batch when authorized', async () => {
    const response = await POST(request('import-secret', { limit: 10 }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.imported).toBe(2)
    expect(importCalculatorLeadsMock).toHaveBeenCalledWith({ limit: 10 })
  })

  it('returns 500 with the error message when the import throws', async () => {
    importCalculatorLeadsMock.mockRejectedValue(new Error('WP export fetch failed with HTTP 403'))

    const response = await POST(request('import-secret'))
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toContain('HTTP 403')
  })
})
