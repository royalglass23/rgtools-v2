import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import type { ScoringConfig } from '../modules/lead-intake/scoring/score-lead'
config({ path: '.env.local' })

export function buildScoringConfigV4(): ScoringConfig {
  return {
    categories: {
      '1': {
        label: 'Client type',
        max: 19,
        options: {
          repeat_builder: 19,
          existing_business: 15,
          new_business: 13,
          homeowner: 9,
          landlord: 4,
        },
        optionOrder: ['repeat_builder', 'existing_business', 'new_business', 'homeowner', 'landlord'],
        optionLabels: {
          repeat_builder: 'Regular builder/Pool contractor with repeat orders',
          existing_business: 'Existing/Partial Business Client (split orders between Royal & competitors, room to expand share)',
          new_business: 'New prospective Business Client (no prior deal, qualified builder/renovation firm with big potential)',
          homeowner: 'Owner-occupier/Homeowner (self-use renovation/new build, full independent budget control)',
          landlord: 'Investment rental property landlord (cost-driven, heavy price shopping)',
        },
      },
      '2': {
        label: 'Budget band',
        max: 19,
        options: { '50k_plus': 19, '10k_to_50k': 14, '2k_to_10k': 8, under_2k: 3 },
        optionOrder: ['50k_plus', '10k_to_50k', '2k_to_10k', 'under_2k'],
        optionLabels: {
          '50k_plus': '$50,000+',
          '10k_to_50k': '$10,000 â€“ $50,000',
          '2k_to_10k': '$2,000 â€“ $10,000',
          under_2k: 'Less than $2,000',
        },
      },
      '4': {
        label: 'Complexity',
        max: 14,
        options: { standard_non_custom: 14, minor_custom: 9, complex_install: 0 },
        optionOrder: ['standard_non_custom', 'minor_custom', 'complex_install'],
        optionLabels: {
          standard_non_custom: 'Standard non-custom glass',
          minor_custom: 'Minor custom work',
          complex_install: 'Oversized / special laminated / switchable glass with complex install',
        },
      },
      '5': {
        label: 'Price-sensitivity read',
        max: 14,
        options: { fast_decision: 14, average_negotiation: 9, high_sensitivity: 0 },
        optionOrder: ['fast_decision', 'average_negotiation', 'high_sensitivity'],
        optionLabels: {
          fast_decision: 'Fast decision, reasonable on specs & pricing, no excessive comparison',
          average_negotiation: 'Average homeowner with normal negotiation & minor detail adjustment',
          high_sensitivity: 'Retired owner with strict fine-detail control, multiple competitor quotes & continuous price haggle',
        },
      },
      '6': {
        label: 'Decision-makers',
        max: 9,
        options: { sole_decision_maker: 9, small_group: 6, multilayer_board: 0 },
        optionOrder: ['sole_decision_maker', 'small_group', 'multilayer_board'],
        optionLabels: {
          sole_decision_maker: 'Single sole decision-maker',
          small_group: '2â€“3 people small group approval, final call within 1â€“2 weeks',
          multilayer_board: 'Multi-layer board/division sign-off, decision over 1 month',
        },
      },
      '7': {
        label: 'Distance',
        max: 6,
        options: { within_30km: 6, '30km_to_80km': 4, over_80km: 2 },
        optionOrder: ['within_30km', '30km_to_80km', 'over_80km'],
      },
      '8': {
        label: 'Resource Consent',
        max: 7,
        options: { not_required: 7, approved: 7, under_review: 4, not_applied: 1 },
        optionOrder: ['not_required', 'approved', 'under_review', 'not_applied'],
        optionLabels: {
          not_required: 'Not required / N/A',
          approved: 'Approved / granted',
          under_review: 'Applied – under review',
          not_applied: 'Not yet applied',
        },
      },
      '9': {
        label: 'Building Consent',
        max: 6,
        options: { not_required: 6, approved: 6, under_review: 4, not_applied: 1 },
        optionOrder: ['not_required', 'approved', 'under_review', 'not_applied'],
        optionLabels: {
          not_required: 'Not required / N/A',
          approved: 'Approved / granted',
          under_review: 'Applied – under review',
          not_applied: 'Not yet applied',
        },
      },
      '10': {
        label: 'Building Stage',
        max: 6,
        options: { planning: 1, foundation_framing: 3, enclosed: 5, fitout_complete: 6 },
        optionOrder: ['planning', 'foundation_framing', 'enclosed', 'fitout_complete'],
        optionLabels: {
          planning: 'Planning / design only',
          foundation_framing: 'Foundation / framing',
          enclosed: 'Enclosed / lock-up',
          fitout_complete: 'Fit-out / finishing / completed',
        },
      },
    },
    bonuses: {},
    penalties: {},
    tiers: { A: 65, B: 42, C: 20 },
    strikes: {
      weights: {
        complex_install: 1.0,
        high_sensitivity: 1.0,
        multilayer_board: 1.0,
      },
      softDemoteAt: 1.0,
      capAt: 2.0,
      capCeiling: 'C',
    },
  }
}

async function seedScoringConfigV4() {
  const { db } = await import('../lib/db')
  const { scoringConfigVersions } = await import('../drizzle/schema-leads')
  const { eq } = await import('drizzle-orm')
  const scoringConfig = buildScoringConfigV4()

  await db
    .update(scoringConfigVersions)
    .set({ isActive: false })
    .where(eq(scoringConfigVersions.isActive, true))

  await db
    .insert(scoringConfigVersions)
    .values({ versionLabel: 'v4-2026-06-18', isActive: true, config: scoringConfig })
    .onConflictDoUpdate({
      target: scoringConfigVersions.versionLabel,
      set: { isActive: true, config: scoringConfig },
    })

  console.log('Seeded scoring config v4 successfully')
  process.exit(0)
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  seedScoringConfigV4().catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
}
