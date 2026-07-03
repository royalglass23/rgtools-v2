import type { LeadIntakeInput } from '../actions'
import { numberValue, stringValue } from './parse'

export type CalculatorSubmission = {
  answers?: Record<string, unknown>
  lead?: {
    firstName?: unknown
    lastName?: unknown
    phone?: unknown
    email?: unknown
    customerType?: unknown
    timeframe?: unknown
    address?: unknown
    callPreference?: unknown
    notes?: unknown
    consent?: unknown
    websiteUrl?: unknown
  }
  estimate?: {
    low?: unknown
    high?: unknown
    subtotal?: unknown
    needsCallUs?: unknown
    consultationFlags?: unknown
  }
  turnstileToken?: unknown
  loadedAt?: unknown
  submissionRef?: unknown
}

export type CalculatorEstimateForEmail = {
  low: number
  high: number
  subtotal: number | null
  consultationFlags: string[]
  needsCallUs: boolean
}

const CLIENT_PROFILE_BY_CUSTOMER_TYPE: Record<string, string> = {
  homeowner: 'homeowner',
  builder: 'new_business',
  developer: 'new_business',
  architect: 'new_business',
  pool_builder: 'new_business',
}

const BUSINESS_CUSTOMER_TYPES = new Set(['builder', 'developer', 'architect', 'pool_builder'])

const PROJECT_TYPE_BY_SCENARIO: Record<string, string> = {
  ground_level: 'ground_level',
  balcony_balustrade: 'balcony_balustrade',
  stair_balustrade: 'stair_balustrade',
  premium_pool_fence: 'pool_fence',
}

const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  homeowner: 'Homeowner',
  builder: 'Builder',
  developer: 'Developer',
  architect: 'Architect',
  pool_builder: 'Pool Builder',
  other: 'Other',
}

export function mapCalculatorSubmissionToIntakeInput(
  submission: CalculatorSubmission,
  options: { submittedAt: Date; submissionRef: string },
): LeadIntakeInput {
  const lead = submission.lead ?? {}
  const answers = submission.answers ?? {}
  const estimate = normalizeEstimate(submission.estimate)
  const customerType = stringValue(lead.customerType)
  const firstName = stringValue(lead.firstName)
  const lastName = stringValue(lead.lastName)
  const clientName = `${firstName} ${lastName}`.trim()
  const scenario = stringValue(answers.scenario)

  return {
    clientName,
    companyName: BUSINESS_CUSTOMER_TYPES.has(customerType) ? clientName : '',
    phone: stringValue(lead.phone),
    email: stringValue(lead.email),
    clientProfileKey: CLIENT_PROFILE_BY_CUSTOMER_TYPE[customerType] ?? '',
    projectType: PROJECT_TYPE_BY_SCENARIO[scenario] ?? 'other',
    budgetBand: budgetBandFromEstimate(estimate.low, estimate.high),
    cat4: complexityFromConsult(estimate.needsCallUs || estimate.consultationFlags.length > 0),
    location: stringValue(lead.address),
    source: 'calculator',
    timeline: stringValue(lead.timeframe),
    externalRef: options.submissionRef,
    freeText: buildFreeText(submission, estimate, options.submittedAt),
  }
}

export function normalizeEstimate(estimate: CalculatorSubmission['estimate']): CalculatorEstimateForEmail {
  const low = clampMoney(numberValue(estimate?.low))
  const high = clampMoney(numberValue(estimate?.high))
  const orderedLow = Math.min(low, high)
  const orderedHigh = Math.max(low, high)
  const subtotal = estimate?.subtotal === undefined || estimate?.subtotal === null
    ? null
    : clampMoney(numberValue(estimate.subtotal))

  return {
    low: orderedLow,
    high: orderedHigh,
    subtotal,
    needsCallUs: Boolean(estimate?.needsCallUs),
    consultationFlags: Array.isArray(estimate?.consultationFlags)
      ? estimate.consultationFlags.map(stringValue).filter(Boolean)
      : [],
  }
}

export function budgetBandFromEstimate(lowValue: unknown, highValue: unknown): string {
  const low = clampMoney(numberValue(lowValue))
  const high = clampMoney(numberValue(highValue))
  if (!Number.isFinite(low) || !Number.isFinite(high)) return ''

  const midpoint = (Math.min(low, high) + Math.max(low, high)) / 2
  if (midpoint <= 0) return ''
  if (midpoint >= 50_000) return '50k_plus'
  if (midpoint >= 10_000) return '10k_to_50k'
  if (midpoint >= 2_000) return '2k_to_10k'
  return 'under_2k'
}

function buildFreeText(
  submission: CalculatorSubmission,
  estimate: CalculatorEstimateForEmail,
  submittedAt: Date,
): string {
  const lead = submission.lead ?? {}
  const answers = submission.answers ?? {}
  const estimateText = `Estimate: $${estimate.low} - $${estimate.high}` +
    (estimate.subtotal !== null ? ` (subtotal $${estimate.subtotal})` : '')
  const project = `Project: ${stringValue(answers.scenario)}, ${stringValue(answers.length)}m, ` +
    `${stringValue(answers.corners)} corner(s), ${stringValue(answers.gates)} gate(s)` +
    (numberValue(answers.landingLength) > 0 ? `, landing ${stringValue(answers.landingLength)}m` : '')
  // WizardAnswers uses fixingMethod/hardwareFinish; older payloads used fixing/hardware.
  const fixing = stringValue(answers.fixingMethod) || stringValue(answers.fixing)
  const hardware = stringValue(answers.hardwareFinish) || stringValue(answers.hardware)
  const glass = [stringValue(answers.glassType), stringValue(answers.glassColour)].filter(Boolean).join(' / ')
  const customerType =
    CUSTOMER_TYPE_LABEL[stringValue(lead.customerType)] ?? (stringValue(lead.customerType) || 'not specified')
  const consultation = `Consultation needed: ${estimate.needsCallUs || estimate.consultationFlags.length > 0 ? 'yes' : 'no'}` +
    (estimate.consultationFlags.length > 0 ? ` - ${estimate.consultationFlags.join('; ')}` : '')

  const lines = [
    `[Calculator] submitted ${submittedAt.toISOString()}`,
    estimateText,
    project,
    `Fixing: ${fixing || 'not specified'} | Substrate: ${stringValue(answers.substrate) || 'not specified'} | Hardware: ${hardware || 'not specified'}`,
    `Glass: ${glass || 'not specified'}`,
    `Customer type: ${customerType} | Call preference: ${stringValue(lead.callPreference)}`,
    consultation,
    `Contact consent: ${lead.consent ? 'yes' : 'no'}`,
  ]

  const notes = stringValue(lead.notes)
  if (notes) lines.push(`Notes: ${notes}`)
  return lines.join('\n')
}

function complexityFromConsult(needsConsult: boolean): string {
  return needsConsult ? 'minor_custom' : 'standard_non_custom'
}

function clampMoney(value: number): number {
  if (!Number.isFinite(value)) return Number.NaN
  return Math.min(Math.max(Math.round(value), 0), 999_999)
}
