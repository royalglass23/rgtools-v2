import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { quotes } from '@rgtools/db/schema'
import { isActiveLink } from './expiry'

type ExpireResult =
  | { ok: true; clientName: string }
  | { ok: false; reason: 'not_found' | 'already_inactive'; message: string }

export async function expireQuoteLink(quoteId: string): Promise<ExpireResult> {
  const quote = await db.query.quotes.findFirst({
    where: eq(quotes.id, quoteId),
    columns: { id: true, clientName: true, expiresAt: true, archivedAt: true },
  })

  if (!quote) {
    return { ok: false, reason: 'not_found', message: 'Quote not found.' }
  }

  if (!isActiveLink(quote.expiresAt, quote.archivedAt)) {
    return { ok: false, reason: 'already_inactive', message: 'This link is already inactive.' }
  }

  await db.update(quotes).set({ expiresAt: new Date() }).where(eq(quotes.id, quoteId))

  return { ok: true, clientName: quote.clientName }
}
