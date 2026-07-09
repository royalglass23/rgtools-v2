'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit-db'
import { leads } from '@rgtools/db/schema-leads'
import { getLeadDetail } from '@/modules/leads/queries'
import { isLeadReadOnlyForLeadIntake } from '@/modules/leads/lead-lifecycle'
import { generateLeadAiGuidance } from '@/modules/leads/ai-guidance'

export async function deleteLeadAction(leadId: string) {
  const session = await auth()
  if (session?.user?.role !== 'admin' || !session.user.id) {
    throw new Error('Forbidden')
  }

  await db
    .update(leads)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(leads.id, leadId))

  await logAudit({
    actorId: session.user.id,
    entityType: 'lead',
    action: 'lead.deleted',
    targetId: leadId,
    before: { softDelete: false },
    after: { softDelete: true },
  })

  redirect('/leads')
}

export async function generateLeadSuggestionAction(leadId: string): Promise<{ text: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Sign in to generate a suggestion.' }
  }

  const lead = await getLeadDetail(leadId)
  if (!lead) return { error: 'Lead not found.' }
  if (isLeadReadOnlyForLeadIntake(lead)) {
    return { error: 'This lead is read-only because ServiceM8 status is no longer Quote.' }
  }

  const result = await generateLeadAiGuidance({
    leadId,
    triggeredByUserId: session.user.id,
  })
  if (!result.ok) {
    return { error: result.message }
  }

  await logAudit({
    actorId: session.user.id,
    entityType: 'lead',
    action: 'lead.ai_guidance_generated',
    targetId: leadId,
    before: null,
    after: {
      conversationSnapshotId: result.snapshotId,
      aiSuggestionId: result.suggestionId,
    },
  })

  revalidatePath(`/leads/${leadId}`)
  return { text: result.text }
}
