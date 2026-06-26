import { eq } from 'drizzle-orm'
import { quotes } from '@rgtools/db/schema'
import { db } from '@/lib/db'
import { createServiceM8RequestFromEnv, getJobQuoteMeta } from '@/lib/servicem8/client'
import { resolveClient as resolveClientInDb } from '@/modules/clients/client-resolver'

export type QuoteClientLinkBackfillRow = {
  id: string
  servicem8Uuid: string
  clientId: string | null
  clientName: string
  servicem8CompanyUuid: string | null
}

export type QuoteClientLinkBackfillDeps = {
  loadQuotes: () => Promise<QuoteClientLinkBackfillRow[]>
  getJobQuoteMeta: (jobUuid: string) => Promise<{ companyUuid: string | null; clientName: string | null }>
  resolveClient: (input: {
    servicem8CompanyUuid: string
    clientName: string
    companyName: string | null
  }) => Promise<{ clientId: string }>
  updateQuote: (quoteId: string, values: {
    clientId: string
    servicem8CompanyUuid: string
    companyName: string | null
  }) => Promise<void>
  print: (message: string) => void
}

export type QuoteClientLinkBackfillResult = {
  scanned: number
  linked: number
  skipped: number
}

export async function runQuoteClientLinkBackfill(
  deps: QuoteClientLinkBackfillDeps = createQuoteClientLinkBackfillDeps(),
): Promise<QuoteClientLinkBackfillResult> {
  const rows = await deps.loadQuotes()
  let linked = 0
  let skipped = 0

  for (const quote of rows) {
    if (quote.clientId && quote.servicem8CompanyUuid) {
      skipped += 1
      continue
    }

    const meta = await deps.getJobQuoteMeta(quote.servicem8Uuid)
    if (!meta.companyUuid) {
      skipped += 1
      continue
    }

    const clientName = meta.clientName ?? quote.clientName
    const client = await deps.resolveClient({
      servicem8CompanyUuid: meta.companyUuid,
      clientName,
      companyName: meta.clientName,
    })

    await deps.updateQuote(quote.id, {
      clientId: client.clientId,
      servicem8CompanyUuid: meta.companyUuid,
      companyName: meta.clientName,
    })
    linked += 1
  }

  const result = { scanned: rows.length, linked, skipped }
  deps.print(`Quote client link backfill: scanned=${result.scanned} linked=${result.linked} skipped=${result.skipped}`)
  return result
}

export function createQuoteClientLinkBackfillDeps(): QuoteClientLinkBackfillDeps {
  const request = createServiceM8RequestFromEnv()

  return {
    loadQuotes: async () => db
      .select({
        id: quotes.id,
        servicem8Uuid: quotes.servicem8Uuid,
        clientId: quotes.clientId,
        clientName: quotes.clientName,
        servicem8CompanyUuid: quotes.servicem8CompanyUuid,
      })
      .from(quotes),
    getJobQuoteMeta: async (jobUuid) => getJobQuoteMeta(jobUuid, request),
    resolveClient: async (input) => db.transaction((tx) => resolveClientInDb(tx, input)),
    updateQuote: async (quoteId, values) => {
      await db
        .update(quotes)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(quotes.id, quoteId))
    },
    print: console.log,
  }
}
