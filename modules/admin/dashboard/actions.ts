'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLog, settings } from '@/drizzle/schema'
import {
  DASHBOARD_TABLES_SETTING_KEY,
  sanitizeDashboardConfig,
} from '@/modules/dashboard/tables'

export type SaveDashboardTablesResult = { success: true } | { error: string }

export async function saveDashboardTables(formData: FormData): Promise<SaveDashboardTablesResult> {
  const session = await auth()
  if (session?.user?.role !== 'admin' || !session.user.id) {
    return { error: 'Forbidden' }
  }

  const raw = formData.get('config')
  if (typeof raw !== 'string') {
    return { error: 'Missing dashboard tables payload.' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: 'Dashboard tables payload is not valid JSON.' }
  }

  const tables = sanitizeDashboardConfig(parsed)
  const value = JSON.stringify({ tables })

  await db.transaction(async (tx) => {
    await tx
      .insert(settings)
      .values({
        key: DASHBOARD_TABLES_SETTING_KEY,
        value,
        updatedBy: session.user.id as string,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedBy: session.user.id as string, updatedAt: new Date() },
      })

    await tx.insert(auditLog).values({
      actorId: session.user.id as string,
      action: 'dashboard_tables.updated',
      detail: { tables },
    })
  })

  revalidatePath('/')
  revalidatePath('/admin/dashboard-settings')
  return { success: true }
}
