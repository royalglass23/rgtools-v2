'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { userTablePrefs } from '@/drizzle/schema-leads'
import {
  LEADS_TABLE_KEY,
  normalizeTablePrefs,
  type TablePrefs,
} from './table-prefs-shared'

export async function saveTablePrefs(tableKey: string, prefs: TablePrefs) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Forbidden')

  const normalized = normalizeTablePrefs(prefs)

  await db
    .insert(userTablePrefs)
    .values({
      userId: session.user.id,
      tableKey,
      prefs: normalized,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userTablePrefs.userId, userTablePrefs.tableKey],
      set: {
        prefs: normalized,
        updatedAt: new Date(),
      },
    })

  if (tableKey === LEADS_TABLE_KEY) revalidatePath('/leads')
}
