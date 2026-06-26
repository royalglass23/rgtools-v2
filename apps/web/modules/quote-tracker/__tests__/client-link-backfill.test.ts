import { describe, expect, it, vi } from 'vitest'
import { runQuoteClientLinkBackfill, type QuoteClientLinkBackfillDeps, type QuoteClientLinkBackfillRow } from '../client-link-backfill'

function quote(overrides: Partial<QuoteClientLinkBackfillRow> & Pick<QuoteClientLinkBackfillRow, 'id' | 'servicem8Uuid'>): QuoteClientLinkBackfillRow {
  return {
    id: overrides.id,
    servicem8Uuid: overrides.servicem8Uuid,
    clientId: overrides.clientId ?? null,
    clientName: overrides.clientName ?? 'Acme Ltd',
    servicem8CompanyUuid: overrides.servicem8CompanyUuid ?? null,
  }
}

describe('runQuoteClientLinkBackfill', () => {
  it('links existing quotes to ServiceM8 company clients', async () => {
    const deps: QuoteClientLinkBackfillDeps = {
      loadQuotes: async () => [quote({ id: 'quote-1', servicem8Uuid: 'job-1' })],
      getJobQuoteMeta: vi.fn(async () => ({ companyUuid: 'company-1', clientName: 'Acme Ltd' })),
      resolveClient: vi.fn(async () => ({ clientId: 'client-1' })),
      updateQuote: vi.fn(),
      print: vi.fn(),
    }

    const result = await runQuoteClientLinkBackfill(deps)

    expect(result).toEqual({ scanned: 1, linked: 1, skipped: 0 })
    expect(deps.resolveClient).toHaveBeenCalledWith({
      servicem8CompanyUuid: 'company-1',
      clientName: 'Acme Ltd',
      companyName: 'Acme Ltd',
    })
    expect(deps.updateQuote).toHaveBeenCalledWith('quote-1', {
      clientId: 'client-1',
      servicem8CompanyUuid: 'company-1',
      companyName: 'Acme Ltd',
    })
  })

  it('is a no-op for quotes that already have both client id and company UUID', async () => {
    const deps: QuoteClientLinkBackfillDeps = {
      loadQuotes: async () => [quote({
        id: 'quote-1',
        servicem8Uuid: 'job-1',
        clientId: 'client-1',
        servicem8CompanyUuid: 'company-1',
      })],
      getJobQuoteMeta: vi.fn(),
      resolveClient: vi.fn(),
      updateQuote: vi.fn(),
      print: vi.fn(),
    }

    const first = await runQuoteClientLinkBackfill(deps)
    const second = await runQuoteClientLinkBackfill(deps)

    expect(first).toEqual({ scanned: 1, linked: 0, skipped: 1 })
    expect(second).toEqual({ scanned: 1, linked: 0, skipped: 1 })
    expect(deps.getJobQuoteMeta).not.toHaveBeenCalled()
    expect(deps.updateQuote).not.toHaveBeenCalled()
  })
})
