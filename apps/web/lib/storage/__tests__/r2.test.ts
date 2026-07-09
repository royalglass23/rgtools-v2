// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest'

import { createR2PresignedPutUrl } from '../r2'

const ORIGINAL_ENV = { ...process.env }

describe('R2 presigned uploads', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('creates a bounded PUT URL for direct template uploads', () => {
    process.env.NODE_ENV = 'production'
    process.env.R2_ACCOUNT_ID = 'account-1'
    process.env.R2_ACCESS_KEY_ID = 'access-key'
    process.env.R2_SECRET_ACCESS_KEY = 'secret-key'
    process.env.R2_BUCKET = 'rgtools-templates'

    const signed = createR2PresignedPutUrl({
      key: 'drafts/ps-generator/templates/config-1/face-fixed/standard_ps1/Face-Fixed.pdf',
      contentType: 'application/pdf',
      now: new Date('2026-07-09T00:00:00.000Z'),
      expiresSeconds: 600,
    })

    const url = new URL(signed.url)
    expect(url.origin).toBe('https://account-1.r2.cloudflarestorage.com')
    expect(url.pathname).toBe('/rgtools-templates/drafts/ps-generator/templates/config-1/face-fixed/standard_ps1/Face-Fixed.pdf')
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256')
    expect(url.searchParams.get('X-Amz-Credential')).toBe('access-key/20260709/auto/s3/aws4_request')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('600')
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-type;host;x-amz-content-sha256')
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[a-f0-9]{64}$/)
    expect(signed.headers).toEqual({
      'content-type': 'application/pdf',
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    })
  })
})
