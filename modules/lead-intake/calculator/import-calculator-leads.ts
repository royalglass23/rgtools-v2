import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { leads } from '@/drizzle/schema-leads'
import type { LeadIntakeInput, LeadIntakeResult } from '../actions'
import { mapWpLeadToIntakeInput, type WpCalculatorLead } from './map-wp-lead'

export type CalculatorImportSummary = {
  sinceId: number
  fetched: number
  imported: number
  failed: number
  results: Array<{ wpLeadId: number; ok: boolean; leadId?: string; error?: string }>
}

type ImportDeps = {
  fetchFn?: typeof fetch
  submitFn?: (input: LeadIntakeInput, actorId: string | null) => Promise<LeadIntakeResult>
  getSinceId?: () => Promise<number>
}

export async function importCalculatorLeads(
  { limit = 25 }: { limit?: number } = {},
  deps: ImportDeps = {},
): Promise<CalculatorImportSummary> {
  const fetchFn = deps.fetchFn ?? fetch
  const submitFn = deps.submitFn ?? (await import('../actions')).submitLeadIntakeForUser
  const getSinceId = deps.getSinceId ?? getMaxImportedCalculatorLeadId

  const exportUrl = process.env.CALCULATOR_WP_EXPORT_URL?.trim()
  const exportKey = process.env.CALCULATOR_WP_EXPORT_KEY?.trim()
  if (!exportUrl) throw new Error('CALCULATOR_WP_EXPORT_URL is not configured')
  if (!exportKey) throw new Error('CALCULATOR_WP_EXPORT_KEY is not configured')

  const sinceId = await getSinceId()
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100)
  const response = await fetchFn(`${exportUrl}?since_id=${sinceId}&limit=${boundedLimit}`, {
    headers: { 'X-RG-Export-Key': exportKey },
  })
  if (!response.ok) throw new Error(`WP export fetch failed with HTTP ${response.status}`)

  const payload = (await response.json()) as { leads?: unknown }
  const wpLeads = Array.isArray(payload.leads) ? (payload.leads as WpCalculatorLead[]) : []

  const results: CalculatorImportSummary['results'] = []
  for (const wpLead of wpLeads) {
    try {
      const result = await submitFn(mapWpLeadToIntakeInput(wpLead), null)
      if ('error' in result) {
        results.push({ wpLeadId: wpLead.id, ok: false, error: result.error })
      } else {
        results.push({ wpLeadId: wpLead.id, ok: true, leadId: result.leadId })
      }
    } catch (error) {
      results.push({
        wpLeadId: wpLead.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    sinceId,
    fetched: wpLeads.length,
    imported: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  }
}

export async function getMaxImportedCalculatorLeadId(): Promise<number> {
  // Calculator refs are 'calculator:<wp_id>' - parse the numeric part for the polling cursor.
  const [row] = await db
    .select({
      maxId: sql<number | null>`max(cast(split_part(${leads.externalRef}, ':', 2) as integer))`,
    })
    .from(leads)
    .where(and(eq(leads.source, 'calculator'), isNotNull(leads.externalRef)))

  return row?.maxId ?? 0
}
