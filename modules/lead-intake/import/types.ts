import type { LeadIntakeInput } from '@/modules/lead-intake/actions'

export type RawImportRow = {
  rowNumber: number
  values: Record<string, string>
}

export type FieldIssue = {
  field: keyof LeadIntakeInput | 'jobNumber'
  message: string
}

export type LeadImportRow = {
  rowId: string
  rowNumber: number
  jobNumber: string
  input: LeadIntakeInput
  issues: FieldIssue[]
  enriched: boolean
  servicem8JobUuid: string | null
  servicem8JobNumber: string | null
  servicem8Status: string | null
  existing: boolean
  autoSkip: boolean
  needsContact: boolean
  notEnriched: boolean
  enrichmentMessage: string | null
}

export type LeadImportSummary = {
  inserted: number
  skippedExisting: number
  skippedCompleted: number
  notEnriched: number
  needsContact: number
  failed: Array<{ jobNumber: string; reason: string }>
}

export type PreviewLeadImportResult =
  | { success: true; rows: LeadImportRow[] }
  | { error: string }

export type CommitLeadImportResult =
  | ({ success: true } & LeadImportSummary)
  | { error: string }
