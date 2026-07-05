export type LeadTier = 'A' | 'B' | 'C' | 'D' | 'E'
export type LeadAnswers = DecisionMatrixAnswers

export type MatrixFieldKey =
  | 'clientType'
  | 'budgetBand'
  | 'resourceConsent'
  | 'buildingConsent'
  | 'buildingStage'
  | 'projectType'
  | 'priceSensitivity'
  | 'decisionMakers'
  | 'source'
  | 'distanceBand'
  | 'paymentHistory'
  | 'siteAccess'
  | 'installationHeight'

export type MatrixOption = {
  key: string
  label: string
  points: number
  teamNote: string
}

export type MatrixField = {
  key: MatrixFieldKey
  label: string
  maxPoints: number
  options: MatrixOption[]
}

export type MatrixTier = {
  tier: LeadTier
  minScore: number
  maxScore: number
  teamAction: string
  followUpOffsetDays: number
}

export type DecisionMatrixAnswers = Partial<Record<MatrixFieldKey, string | null | undefined>>

export type ScoreResult = {
  score: number
  tier: LeadTier
  completeness: {
    answered: number
    total: number
  }
}

export const DECISION_MATRIX = {
  fields: [
    {
      key: 'clientType',
      label: 'Client Type',
      maxPoints: 14,
      options: [
        {
          key: 'builder_developer_pool_builder_landscaper',
          label: 'Builder / Developer / Pool Builder / Landscaper',
          points: 14,
          teamNote: 'Highest priority. Focus on building a long-term relationship, not just this project. Ask about upcoming projects and referral opportunities.',
        },
        {
          key: 'homeowner',
          label: 'Homeowner',
          points: 0,
          teamNote: 'Focus on trust, communication and education. Use testimonials and completed project photos.',
        },
      ],
    },
    {
      key: 'budgetBand',
      label: 'Budget Band',
      maxPoints: 20,
      options: [
        {
          key: '50k_plus',
          label: '$50k+',
          points: 20,
          teamNote: 'High-value opportunity. Arrange an on-site meeting within 48 hours. Senior salesperson to manage.',
        },
        {
          key: '20k_50k',
          label: '$20k-50k',
          points: 13,
          teamNote: 'Good opportunity. Follow up weekly and maintain momentum.',
        },
        {
          key: '5k_20k',
          label: '$5k-20k',
          points: 7,
          teamNote: 'Standard sales process. Provide quotation promptly.',
        },
        {
          key: 'lt_5k',
          label: '<$5k',
          points: 0,
          teamNote: 'Keep sales cost low. Reach common ground before arranging site visits.',
        },
      ],
    },
    {
      key: 'resourceConsent',
      label: 'Resource Consent',
      maxPoints: 6,
      options: [
        {
          key: 'approved_not_required',
          label: 'Approved / Not Required',
          points: 6,
          teamNote: 'Project is progressing. Prepare for site measure and quotation.',
        },
        {
          key: 'submitted_pending',
          label: 'Submitted / Pending',
          points: 3,
          teamNote: 'Monitor approval progress. Follow up monthly.',
        },
        {
          key: 'not_available',
          label: 'Not Available',
          points: 0,
          teamNote: 'Do not chase aggressively. Add a reminder to check back every 2-3 months.',
        },
      ],
    },
    {
      key: 'buildingConsent',
      label: 'Building Consent',
      maxPoints: 6,
      options: [
        {
          key: 'approved_not_required',
          label: 'Approved / Not Required',
          points: 6,
          teamNote: 'Ready to move forward. Share the plan if there is one.',
        },
        {
          key: 'submitted_pending',
          label: 'Submitted / Pending',
          points: 3,
          teamNote: 'Keep in touch while waiting for approval.',
        },
        {
          key: 'not_available',
          label: 'Not Available',
          points: 0,
          teamNote: 'Low priority until consent is obtained.',
        },
      ],
    },
    {
      key: 'buildingStage',
      label: 'Building Stage',
      maxPoints: 8,
      options: [
        {
          key: 'ready_for_glazing',
          label: 'Ready for Glazing',
          points: 8,
          teamNote: 'Highest priority. Contact within 24 hours. Arrange final measure and installation planning. Offer free site visit.',
        },
        {
          key: 'interior_finish',
          label: 'Interior Finish',
          points: 6,
          teamNote: 'Stay close to the client. Confirm production timing.',
        },
        {
          key: 'gib_plastering_framing_complete',
          label: 'GIB / Plastering / Framing Complete',
          points: 4,
          teamNote: 'Continue relationship and prepare quotation.',
        },
        {
          key: 'foundation_early_construction',
          label: 'Foundation / Early Construction',
          points: 2,
          teamNote: 'Educate the customer and stay visible. Monthly follow-up is sufficient.',
        },
        {
          key: 'planning',
          label: 'Planning',
          points: 0,
          teamNote: 'Very early stage. Avoid frequent follow-up. Check in every 2 months.',
        },
      ],
    },
    {
      key: 'projectType',
      label: 'Project Type',
      maxPoints: 6,
      options: [
        {
          key: 'new_build_commercial_fit_out',
          label: 'New Build / Commercial Fit-out',
          points: 6,
          teamNote: 'Great opportunity for a complete glazing package.',
        },
        {
          key: 'high_end_residential_multi_unit_residential',
          label: 'High-end Residential / Multi-unit Residential',
          points: 3,
          teamNote: 'Focus on quality, aesthetics and project management.',
        },
        {
          key: 'renovation_replacement',
          label: 'Renovation / Replacement',
          points: 0,
          teamNote: 'Speed wins. Provide fast quotation and flexible scheduling.',
        },
      ],
    },
    {
      key: 'priceSensitivity',
      label: 'Price Sensitivity',
      maxPoints: 8,
      options: [
        {
          key: 'not_price_sensitive',
          label: 'Not Price Sensitive',
          points: 8,
          teamNote: 'Sell quality, workmanship, warranty and service - not price.',
        },
        {
          key: 'value_focused',
          label: 'Value Focused',
          points: 6,
          teamNote: 'Demonstrate long-term value and lower lifecycle cost.',
        },
        {
          key: 'normal',
          label: 'Normal',
          points: 4,
          teamNote: 'Balance quality and pricing.',
        },
        {
          key: 'price_sensitive',
          label: 'Price Sensitive',
          points: 2,
          teamNote: 'Educate the client. Explain why glazing quality, installation and warranty matter more than the cheapest quote.',
        },
        {
          key: 'cheapest_only',
          label: 'Cheapest Only',
          points: 0,
          teamNote: 'Avoid competing only on price. Offer a standard proposal and minimise sales time.',
        },
      ],
    },
    {
      key: 'decisionMakers',
      label: 'Decision Makers',
      maxPoints: 6,
      options: [
        {
          key: 'decision_maker_confirmed_owner_director',
          label: 'Decision Maker Confirmed / Owner / Director',
          points: 6,
          teamNote: 'Move toward closing. Ask for the order or schedule the next step.',
        },
        {
          key: 'project_manager_site_manager',
          label: 'Project Manager / Site Manager',
          points: 3,
          teamNote: 'Build the relationship but identify who signs off the purchase.',
        },
        {
          key: 'multiple_decision_makers_unknown',
          label: 'Multiple Decision Makers / Unknown',
          points: 0,
          teamNote: 'Your next objective is to identify the actual decision maker before spending more time.',
        },
      ],
    },
    {
      key: 'source',
      label: 'Source',
      maxPoints: 8,
      options: [
        {
          key: 'existing_client_referral_repeat_builder_architect',
          label: 'Existing Client / Referral / Repeat Builder / Architect',
          points: 8,
          teamNote: 'Warm lead with high conversion potential. Respond quickly and strengthen the relationship.',
        },
        {
          key: 'website_google_walk_in_cold_lead',
          label: 'Website / Google / Walk-in / Cold Lead',
          points: 0,
          teamNote: 'Qualify first. Determine project readiness before investing significant time.',
        },
      ],
    },
    {
      key: 'distanceBand',
      label: 'Driving Distance',
      maxPoints: 5,
      options: [
        {
          key: 'lt_15km',
          label: '<15 km',
          points: 5,
          teamNote: 'Excellent candidate for a site visit.',
        },
        {
          key: '15_50km',
          label: '15-50 km',
          points: 3,
          teamNote: 'Combine appointments where possible.',
        },
        {
          key: 'gt_50km',
          label: '> 50 km',
          points: 0,
          teamNote: 'Arrange a Teams/Zoom meeting first. Visit only for qualified opportunities.',
        },
      ],
    },
    {
      key: 'paymentHistory',
      label: 'Payment History',
      maxPoints: 5,
      options: [
        {
          key: 'always_on_time_good',
          label: 'Always On Time / Good',
          points: 5,
          teamNote: 'Preferred customer. Prioritise scheduling.',
        },
        {
          key: 'new_client',
          label: 'New Client',
          points: 3,
          teamNote: 'Request a deposit before ordering materials.',
        },
        {
          key: 'slow_payment_poor_history',
          label: 'Slow Payment / Poor History',
          points: 0,
          teamNote: 'Management approval or strict payment terms required before proceeding.',
        },
      ],
    },
    {
      key: 'siteAccess',
      label: 'Site Access / Parking / Special Equipment',
      maxPoints: 6,
      options: [
        {
          key: 'easy',
          label: 'Easy',
          points: 6,
          teamNote: 'Standard installation planning.',
        },
        {
          key: 'normal',
          label: 'Normal',
          points: 4,
          teamNote: 'Confirm parking and unloading before installation.',
        },
        {
          key: 'tight',
          label: 'Tight',
          points: 2,
          teamNote: 'Plan manpower and equipment carefully.',
        },
        {
          key: 'very_difficult',
          label: 'Very Difficult',
          points: 0,
          teamNote: 'Conduct a pre-site inspection. Consider glass robot or crane. Allow extra installation time.',
        },
      ],
    },
    {
      key: 'installationHeight',
      label: 'Installation Height',
      maxPoints: 2,
      options: [
        {
          key: 'ground_floor_ladder',
          label: 'Ground Floor / Ladder',
          points: 2,
          teamNote: 'Standard installation.',
        },
        {
          key: 'scaffold_ewp_crane',
          label: 'Scaffold / EWP / Crane',
          points: 0,
          teamNote: 'Confirm equipment availability and complete safety planning before scheduling.',
        },
      ],
    },
  ],
  tiers: [
    {
      tier: 'A',
      minScore: 85,
      maxScore: 100,
      teamAction: 'Call within 24 hours. Arrange a site meeting. Assign to senior salesperson.',
      followUpOffsetDays: 1,
    },
    {
      tier: 'B',
      minScore: 70,
      maxScore: 84,
      teamAction: 'Strong opportunity. Follow up weekly until a decision is made.',
      followUpOffsetDays: 7,
    },
    {
      tier: 'C',
      minScore: 50,
      maxScore: 69,
      teamAction: 'Nurture the opportunity. Follow up every 2-4 weeks.',
      followUpOffsetDays: 21,
    },
    {
      tier: 'D',
      minScore: 30,
      maxScore: 49,
      teamAction: 'Low priority. Monthly touch base.',
      followUpOffsetDays: 30,
    },
    {
      tier: 'E',
      minScore: 0,
      maxScore: 29,
      teamAction: 'Add to nurture list. Follow up every 2-3 months or when project status changes.',
      followUpOffsetDays: 75,
    },
  ],
} satisfies {
  fields: MatrixField[]
  tiers: MatrixTier[]
}

export const MATRIX_FIELD_COUNT = DECISION_MATRIX.fields.length

const fieldByKey = new Map(DECISION_MATRIX.fields.map((field) => [field.key, field]))

export function scoreLead(answers: DecisionMatrixAnswers): ScoreResult {
  let score = 0
  let answered = 0

  for (const field of DECISION_MATRIX.fields) {
    const answerKey = answers[field.key]
    if (!answerKey) continue

    answered += 1
    score += optionPoints(field, answerKey)
  }

  return {
    score,
    tier: tierForScore(score),
    completeness: {
      answered,
      total: MATRIX_FIELD_COUNT,
    },
  }
}

export function tierForScore(score: number): LeadTier {
  return DECISION_MATRIX.tiers.find((tier) => score >= tier.minScore)?.tier ?? 'E'
}

export function optionPoints(fieldOrKey: MatrixField | MatrixFieldKey, answerKey: string): number {
  const field = typeof fieldOrKey === 'string' ? fieldByKey.get(fieldOrKey) : fieldOrKey
  return field?.options.find((option) => option.key === answerKey)?.points ?? 0
}

export function optionTeamNote(fieldKey: MatrixFieldKey, answerKey: string | null | undefined): string | null {
  if (!answerKey) return null
  return fieldByKey.get(fieldKey)?.options.find((option) => option.key === answerKey)?.teamNote ?? null
}

export function tierAction(tier: LeadTier): MatrixTier {
  return DECISION_MATRIX.tiers.find((candidate) => candidate.tier === tier) ?? DECISION_MATRIX.tiers.at(-1)!
}
