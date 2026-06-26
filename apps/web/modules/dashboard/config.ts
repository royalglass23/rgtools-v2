import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { settings } from '@rgtools/db/schema'
import {
  DASHBOARD_TABLES_SETTING_KEY,
  DEFAULT_DASHBOARD_CONFIG,
  sanitizeDashboardConfig,
  type DashboardTableConfig,
} from './tables'

/**
 * Reads the admin-selected dashboard tables.
 *
 * - No settings row at all  → fall back to the default selection (Leads).
 * - Row present (even empty) → respect it, so an admin can intentionally show nothing.
 * - Unparseable JSON         → fall back to the default selection.
 */
export async function getDashboardTables(): Promise<DashboardTableConfig[]> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, DASHBOARD_TABLES_SETTING_KEY))
    .limit(1)

  if (!row) return DEFAULT_DASHBOARD_CONFIG

  try {
    const parsed = JSON.parse(row.value) as unknown
    const tables = Array.isArray(parsed)
      ? parsed
      : (parsed as { tables?: unknown })?.tables
    return sanitizeDashboardConfig(tables)
  } catch {
    return DEFAULT_DASHBOARD_CONFIG
  }
}
