import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@rgtools/db/schema'
import { leadReviewerNotes } from '@rgtools/db/schema-leads'

export type ReviewerNote = {
  id: string
  authorName: string
  text: string
  createdAt: Date
}

export async function getLeadReviewerNotes(leadId: string): Promise<ReviewerNote[]> {
  return db
    .select(reviewerNoteSelect)
    .from(leadReviewerNotes)
    .innerJoin(users, eq(leadReviewerNotes.authorId, users.id))
    .where(eq(leadReviewerNotes.leadId, leadId))
    .orderBy(asc(leadReviewerNotes.createdAt))
}

export async function createLeadReviewerNote({
  leadId,
  authorId,
  text,
}: {
  leadId: string
  authorId: string
  text: string
}): Promise<ReviewerNote> {
  const [created] = await db
    .insert(leadReviewerNotes)
    .values({ leadId, authorId, text })
    .returning({ id: leadReviewerNotes.id })

  if (!created) throw new Error('Reviewer note could not be created.')

  const [note] = await db
    .select(reviewerNoteSelect)
    .from(leadReviewerNotes)
    .innerJoin(users, eq(leadReviewerNotes.authorId, users.id))
    .where(eq(leadReviewerNotes.id, created.id))
    .limit(1)

  if (!note) throw new Error('Reviewer note could not be loaded.')
  return note
}

const reviewerNoteSelect = {
  id: leadReviewerNotes.id,
  authorName: users.username,
  text: leadReviewerNotes.text,
  createdAt: leadReviewerNotes.createdAt,
}
