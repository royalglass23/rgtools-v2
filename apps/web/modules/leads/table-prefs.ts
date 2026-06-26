import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { userTablePrefs } from '@rgtools/db/schema-leads'
import { normalizeTablePrefs, type TablePrefs } from './table-prefs-shared'

export async function loadTablePrefs(userId: string, tableKey: string): Promise<TablePrefs> {
  const [row] = await db
    .select({ prefs: userTablePrefs.prefs })
    .from(userTablePrefs)
    .where(and(eq(userTablePrefs.userId, userId), eq(userTablePrefs.tableKey, tableKey)))
    .limit(1)

  return normalizeTablePrefs(row?.prefs)
}
