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
// LeadIntakeForm.tsx). Three of the four calculator scenarios are balustrade variants.
const PROJECT_TYPE_BY_SCENARIO: Record<string, string> = {
  ground_level: 'balustrade',
  balcony_balustrade: 'balustrade',
  stair_balustrade: 'balustrade',
  premium_pool_fence: 'pool_fence',
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

function buildFreeText(wp: WpCalculatorLead): string {
  const lines = [
    `[Calculator] WP lead #${wp.id}, submitted ${wp.created_at}`,
    `Estimate: $${wp.est_low} - $${wp.est_high}`,
    `Project: ${wp.project_type}, ${wp.length_m}m, ${wp.corners} corner(s), ${wp.gates} gate(s)`,
    `Fixing: ${wp.fixing_method || 'not specified'} | Substrate: ${wp.substrate || 'not specified'} | Hardware: ${wp.hardware || 'not specified'}`,
    `Customer type: ${wp.customer_type || 'not specified'} | Call preference: ${wp.call_pref}`,
    `Contact consent: ${wp.consent_given ? 'yes' : 'no'}`,
  ]
  if (wp.notes) lines.push(`Notes: ${wp.notes}`)
  return lines.join('\n')
}
