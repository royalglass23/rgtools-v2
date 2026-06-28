import { beforeEach, describe, expect, it, vi } from 'vitest'
import worker from '../index'

const mockSqlFn = vi.hoisted(() => vi.fn())
vi.mock('@neondatabase/serverless', () => ({ neon: () => mockSqlFn }))

const SECRET = 'test-gate-secret-key-32-bytes-xx'
const QUOTE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const OTHER_QUOTE_ID = 'ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee'
const CODE = 'abc123'

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    DATABASE_URL: 'postgresql://test',
    GATE_HMAC_SECRET: SECRET,
    QUOTES_BUCKET: {
      get: vi.fn().mockResolvedValue({ body: new ReadableStream() }),
    },
    ...overrides,
  } as unknown as Parameters<typeof worker.fetch>[1]
}

const gatedQuoteRow = {
  id: QUOTE_ID,
  token: 'cccccccc-dddd-1eee-8fff-000000000000',
  pdf_storage_key: 'quotes/test.pdf',
  expires_at: null,
  archived_at: null,
  email_gate_enabled: true,
  email_gate_has_recipients: true,
  client_name: 'Test Client',
  job_description: null,
}

const ungatedQuoteRow = {
  ...gatedQuoteRow,
  email_gate_enabled: false,
  email_gate_has_recipients: false,
}

async function signProof(quoteId: string, secret: string, offsetMs = 0): Promise<string> {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000 + offsetMs
  const payload = `${quoteId}:${expiresAt}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${payload}.${b64}`
}

function pdfRequest(code: string, cookieValue?: string) {
  const headers: HeadersInit = {}
  if (cookieValue) headers['Cookie'] = `rg_gate=${cookieValue}`
  return new Request(`http://localhost/q/${code}/pdf`, { headers })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MT-67: PDF gate server-side enforcement', () => {
  describe('gated quote without proof', () => {
    it('returns 403 with no Cookie header', async () => {
      mockSqlFn.mockResolvedValueOnce([gatedQuoteRow])
      const res = await worker.fetch(pdfRequest(CODE), makeEnv())
      expect(res.status).toBe(403)
    })

    it('returns 403 with a tampered proof', async () => {
      mockSqlFn.mockResolvedValueOnce([gatedQuoteRow])
      const res = await worker.fetch(pdfRequest(CODE, 'tampered-value'), makeEnv())
      expect(res.status).toBe(403)
    })

    it('returns 403 when GATE_HMAC_SECRET is not set', async () => {
      mockSqlFn.mockResolvedValueOnce([gatedQuoteRow])
      const res = await worker.fetch(pdfRequest(CODE), makeEnv({ GATE_HMAC_SECRET: '' }))
      expect(res.status).toBe(403)
    })
  })

  describe('gated quote with valid proof', () => {
    it('returns 200 and streams PDF bytes', async () => {
      mockSqlFn.mockResolvedValueOnce([gatedQuoteRow])
      const proof = await signProof(QUOTE_ID, SECRET)
      const res = await worker.fetch(pdfRequest(CODE, proof), makeEnv())
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/pdf')
    })
  })

  describe('cross-quote proof rejection', () => {
    it('rejects a valid proof minted for a different quote', async () => {
      mockSqlFn.mockResolvedValueOnce([{ ...gatedQuoteRow, id: OTHER_QUOTE_ID }])
      const proof = await signProof(QUOTE_ID, SECRET)
      const res = await worker.fetch(pdfRequest(CODE, proof), makeEnv())
      expect(res.status).toBe(403)
    })
  })

  describe('ungated quote', () => {
    it('serves PDF without any cookie', async () => {
      mockSqlFn.mockResolvedValueOnce([ungatedQuoteRow])
      const res = await worker.fetch(pdfRequest(CODE), makeEnv())
      expect(res.status).toBe(200)
    })
  })

  describe('gate endpoint sets proof cookie on success', () => {
    it('Set-Cookie header contains rg_gate proof scoped to the quote PDF path', async () => {
      const recipientRows = [
        { quote_id: QUOTE_ID, recipient_id: 'recip-uuid', email: 'allowed@example.com' },
      ]
      mockSqlFn
        .mockResolvedValueOnce(recipientRows)
        .mockResolvedValueOnce([])

      const res = await worker.fetch(
        new Request(`http://localhost/q/${CODE}/gate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'allowed@example.com',
            sessionId: 'aaaaaaaa-bbbb-1ccc-8ddd-111111111111',
            token: gatedQuoteRow.token,
          }),
        }),
        makeEnv(),
      )

      expect(res.status).toBe(200)
      const cookie = res.headers.get('Set-Cookie') ?? ''
      expect(cookie).toContain('rg_gate=')
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('SameSite=Strict')
      expect(cookie).toContain(`Path=/q/${CODE}/pdf`)
    })
  })
})
