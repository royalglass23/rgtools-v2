'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { userCanAccessSlug } from '@/lib/access-db'
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
    revalidatePath('/clients')
    return { success: true, summary }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'ServiceM8 Clients import failed.' }
  }
}
