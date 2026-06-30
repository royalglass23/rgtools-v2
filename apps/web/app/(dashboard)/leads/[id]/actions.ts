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
import { generateSuggestion, MissingOpenAIKeyError } from '@/modules/lead-intake/ai/suggest-next-step'
import { getJobNotesAndEmails } from '@/lib/servicem8/client'

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

const SUGGESTION_COOLDOWN_MS = 60_000

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

  if (lead.aiSuggestionAt) {
    const elapsed = Date.now() - new Date(lead.aiSuggestionAt).getTime()
    if (elapsed < SUGGESTION_COOLDOWN_MS) {
      return { error: 'Please wait before generating another suggestion.' }
    }
  }

  try {
    const history = lead.servicem8JobUuid
      ? await getLeadHistory(lead.servicem8JobUuid)
      : null
    const suggestion = await generateSuggestion({ ...lead, history })
    const generatedAt = new Date()

    await db
      .update(leads)
      .set({
        aiSuggestion: suggestion.text,
        aiSuggestionAt: generatedAt,
        updatedAt: generatedAt,
      })
      .where(eq(leads.id, leadId))

    await logAudit({
      actorId: session.user.id,
      entityType: 'lead',
      action: 'lead.ai_suggestion_generated',
      targetId: leadId,
      before: null,
      after: { aiSuggestionAt: generatedAt.toISOString() },
    })

    revalidatePath(`/leads/${leadId}`)
    return suggestion
  } catch (error) {
    if (error instanceof MissingOpenAIKeyError) {
      return { error: 'AI suggestions are not configured yet. Add OPENAI_API_KEY to enable this.' }
    }

    return { error: error instanceof Error ? error.message : 'Could not generate a suggestion. Try again later.' }
  }
}

async function getLeadHistory(jobUuid: string) {
  try {
    return await getJobNotesAndEmails(jobUuid)
  } catch {
    return null
  }
}
