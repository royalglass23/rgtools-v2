import { config } from 'dotenv'
config({ path: '.env.local' })

async function seedScoringConfigV3() {
  const { db } = await import('../lib/db')
  const { scoringConfigVersions } = await import('@rgtools/db/schema-leads')
  const { eq } = await import('drizzle-orm')

  await db
    .update(scoringConfigVersions)
    .set({ isActive: false })
    .where(eq(scoringConfigVersions.isActive, true))

  const scoringConfig = {
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
          '10k_to_50k': '$10,000 – $50,000',
          '2k_to_10k': '$2,000 – $10,000',
          under_2k: 'Less than $2,000',
        },
      },
      '3': {
        label: 'Consent status',
        max: 19,
        options: {
          both_consents_approved: 19,
          consent_under_review: 13,
          early_design_only: 7,
          preliminary_only: 2,
        },
        optionOrder: ['both_consents_approved', 'consent_under_review', 'early_design_only', 'preliminary_only'],
        optionLabels: {
          both_consents_approved: 'Both consents approved, construction finishing, install within 1–3 months',
          consent_under_review: 'Consent under review, mid-stage build, install in 3–8 months',
          early_design_only: 'Land purchase / early design only, consent not submitted, install >8 months later',
          preliminary_only: 'No land / no drawing, purely preliminary price checking',
        },
      },
      '4': {
        label: 'Complexity',
        max: 14,
        // complex_install = 0: blocker low — earns no points AND triggers strike
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
        // high_sensitivity = 0: blocker low — earns no points AND triggers strike
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
        // multilayer_board = 0: blocker low — earns no points AND triggers strike
        options: { sole_decision_maker: 9, small_group: 6, multilayer_board: 0 },
        optionOrder: ['sole_decision_maker', 'small_group', 'multilayer_board'],
        optionLabels: {
          sole_decision_maker: 'Single sole decision-maker',
          small_group: '2–3 people small group approval, final call within 1–2 weeks',
          multilayer_board: 'Multi-layer board/division sign-off, decision over 1 month',
        },
      },
      '7': {
        label: 'Distance',
        max: 6,
        options: { within_30km: 6, '30km_to_80km': 4, over_80km: 2 },
        optionOrder: ['within_30km', '30km_to_80km', 'over_80km'],
      },
    },
    bonuses: {},
    penalties: {},
    tiers: { A: 65, B: 42, C: 20 },
    // Strike layer: selecting any blocker low option pulls the tier down
    // 1 strike  → soft-demote one step (A→B, B→C, C→D)
    // 2+ strikes → tier capped at C (D stays D — cap never improves a tier)
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

  await db
    .insert(scoringConfigVersions)
    .values({ versionLabel: 'v3-2026-06-08', isActive: true, config: scoringConfig })
    .onConflictDoUpdate({
      target: scoringConfigVersions.versionLabel,
      set: { isActive: true, config: scoringConfig },
    })

  console.log('Seeded scoring config v3 successfully')
  process.exit(0)
}

seedScoringConfigV3().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
