import { eq } from 'drizzle-orm'

import { quotes, quoteNotifiedViewers } from '@rgtools/db/schema'
import { db as defaultDb } from '@/lib/db'

type Db = Pick<typeof defaultDb, 'update' | 'delete'>

/**
 * Resets the per-quote notification state when a quote is re-tracked.
 *
 * Sets openedNotifiedAt, highIntentNotifiedAt, and archivedAt to null on the
 * quote row, and hard-deletes all rows in quote_notified_viewers for that quote.
 *
 * Engagement data in quote_engagement is intentionally untouched.
 */
export async function resetNotificationState(quoteId: string, db: Db = defaultDb): Promise<void> {
  await db
    .update(quotes)
    .set({
      openedNotifiedAt: null,
      highIntentNotifiedAt: null,
      archivedAt: null,
    })
    .where(eq(quotes.id, quoteId))

  await db.delete(quoteNotifiedViewers).where(eq(quoteNotifiedViewers.quoteId, quoteId))
}
