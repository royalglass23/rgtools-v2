'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { userCanAccessSlug } from '@/lib/access-db'
import { logAudit } from '@/lib/audit-db'
import { logError } from '@/lib/logger'
import { refreshServiceM8Clients, type ServiceM8ClientImportSummary } from './servicem8-import'

export type ServiceM8ClientsImportActionState =
  | null
  | { success: true; summary: ServiceM8ClientImportSummary }
  | { error: string }

export async function refreshServiceM8ClientsAction(
  previousState: ServiceM8ClientsImportActionState,
  formData: FormData,
): Promise<ServiceM8ClientsImportActionState> {
  void previousState
  void formData

  const session = await auth()
  if (session?.user?.role !== 'admin' || !session.user.id) {
    return { error: 'Forbidden' }
  }

  const canAccessClients = await userCanAccessSlug(session.user.id, 'clients')
  if (!canAccessClients) {
    return { error: 'Forbidden' }
  }

  try {
    const summary = await refreshServiceM8Clients()
    await logAudit({
      actorId: session.user.id,
      action: 'client.servicem8_import.completed',
      detail: { summary },
    })
    if (summary.errors > 0) {
      await logError('clients.servicem8Import.rowErrors', new Error('ServiceM8 Clients import completed with row errors'), {
        level: 'warn',
        userId: session.user.id,
        metadata: {
          summary: { ...summary, errorMessages: summary.errorMessages.slice(0, 10) },
        },
      })
    }
    revalidatePath('/clients')
    return { success: true, summary }
  } catch (error) {
    const errorId = await logError('clients.servicem8Import.failed', error, {
      userId: session.user.id,
    })
    const message = error instanceof Error ? error.message : 'ServiceM8 Clients import failed.'
    return { error: `${message} Ref: ${errorId}` }
  }
}
