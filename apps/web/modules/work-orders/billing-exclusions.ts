import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { settings } from '@rgtools/db/schema'

export const WORK_ORDER_BILLING_EXCLUSIONS_KEY = 'work_orders.billing_exclusions'
export const DEFAULT_WORK_ORDER_BILLING_EXCLUSIONS = ['invoice', 'partial invoice', 'deposit']

export async function getWorkOrderBillingExclusions(): Promise<string[]> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, WORK_ORDER_BILLING_EXCLUSIONS_KEY)).limit(1)

  return row ? normalizeWorkOrderBillingExclusions(row.value) : DEFAULT_WORK_ORDER_BILLING_EXCLUSIONS
}

export function normalizeWorkOrderBillingExclusions(raw: string): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return DEFAULT_WORK_ORDER_BILLING_EXCLUSIONS
  }

  if (!Array.isArray(parsed)) return DEFAULT_WORK_ORDER_BILLING_EXCLUSIONS

  return Array.from(
    new Set(
      parsed.flatMap((term) => {
        if (typeof term !== 'string') return []
        const normalized = term.trim().toLowerCase()
        return normalized ? [normalized] : []
      }),
    ),
  )
}

export function serializeWorkOrderBillingExclusions(terms: string[]): string {
  return JSON.stringify(terms)
}

export function parseWorkOrderBillingExclusionText(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((term) => term.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
}
