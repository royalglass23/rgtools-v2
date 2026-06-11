import type { LeadIntakeInput } from '../actions'

export type WpCalculatorLead = {
  id: number
  status: string
  first_name: string
  last_name: string
  phone: string
  email: string
  customer_type: string
  timeframe: string
  address: string
  call_pref: string
  notes: string
  project_type: string
  length_m: number
  corners: number
  gates: number
  fixing_method: string
  substrate: string
  hardware: string
  est_low: string
  est_high: string
  // Optional fields — the WP export endpoint should include these; the mapper
  // degrades gracefully if they are absent (older export, missing column).
  est_subtotal?: string
  needs_consult?: number
  consult_notes?: string
  height?: string
  consent_given: number
  created_at: string
}

const CLIENT_PROFILE_BY_CUSTOMER_TYPE: Record<string, string> = {
  homeowner: 'homeowner',
  builder: 'new_business',
  developer: 'new_business',
  architect: 'new_business',
  pool_builder: 'new_business',
}

const BUSINESS_CUSTOMER_TYPES = new Set(['builder', 'developer', 'architect', 'pool_builder'])

// Calculator scenarios → rgtools lead-intake project-type keys (PROJECT_TYPES in
// LeadIntakeForm.tsx). Keys are identical for the balustrade variants; only the
// pool-fence scenario is renamed.
const PROJECT_TYPE_BY_SCENARIO: Record<string, string> = {
  ground_level: 'ground_level',
  balcony_balustrade: 'balcony_balustrade',
  stair_balustrade: 'stair_balustrade',
  premium_pool_fence: 'pool_fence',
}

// Human-readable labels for the raw calculator customer_type, used in freeText.
const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  homeowner: 'Homeowner',
  builder: 'Builder',
  developer: 'Developer',
  architect: 'Architect',
  pool_builder: 'Pool Builder',
  other: 'Other',
}

export function mapWpLeadToIntakeInput(wp: WpCalculatorLead): LeadIntakeInput {
  const clientName = `${wp.first_name} ${wp.last_name}`.trim()

  return {
    clientName,
    companyName: BUSINESS_CUSTOMER_TYPES.has(wp.customer_type) ? clientName : '',
    phone: wp.phone,
    email: wp.email,
    clientProfileKey: CLIENT_PROFILE_BY_CUSTOMER_TYPE[wp.customer_type] ?? '',
    projectType: PROJECT_TYPE_BY_SCENARIO[wp.project_type] ?? 'other',
    budgetBand: budgetBandFromEstimate(wp.est_low, wp.est_high),
    cat4: complexityFromConsult(wp.needs_consult),
    location: wp.address,
    source: 'calculator',
    timeline: wp.timeframe || '',
    externalRef: `calculator:${wp.id}`,
    freeText: buildFreeText(wp),
  }
}

// Maps the calculator's estimate range to a scoring budget band (category 2).
// Uses the midpoint of low/high — the calculator range is 90%–120% of its true
// estimate, so the midpoint sits closest to the real job value. Keys MUST match
// the active scoring config's category 2 options exactly or import validation fails.
export function budgetBandFromEstimate(estLow: string, estHigh: string): string {
  const low = Number.parseFloat(estLow)
  const high = Number.parseFloat(estHigh)
  if (!Number.isFinite(low) || !Number.isFinite(high)) return ''

  const midpoint = (low + high) / 2
  if (midpoint <= 0) return ''
  if (midpoint >= 50_000) return '50k_plus'
  if (midpoint >= 10_000) return '10k_to_50k'
  if (midpoint >= 2_000) return '2k_to_10k'
  return 'under_2k'
}

// Complexity band (scoring category 4) from the calculator's consultation flag.
// A flagged lead ("not sure" / needs advice) is minor custom work; an unflagged
// all-menu selection is standard. We deliberately never auto-assign complex_install
// because it is a scoring STRIKE that demotes the tier — that judgment stays with staff.
function complexityFromConsult(needsConsult: number | undefined): string {
  return needsConsult ? 'minor_custom' : 'standard_non_custom'
}

// Dumps everything the calculator captured into the lead's free-text notes, so no
// detail is lost even where it has no dedicated scored field.
function buildFreeText(wp: WpCalculatorLead): string {
  const estimate = `Estimate: $${wp.est_low} - $${wp.est_high}` +
    (wp.est_subtotal ? ` (subtotal $${wp.est_subtotal})` : '')
  const project = `Project: ${wp.project_type}, ${wp.length_m}m, ${wp.corners} corner(s), ${wp.gates} gate(s)` +
    (wp.height ? `, height ${wp.height}` : '')
  const customerType = CUSTOMER_TYPE_LABEL[wp.customer_type] ?? wp.customer_type ?? 'not specified'
  const consultation = `Consultation needed: ${wp.needs_consult ? 'yes' : 'no'}` +
    (wp.consult_notes ? ` — ${wp.consult_notes}` : '')

  const lines = [
    `[Calculator] WP lead #${wp.id}, submitted ${wp.created_at}`,
    estimate,
    project,
    `Fixing: ${wp.fixing_method || 'not specified'} | Substrate: ${wp.substrate || 'not specified'} | Hardware: ${wp.hardware || 'not specified'}`,
    `Customer type: ${customerType} | Call preference: ${wp.call_pref}`,
    consultation,
    `Contact consent: ${wp.consent_given ? 'yes' : 'no'}`,
  ]
  if (wp.notes) lines.push(`Notes: ${wp.notes}`)
  return lines.join('\n')
}
