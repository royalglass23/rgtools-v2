import type { LeadIntakeInput } from '@/modules/lead-intake/actions'
import type { ActiveScoringOptionLists } from '@/modules/lead-intake/scoring/config-options'
import type { FieldIssue, LeadImportRow, RawImportRow } from './types'

type DropdownMapping = {
  header: string
  field: keyof LeadIntakeInput
  category: string
  required?: boolean
}

const DROPDOWNS: DropdownMapping[] = [
  { header: 'Client Type *', field: 'clientProfileKey', category: '1', required: true },
  { header: 'Budget Band *', field: 'budgetBand', category: '2', required: true },
  { header: 'Complexity *', field: 'cat4', category: '4', required: true },
  { header: 'Price Sensitivity *', field: 'priceSensitivityRead', category: '5', required: true },
  { header: 'Decision Makers', field: 'decisionMakers', category: '6' },
  { header: 'Resource Consent', field: 'rcStatus', category: '8' },
  { header: 'Building Consent', field: 'bcStatus', category: '9' },
  { header: 'Building Stage', field: 'buildingStage', category: '10' },
]

export function mapTemplateRow(raw: RawImportRow, optionLists: ActiveScoringOptionLists): LeadImportRow {
  const issues: FieldIssue[] = []
  const jobNumber = value(raw, 'Job Number *')
  const input: LeadIntakeInput = {
    clientName: value(raw, 'Client Name *'),
    companyName: value(raw, 'Company'),
    phone: value(raw, 'Phone'),
    email: value(raw, 'Email'),
    location: value(raw, 'Job Address *'),
    clientProfileKey: '',
    projectType: 'Other',
    source: 'other',
    externalRef: jobNumber,
    cat4: '',
    budgetBand: '',
    priceSensitivityRead: '',
    decisionMakers: '',
    rcStatus: '',
    bcStatus: '',
    buildingStage: '',
    freeText: value(raw, 'Notes'),
  }

  if (!jobNumber) issues.push({ field: 'jobNumber', message: 'Job Number is required.' })
  if (!input.clientName) issues.push({ field: 'clientName', message: 'Client Name is required.' })
  if (!input.location) issues.push({ field: 'location', message: 'Job Address is required.' })

  for (const dropdown of DROPDOWNS) {
    const rawValue = value(raw, dropdown.header)
    const mapped = mapLabelToOptionKey(rawValue, optionLists, dropdown.category)
    if (!rawValue && dropdown.required) {
      issues.push({ field: dropdown.field, message: `${headerLabel(dropdown.header)} is required.` })
    } else if (rawValue && !mapped) {
      issues.push({ field: dropdown.field, message: `${rawValue} is not a valid ${headerLabel(dropdown.header)} option.` })
    }
    ;(input[dropdown.field] as string | undefined) = mapped ?? ''
  }

  const needsContact = !input.phone && !input.email

  return {
    rowId: `row-${raw.rowNumber}`,
    rowNumber: raw.rowNumber,
    jobNumber,
    input,
    issues,
    enriched: false,
    servicem8JobUuid: null,
    servicem8JobNumber: null,
    servicem8Status: null,
    existing: false,
    autoSkip: false,
    needsContact,
    notEnriched: true,
    enrichmentMessage: null,
  }
}

export function mapLabelToOptionKey(
  label: string,
  optionLists: ActiveScoringOptionLists,
  category: string,
): string | null {
  const trimmed = label.trim()
  if (!trimmed) return null
  if (category === '2') {
    const budgetKey = mapBudgetBandLabel(trimmed)
    if (budgetKey && optionLists.categories[category]?.options.some((option) => option.key === budgetKey)) {
      return budgetKey
    }
  }

  const normalised = normalizeLabel(trimmed)
  const options = optionLists.categories[category]?.options ?? []
  return options.find((option) =>
    normalizeLabel(option.label) === normalised || normalizeLabel(option.key) === normalised
  )?.key ?? null
}

function value(raw: RawImportRow, header: string): string {
  return raw.values[header]?.trim() ?? ''
}

function normalizeLabel(valueToNormalize: string): string {
  return normalizeText(valueToNormalize).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function normalizeText(valueToNormalize: string): string {
  return valueToNormalize
    .replaceAll('â€“', '-')
    .replaceAll('â€”', '-')
    .replaceAll('â€‘', '-')
    .replace(/[–—−]/g, '-')
}

function mapBudgetBandLabel(label: string): string | null {
  const text = normalizeText(label).toLowerCase()
  const compact = text.replace(/[\s,$]/g, '')

  if (/^(50k|50000)\+/.test(compact) || compact.includes('50000plus')) return '50k_plus'
  if (isRange(compact, ['10000', '10k'], ['50000', '50k'])) return '10k_to_50k'
  if (isRange(compact, ['2000', '2k'], ['10000', '10k'])) return '2k_to_10k'
  if (compact.includes('lessthan2000') || compact.includes('under2000') || compact.includes('<2000')) {
    return 'under_2k'
  }
  return null
}

function isRange(compact: string, starts: string[], ends: string[]): boolean {
  return starts.some((start) => compact.includes(start)) && ends.some((end) => compact.includes(end))
}

function headerLabel(header: string): string {
  return header.replace(' *', '')
}
