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

export function mapWpLeadToIntakeInput(wp: WpCalculatorLead): LeadIntakeInput {
  const clientName = `${wp.first_name} ${wp.last_name}`.trim()

  return {
    clientName,
    companyName: BUSINESS_CUSTOMER_TYPES.has(wp.customer_type) ? clientName : '',
    phone: wp.phone,
    email: wp.email,
    clientProfileKey: CLIENT_PROFILE_BY_CUSTOMER_TYPE[wp.customer_type] ?? '',
    projectType: wp.project_type,
    location: wp.address,
    source: 'calculator',
    timeline: wp.timeframe || '',
    externalRef: `calculator:${wp.id}`,
    freeText: buildFreeText(wp),
  }
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
