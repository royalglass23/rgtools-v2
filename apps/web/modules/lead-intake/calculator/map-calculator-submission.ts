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
  builder: 'builder_developer_pool_builder_landscaper',
  developer: 'builder_developer_pool_builder_landscaper',
  architect: 'builder_developer_pool_builder_landscaper',
  pool_builder: 'builder_developer_pool_builder_landscaper',
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

const SCENARIO_LABEL: Record<string, string> = {
  ground_level: 'Ground Level Balustrade',
  balcony_balustrade: 'Balcony Balustrade',
  stair_balustrade: 'Stair Balustrade',
  premium_pool_fence: 'Premium Pool Fence',
}

const FIXING_LABEL: Record<string, string> = {
  spigot_round: 'Round Spigots',
  spigot_square: 'Square Spigots',
  standoff_posts: 'Stand-off Posts',
  viking: 'Viking System',
  jh_clamps: 'JH Clamps',
  side_channel: 'Side Channel',
  top_channel: 'Top Channel',
  aluminium_1: 'Aluminium 1',
  aluminium_2: 'Aluminium 2',
  sed: 'SED (Special Engineer Design)',
  not_sure: 'To be confirmed',
}

const HARDWARE_FINISH_LABEL: Record<string, string> = {
  standard_chrome: 'Standard Chrome',
  matte_black: 'Matte Black',
  brushed_chrome: 'Brushed Chrome',
  powder_coated: 'Powder Coated',
  not_sure: 'To be confirmed',
}

const GLASS_TYPE_LABEL: Record<string, string> = {
  toughened_12mm: '12mm Toughened',
  laminated: 'Laminated Glass',
}

const GLASS_COLOUR_LABEL: Record<string, string> = {
  clear: 'Clear',
  low_iron: 'Low Iron / Ultra-Clear',
  tinted: 'Tinted',
  frosted: 'Frosted',
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
    cat4: '',
    location: stringValue(lead.address),
    source: 'calculator',
    leadSource: 'website_google_walk_in_cold_lead',
    timeline: stringValue(lead.timeframe),
    externalRef: options.submissionRef,
    jobDescription: buildJobDescription(submission, estimate, options.submittedAt),
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
  if (midpoint >= 20_000) return '20k_50k'
  if (midpoint >= 5_000) return '5k_20k'
  return 'lt_5k'
}

function buildJobDescription(
  submission: CalculatorSubmission,
  estimate: CalculatorEstimateForEmail,
  submittedAt: Date,
): string {
  const lead = submission.lead ?? {}
  const answers = submission.answers ?? {}
  const estimateText = `Estimate: $${estimate.low} - $${estimate.high}` +
    (estimate.subtotal !== null ? ` (subtotal $${estimate.subtotal})` : '')
  const project = `Project: ${formatKnownValue(answers.scenario, SCENARIO_LABEL)}, ${stringValue(answers.length)}m, ` +
    `${stringValue(answers.corners)} corner(s), ${stringValue(answers.gates)} gate(s)` +
    (numberValue(answers.landingLength) > 0 ? `, landing ${stringValue(answers.landingLength)}m` : '')
  // WizardAnswers uses fixingMethod/hardwareFinish; older payloads used fixing/hardware.
  const fixing = stringValue(answers.fixingMethod) || stringValue(answers.fixing)
  const hardware = stringValue(answers.hardwareFinish) || stringValue(answers.hardware)
  const glass = [
    formatKnownValue(answers.glassType, GLASS_TYPE_LABEL),
    formatKnownValue(answers.glassColour, GLASS_COLOUR_LABEL),
  ].filter(Boolean).join(' / ')
  const customerType =
    CUSTOMER_TYPE_LABEL[stringValue(lead.customerType)] ?? (stringValue(lead.customerType) || 'not specified')
  const consultation = `Consultation needed: ${estimate.needsCallUs || estimate.consultationFlags.length > 0 ? 'yes' : 'no'}` +
    (estimate.consultationFlags.length > 0 ? ` - ${estimate.consultationFlags.join('; ')}` : '')

  const lines = [
    `[Calculator] submitted ${submittedAt.toISOString()}`,
    estimateText,
    project,
    `Fixing: ${formatKnownValue(fixing, FIXING_LABEL) || 'not specified'} | Substrate: ${formatAnswerKey(answers.substrate) || 'not specified'} | Hardware: ${formatKnownValue(hardware, HARDWARE_FINISH_LABEL) || 'not specified'}`,
    `Glass: ${glass || 'not specified'}`,
    `Customer type: ${customerType} | Call preference: ${stringValue(lead.callPreference)}`,
    consultation,
    `Contact consent: ${lead.consent ? 'yes' : 'no'}`,
  ]

  const notes = stringValue(lead.notes)
  if (notes) lines.push(`Notes: ${notes}`)
  return lines.join('\n')
}

function formatKnownValue(value: unknown, labels: Record<string, string>): string {
  const key = stringValue(value)
  if (!key) return ''
  return labels[key] ?? formatAnswerKey(key)
}

function formatAnswerKey(value: unknown): string {
  const key = stringValue(value)
  if (!key) return ''
  return key
    .replaceAll('_', ' ')
    .replaceAll('/', ' / ')
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

function clampMoney(value: number): number {
  if (!Number.isFinite(value)) return Number.NaN
  return Math.min(Math.max(Math.round(value), 0), 999_999)
}
