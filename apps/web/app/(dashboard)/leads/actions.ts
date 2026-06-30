'use server'

import { auth } from '@/lib/auth'
import { importLeadFromServiceM8JobNumber } from '@/modules/leads/servicem8-fetch'

export type ImportServiceM8LeadActionResult =
  | { ok: true; redirectPath: string; message: string; missingContact: boolean; reusedExisting: boolean }
  | { ok: false; message: string }

const importCooldowns = new Map<string, { at: number; jobNumber: string }>()
const IMPORT_COOLDOWN_MS = 10_000

export async function importServiceM8LeadAction(jobNumber: string): Promise<ImportServiceM8LeadActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, message: 'Sign in to import from ServiceM8.' }
  }

  const normalizedJobNumber = jobNumber.trim().toUpperCase()
  const lastImport = importCooldowns.get(session.user.id)
  const isSameJobRetry = lastImport?.jobNumber === normalizedJobNumber
  if (lastImport && Date.now() - lastImport.at < IMPORT_COOLDOWN_MS && !isSameJobRetry) {
    return { ok: false, message: 'Please wait a moment before importing again.' }
  }
  importCooldowns.set(session.user.id, { at: Date.now(), jobNumber: normalizedJobNumber })

  const result = await importLeadFromServiceM8JobNumber(normalizedJobNumber, session.user.id)
  if (!result.ok) return { ok: false, message: result.message }

  return {
    ok: true,
    redirectPath: `/leads/${result.leadId}`,
    message: result.message,
    missingContact: result.missingContact,
    reusedExisting: result.reusedExisting,
  }
}
