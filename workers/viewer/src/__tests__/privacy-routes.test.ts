import { describe, expect, it } from 'vitest'
import worker from '../index'

const env = {} as Parameters<typeof worker.fetch>[1]

describe('GET /privacy', () => {
  it('returns 200', async () => {
    const res = await worker.fetch(new Request('http://localhost/privacy'), env)
    expect(res.status).toBe(200)
  })
})

describe('notice content', () => {
  async function body(path: string) {
    const res = await worker.fetch(new Request(`http://localhost${path}`), env)
    return res.text()
  }

  it('names all three processors', async () => {
    const html = await body('/privacy')
    expect(html).toContain('Cloudflare')
    expect(html).toContain('Neon')
    expect(html).toContain('Resend')
  })

  it('states 90-day IP retention', async () => {
    const html = await body('/privacy')
    expect(html).toContain('90 days')
  })

  it('states 12-month personal data deletion after quote expiry', async () => {
    const html = await body('/privacy')
    expect(html).toContain('12 months')
    expect(html).toContain('expires')
  })

  it('contains the contact email', async () => {
    const html = await body('/privacy')
    expect(html).toContain('support@royalglass.co.nz')
  })

  it('references the Privacy Commissioner', async () => {
    const html = await body('/privacy')
    expect(html).toContain('privacy.org.nz')
  })

  it('describes browser storage as localStorage / similar technologies', async () => {
    const html = await body('/privacy')
    expect(html).toContain('localStorage')
    expect(html).toContain('similar technologies')
  })

  it('discloses forwarding detection', async () => {
    const html = await body('/privacy')
    expect(html.toLowerCase()).toContain('forwarding')
  })

  it('cookies section has an anchor id for deep-linking', async () => {
    const html = await body('/privacy')
    expect(html).toContain('id="cookies"')
  })
})
