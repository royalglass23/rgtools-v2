import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, '../index.ts'), 'utf8')

describe('privacy surfaces', () => {
  it('footer link handlers no longer call alert', () => {
    const cookiesIdx = source.indexOf("'cookiesLink'")
    const cookiesRegion = source.slice(cookiesIdx, cookiesIdx + 300)
    expect(cookiesRegion).not.toContain('alert(')

    const privacyIdx = source.indexOf("'privacyLink'")
    const privacyRegion = source.slice(privacyIdx, privacyIdx + 300)
    expect(privacyRegion).not.toContain('alert(')
  })

  it('footer link is renamed to Cookies & Tracking', () => {
    expect(source).toContain('Cookies &amp; Tracking')
    expect(source).not.toContain('Cookies &amp; Preferences')
  })

  it('contains the in-page privacy modal element', () => {
    expect(source).toContain('privacyModal')
  })

  it('footer links open the modal rather than navigating away', () => {
    expect(source).toContain("removeAttribute('hidden')")
  })

  it('gate HTML contains a notice link to /privacy', () => {
    expect(source).toContain('href="/privacy"')
  })

  it('cookies footer link uses /privacy#cookies fragment', () => {
    expect(source).toContain('/privacy#cookies')
  })
})
