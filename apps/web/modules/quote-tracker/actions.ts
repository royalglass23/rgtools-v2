'use server'

import { inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'
import { logAudit } from '@/lib/audit-db'
import { db } from '@/lib/db'
import { requireModule } from '@/lib/guard'
import { quotes } from '@rgtools/db/schema'

import { generateConversationSnapshotForQuote } from './conversation-snapshot'
import { getLatestQuoteAiGuidance } from './ai-guidance'
import { generateAiSuggestionForQuote } from './ai-suggestion'
import { createTrackedQuote } from './create-tracked-quote'
import { expireQuoteLink } from './expire-quote-link'
import { getExpirySettings } from './settings-query'

export type TrackQuoteActionResult =
  | { ok: true; link: string; clientName: string; jobAddress: string | null; expiresAt: Date }
  | { ok: false; message: string; link?: string; expiresAt?: Date }

export async function createTrackedQuoteAction(jobNumber: string): Promise<TrackQuoteActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, message: 'You must be signed in to create a tracked quote.' }
  }
  await requireModule('quote-tracker')

  const trimmed = jobNumber.trim()
  if (!trimmed) {
    return { ok: false, message: 'Enter a ServiceM8 job ID.' }
  }

  const { defaultPreset } = await getExpirySettings()
  const result = await createTrackedQuote({
    jobNumber: trimmed,
    ownerUserId: session.user.id,
    expiry: defaultPreset,
  })

  if (!result.ok) {
    if (result.reason === 'quote_exists') {
      return { ok: false, message: result.message, link: result.link, expiresAt: result.expiresAt }
    }
    return { ok: false, message: result.message }
  }

  revalidatePath('/quote-tracker')
  revalidatePath(`/quote-tracker/${result.quoteId}`)

  return {
    ok: true,
    link: result.link,
    clientName: result.clientName,
    jobAddress: result.jobAddress,
    expiresAt: result.expiresAt,
  }
}

export async function batchDeleteQuotesAction(formData: FormData): Promise<void> {
  const session = await auth()
  if (session?.user?.role !== 'admin' || !session.user.id) {
    throw new Error('Forbidden')
  }
  await requireModule('quote-tracker')

  const quoteIds = formData
    .getAll('quoteId')
    .map((value) => String(value))
    .filter(Boolean)

  if (quoteIds.length === 0) return

  await db.transaction(async (tx) => {
    await tx
      .delete(quotes)
      .where(inArray(quotes.id, quoteIds))

    await Promise.all(quoteIds.map((quoteId) =>
      logAudit({
        actorId: session.user.id as string,
        entityType: 'quote',
        action: 'quote.deleted',
        targetId: quoteId,
        detail: { batch: true },
      }, tx),
    ))
  })

  revalidatePath('/')
  revalidatePath('/quote-tracker')
}

export type ExpireQuoteLinkActionResult = { ok: true } | { ok: false; message: string }

export async function expireQuoteLinkAction(quoteId: string): Promise<ExpireQuoteLinkActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, message: 'You must be signed in.' }
  }
  await requireModule('quote-tracker')

  const result = await expireQuoteLink(quoteId)
  if (!result.ok) {
    return { ok: false, message: result.message }
  }

  await logAudit({
    actorId: session.user.id,
    action: 'quote.link_expired',
    targetId: quoteId,
    detail: { clientName: result.clientName },
  })

  revalidatePath(`/quote-tracker/${quoteId}`)

  return { ok: true }
}

export async function createConversationSnapshotAction(formData: FormData): Promise<void> {
  const session = await auth()
  const quoteId = formData.get('quoteId')?.toString() ?? ''
  if (!session?.user?.id) {
    redirect(`/quote-tracker/${quoteId}?snapshotError=${encodeURIComponent('You must be signed in.')}`)
  }
  await requireModule('quote-tracker')

  const result = await generateConversationSnapshotForQuote({
    quoteId,
    triggeredByUserId: session.user.id,
  })

  if (!result.ok) {
    redirect(`/quote-tracker/${quoteId}?snapshotError=${encodeURIComponent(result.message)}`)
  }

  await logAudit({
    actorId: session.user.id,
    entityType: 'quote',
    action: 'quote.conversation_snapshot_created',
    targetId: quoteId,
    detail: { snapshotId: result.snapshotId, partial: result.partial },
  })

  revalidatePath(`/quote-tracker/${quoteId}`)
  redirect(`/quote-tracker/${quoteId}?snapshotSaved=${result.partial ? 'partial' : '1'}`)
}

export async function createAiSuggestionAction(formData: FormData): Promise<void> {
  const session = await auth()
  const quoteId = formData.get('quoteId')?.toString() ?? ''
  if (!session?.user?.id) {
    redirect(`/quote-tracker/${quoteId}?suggestionError=${encodeURIComponent('You must be signed in.')}`)
  }
  await requireModule('quote-tracker')

  const snapshotResult = await generateConversationSnapshotForQuote({
    quoteId,
    triggeredByUserId: session.user.id,
  })

  let snapshotNotice = ''
  if (!snapshotResult.ok) {
    const latestGuidance = await getLatestQuoteAiGuidance(quoteId)
    if (!latestGuidance.conversationSnapshot) {
      redirect(`/quote-tracker/${quoteId}?snapshotError=${encodeURIComponent(snapshotResult.message)}`)
    }
    snapshotNotice = `snapshotError=${encodeURIComponent(snapshotResult.message)}`
  } else {
    snapshotNotice = `snapshotSaved=${snapshotResult.partial ? 'partial' : '1'}`
  }

  if (snapshotResult.ok) {
    await logAudit({
      actorId: session.user.id,
      entityType: 'quote',
      action: 'quote.conversation_snapshot_created',
      targetId: quoteId,
      detail: { snapshotId: snapshotResult.snapshotId, partial: snapshotResult.partial },
    })
  }

  const result = await generateAiSuggestionForQuote({
    quoteId,
    triggeredByUserId: session.user.id,
  })

  if (!result.ok) {
    revalidatePath(`/quote-tracker/${quoteId}`)
    redirect(`/quote-tracker/${quoteId}?${snapshotNotice}&suggestionError=${encodeURIComponent(result.message)}`)
  }

  await logAudit({
    actorId: session.user.id,
    entityType: 'quote',
    action: 'quote.ai_suggestion_created',
    targetId: quoteId,
    detail: { suggestionId: result.suggestionId },
  })

  revalidatePath(`/quote-tracker/${quoteId}`)
  redirect(`/quote-tracker/${quoteId}?${snapshotNotice}&suggestionSaved=1`)
}
