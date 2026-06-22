'use server'

import { eq, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { leads } from '@/drizzle/schema-leads'
import { getActiveScoringOptionLists } from '@/modules/lead-intake/scoring/config-options'
import { normalizeInput, validateMinimum, validateScoredOptions } from '@/modules/lead-intake/intake-utils'
import { submitLeadIntakeForUser } from '@/modules/lead-intake/actions'
import { enrichImportRows } from './enrich-row'
import { mapTemplateRow } from './map-template-row'
import { parseLeadImportWorkbook } from './parse-workbook'
import type { CommitLeadImportResult, LeadImportRow, LeadImportSummary, PreviewLeadImportResult } from './types'

type PreviewArgs = {
  bytes: ArrayBuffer
  fileName: string
}

export async function previewLeadImport(args: PreviewArgs): Promise<PreviewLeadImportResult> {
  const session = await requireAdmin()
  if ('error' in session) return session

  try {
    const [rawRows, optionLists] = await Promise.all([
      parseLeadImportWorkbook(args.bytes, args.fileName),
      getActiveScoringOptionLists(),
    ])
    const mappedRows = rawRows.map((row) => mapTemplateRow(row, optionLists))
    const enrichedRows = await enrichImportRows(mappedRows)
    const dedupedRows = await attachDedupeStatus(enrichedRows)
    return { success: true, rows: dedupedRows }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Import preview failed.' }
  }
}

export async function commitLeadImport(rows: LeadImportRow[]): Promise<CommitLeadImportResult> {
  const session = await requireAdmin()
  if ('error' in session) return session

  const optionLists = await getActiveScoringOptionLists()
  const rowsWithDedupe = await attachDedupeStatus(rows)
  const summary: LeadImportSummary = {
    inserted: 0,
    skippedExisting: 0,
    skippedCompleted: 0,
    notEnriched: 0,
    needsContact: 0,
    failed: [],
  }

  for (const row of rowsWithDedupe) {
    const jobNumber = row.jobNumber || row.input.externalRef || `row ${row.rowNumber}`

    if (row.existing) {
      summary.skippedExisting += 1
      continue
    }
    if (row.autoSkip) {
      summary.skippedCompleted += 1
      continue
    }
    const missingContact = row.needsContact || (!row.input.phone?.trim() && !row.input.email?.trim())
    const normalized = normalizeInput({
      ...row.input,
      freeText: missingContact ? withMissingContactFlag(row.input.freeText) : row.input.freeText,
      externalRef: row.jobNumber || row.input.externalRef,
      source: row.input.source || 'other',
    })
    const minimumError = missingContact ? validateImportMinimum(normalized) : validateMinimum(normalized)
    const optionError = validateScoredOptions(normalized, optionLists.categories)
    const importError = validateImportRequiredFields(row)
    if (minimumError || optionError || importError) {
      const reason = minimumError ?? optionError ?? importError ?? 'Row failed validation.'
      summary.failed.push({ jobNumber, reason })
      continue
    }

    const result = await submitLeadIntakeForUser(normalized, session.user.id, {
      syncServiceM8: false,
      allowMissingContact: missingContact,
    })
    if (!('success' in result)) {
      summary.failed.push({ jobNumber, reason: result.error })
      continue
    }

    await db
      .update(leads)
      .set({
        servicem8JobUuid: row.servicem8JobUuid,
        servicem8JobNumber: row.servicem8JobNumber,
        servicem8Status: row.servicem8Status,
        syncStatus: 'synced',
        syncError: null,
      })
      .where(eq(leads.id, result.leadId))

    summary.inserted += 1
    if (row.notEnriched) summary.notEnriched += 1
    if (missingContact) summary.needsContact += 1
  }

  return { success: true, ...summary }
}

async function attachDedupeStatus(rows: LeadImportRow[]): Promise<LeadImportRow[]> {
  const refs = Array.from(new Set(rows.map((row) => importRef(row)).filter(Boolean)))
  if (refs.length === 0) return rows

  const existingRows = await db
    .select({ externalRef: leads.externalRef })
    .from(leads)
    .where(inArray(leads.externalRef, refs))
  const existingRefs = new Set(existingRows.map((row) => row.externalRef).filter(Boolean))
  const seenRefs = new Set<string>()

  return rows.map((row) => {
    const ref = importRef(row)
    const existing = Boolean(ref && (existingRefs.has(ref) || seenRefs.has(ref)))
    if (ref) seenRefs.add(ref)
    return { ...row, existing }
  })
}

function importRef(row: LeadImportRow): string {
  return row.jobNumber || row.input.externalRef?.trim() || ''
}

function validateImportMinimum(input: ReturnType<typeof normalizeInput>): string | null {
  if (!input.clientName) return 'Client name is required.'
  if (!input.projectType) return 'Project type is required.'
  if (!input.location) return 'Location / suburb is required.'
  return null
}

function withMissingContactFlag(freeText: string | undefined): string {
  const flag = '[Import flag] Missing phone/email in ServiceM8 at import time.'
  const trimmed = freeText?.trim()
  return trimmed ? `${trimmed}\n\n${flag}` : flag
}

function validateImportRequiredFields(row: LeadImportRow): string | null {
  if (!row.jobNumber && !row.input.externalRef?.trim()) return 'Job Number is required.'
  if (!row.input.clientProfileKey?.trim()) return 'Client Type is required.'
  if (!row.input.budgetBand?.trim()) return 'Budget Band is required.'
  if (!row.input.cat4?.trim()) return 'Complexity is required.'
  if (!row.input.priceSensitivityRead?.trim()) return 'Price Sensitivity is required.'
  return null
}

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== 'admin' || !session.user.id) return { error: 'Forbidden' } as const
  return session
}
