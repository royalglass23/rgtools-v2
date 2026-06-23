import { describe, expect, it, vi } from 'vitest'
import { purgePersonalData } from '../retention'

type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>

function makeSql(): { fn: SqlFn; calls: string[] } {
  const calls: string[] = []
  const fn = vi.fn((strings: TemplateStringsArray) => {
    calls.push(strings[0])
    return Promise.resolve([])
  }) as unknown as SqlFn
  return { fn, calls }
}

describe('purgePersonalData', () => {
  it('runs without throwing', async () => {
    const { fn } = makeSql()
    await purgePersonalData(fn)
  })

  it('deletes quote_events for expired/archived quotes', async () => {
    const { fn, calls } = makeSql()
    await purgePersonalData(fn)
    const deletesEvents = calls.some(s => /DELETE/i.test(s) && s.includes('quote_events'))
    expect(deletesEvents).toBe(true)
  })

  it('deletes quote_viewer_emails for expired/archived quotes', async () => {
    const { fn, calls } = makeSql()
    await purgePersonalData(fn)
    const deletesEmails = calls.some(s => /DELETE/i.test(s) && s.includes('quote_viewer_emails'))
    expect(deletesEmails).toBe(true)
  })

  it('does not touch quote_engagement aggregate stats', async () => {
    const { fn, calls } = makeSql()
    await purgePersonalData(fn)
    const touchesAggregates = calls.some(s => s.includes('quote_engagement'))
    expect(touchesAggregates).toBe(false)
  })
})
