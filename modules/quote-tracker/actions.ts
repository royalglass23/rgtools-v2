'use server'

import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { logAudit } from '@/lib/audit-db'

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

export type ExpireQuoteLinkActionResult = { ok: true } | { ok: false; message: string }

export async function expireQuoteLinkAction(quoteId: string): Promise<ExpireQuoteLinkActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, message: 'You must be signed in.' }
  }

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
