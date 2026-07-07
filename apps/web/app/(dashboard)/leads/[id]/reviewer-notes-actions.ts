'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { userCanAccessSlug } from '@/lib/access-db'
import { logAudit } from '@/lib/audit-db'
import { getLeadDetail } from '@/modules/leads/queries'
import {
  createLeadReviewerNote,
  getLeadReviewerNotes,
  type ReviewerNote,
} from '@/modules/leads/reviewer-notes'

export type ReviewerNoteActionResult =
  | { success: true; note: SerializedReviewerNote }
  | { error: string }

export type ReviewerNotesListResult =
  | { success: true; notes: SerializedReviewerNote[] }
  | { error: string }

export type SerializedReviewerNote = {
  id: string
  authorName: string
  text: string
  createdAt: string
}

export async function getReviewerNotesAction(leadId: string): Promise<ReviewerNotesListResult> {
  const access = await requireLeadsAccess()
  if ('error' in access) return access

  const notes = await getLeadReviewerNotes(leadId)
  return { success: true, notes: notes.map(serializeReviewerNote) }
}

export async function addReviewerNoteAction(
  leadId: string,
  text: string,
): Promise<ReviewerNoteActionResult> {
  const access = await requireLeadsAccess()
  if ('error' in access) return access

  const trimmed = text.trim()
  if (!trimmed) return { error: 'Reviewer note is required.' }

  const lead = await getLeadDetail(leadId)
  if (!lead) return { error: 'Lead not found.' }

  const note = await createLeadReviewerNote({
    leadId,
    authorId: access.userId,
    text: trimmed,
  })

  await logAudit({
    actorId: access.userId,
    entityType: 'lead',
    action: 'lead.reviewer_note_added',
    targetId: leadId,
    before: null,
    after: { noteId: note.id },
  })

  revalidatePath(`/leads/${leadId}`)
  return { success: true, note: serializeReviewerNote(note) }
}

async function requireLeadsAccess(): Promise<{ userId: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Forbidden' }

  const allowed = await userCanAccessSlug(session.user.id, 'leads')
  if (!allowed) return { error: 'Forbidden' }

  return { userId: session.user.id }
}

function serializeReviewerNote(note: ReviewerNote): SerializedReviewerNote {
  return {
    id: note.id,
    authorName: note.authorName,
    text: note.text,
    createdAt: new Date(note.createdAt).toISOString(),
  }
}
