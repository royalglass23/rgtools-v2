import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { quoteAiGenerationFailures, quoteAiSuggestions, quoteConversationSnapshots } from '@rgtools/db/schema'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type LatestQuoteAiGuidance = {
  conversationSnapshot: typeof quoteConversationSnapshots.$inferSelect | null
  aiSuggestion: typeof quoteAiSuggestions.$inferSelect | null
  generationFailure: typeof quoteAiGenerationFailures.$inferSelect | null
}

export async function getLatestQuoteAiGuidance(quoteId: string): Promise<LatestQuoteAiGuidance> {
  if (!UUID_RE.test(quoteId)) {
    return {
      conversationSnapshot: null,
      aiSuggestion: null,
      generationFailure: null,
    }
  }

  const [snapshotRows, suggestionRows, failureRows] = await Promise.all([
    db
      .select()
      .from(quoteConversationSnapshots)
      .where(eq(quoteConversationSnapshots.quoteId, quoteId))
      .orderBy(desc(quoteConversationSnapshots.createdAt))
      .limit(1),
    db
      .select()
      .from(quoteAiSuggestions)
      .where(eq(quoteAiSuggestions.quoteId, quoteId))
      .orderBy(desc(quoteAiSuggestions.createdAt))
      .limit(1),
    db
      .select()
      .from(quoteAiGenerationFailures)
      .where(eq(quoteAiGenerationFailures.quoteId, quoteId))
      .orderBy(desc(quoteAiGenerationFailures.createdAt))
      .limit(1),
  ])

  const conversationSnapshot = snapshotRows[0] ?? null
  const aiSuggestion = suggestionRows[0] ?? null
  const generationFailure = isStaleFailure(failureRows[0] ?? null, conversationSnapshot, aiSuggestion)
    ? null
    : failureRows[0] ?? null

  return {
    conversationSnapshot,
    aiSuggestion,
    generationFailure,
  }
}

function isStaleFailure(
  failure: typeof quoteAiGenerationFailures.$inferSelect | null,
  snapshot: typeof quoteConversationSnapshots.$inferSelect | null,
  suggestion: typeof quoteAiSuggestions.$inferSelect | null,
): boolean {
  if (!failure) return false
  const newestSuccess = [snapshot?.createdAt, suggestion?.createdAt]
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0]
  if (!newestSuccess) return false
  return failure.createdAt <= newestSuccess
}
