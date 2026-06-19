import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, '../index.ts'), 'utf8')

describe('viewer per-page timing script', () => {
  it('sends a timed page_view when the dominant page changes', () => {
    expect(source).toContain('sendPageTiming(flushPageTimer());')
    expect(source).toContain('syncPageTimer(bestPage);')
  })

  it('periodically flushes page timing while the viewer remains open', () => {
    expect(source).toContain('setInterval(function () {')
    expect(source).toContain('sendPageTiming(flushPageTimer(true));')
  })
})
