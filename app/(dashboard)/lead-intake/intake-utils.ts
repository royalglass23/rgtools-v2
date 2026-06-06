import type { LeadIntakeInput } from './actions'

export type NormalizedLeadIntakeInput = LeadIntakeInput & {
  phoneNormalized: string | null
}

export type IntakeCategoryOptions = Record<string, { options: Array<{ key: string }> }>

export function normalizeInput(input: LeadIntakeInput): NormalizedLeadIntakeInput {
  const email = input.email?.trim().toLowerCase() || ''
  const phone = input.phone?.trim() || ''

  return {
    ...input,
    clientName: input.clientName.trim(),
    companyName: input.companyName?.trim() || '',
    phone,
    phoneNormalized: normalizeNzPhone(phone),
    email,
    clientProfileKey: input.clientProfileKey.trim(),
    projectType: input.projectType.trim(),
    location: input.location.trim(),
    suburb: input.suburb?.trim() || '',
    cat4: input.cat4?.trim() || '',
    timeline: input.timeline?.trim() || '',
    consentStatus: input.consentStatus?.trim() || '',
    budgetBand: input.budgetBand?.trim() || '',
    decisionMakers: input.decisionMakers?.trim() || '',
    priceSensitivityRead: input.priceSensitivityRead?.trim() || '',
    freeText: input.freeText?.trim() || '',
  }
}

export function validateMinimum(input: NormalizedLeadIntakeInput): string | null {
  if (!input.clientName) return 'Client name is required.'
  if (!input.phone && !input.email) return 'Phone or email is required.'
  if (!input.projectType) return 'Project type is required.'
  if (!input.location) return 'Location / suburb is required.'
  if (!input.clientProfileKey) return 'Client type is required.'
  return null
}

export function validateScoredOptions(
  input: NormalizedLeadIntakeInput,
  categories: IntakeCategoryOptions,
): string | null {
  const checks = [
    ['1', input.clientProfileKey, 'Client type'],
    ['4', input.cat4, 'Distance / complexity'],
    ['3', input.timeline, 'Timeline'],
    ['3', input.consentStatus, 'Consent status'],
    ['2', input.budgetBand, 'Budget band'],
    ['6', input.decisionMakers, 'Decision-makers'],
    ['5', input.priceSensitivityRead, 'Price-sensitivity read'],
  ] as const

  for (const [category, value, label] of checks) {
    if (value && !categories[category]?.options.some((option) => option.key === value)) {
      return `${label} is not a valid active config option.`
    }
  }

  return null
}

export function buildCategoryAnswers(input: NormalizedLeadIntakeInput) {
  return [
    { category: 1, answerKey: input.clientProfileKey },
    { category: 2, answerKey: input.budgetBand },
    { category: 3, answerKey: input.consentStatus || input.timeline },
    { category: 4, answerKey: input.cat4 },
    { category: 5, answerKey: input.priceSensitivityRead },
    { category: 6, answerKey: input.decisionMakers },
  ]
}

export function normalizeNzPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('64')) return `+${digits}`
  if (digits.startsWith('0')) return `+64${digits.slice(1)}`
  return `+64${digits}`
}
