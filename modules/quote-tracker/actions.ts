'use server'

import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'

import { createTrackedQuote } from './create-tracked-quote'

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

  const result = await createTrackedQuote({ jobNumber: trimmed, ownerUserId: session.user.id })

  if (!result.ok) {
    if (result.reason === 'quote_exists') {
      return { ok: false, message: result.message, link: result.link, expiresAt: result.expiresAt }
    }
    return { ok: false, message: result.message }
  }

  revalidatePath('/quote-tracker')

  return {
    ok: true,
    link: result.link,
    clientName: result.clientName,
    jobAddress: result.jobAddress,
    expiresAt: result.expiresAt,
  }
}
