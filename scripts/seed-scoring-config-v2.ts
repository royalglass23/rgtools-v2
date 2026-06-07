import { config } from 'dotenv'
config({ path: '.env.local' })

async function seedScoringConfigV2() {
  const { db } = await import('../lib/db')
  const { scoringConfigVersions } = await import('../drizzle/schema-leads')
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
      },
      '2': {
        label: 'Budget band',
        max: 19,
        options: {
          '50k_plus': 19,
          '10k_to_50k': 14,
          '2k_to_10k': 8,
          under_2k: 3,
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
      },
      '4': {
        label: 'Complexity',
        max: 14,
        options: {
          standard_non_custom: 14,
          minor_custom: 9,
          complex_install: 4,
        },
      },
      '5': {
        label: 'Price-sensitivity read',
        max: 14,
        options: {
          fast_decision: 14,
          average_negotiation: 9,
          high_sensitivity: 3,
        },
      },
      '6': {
        label: 'Decision-makers',
        max: 9,
        options: {
          sole_decision_maker: 9,
          small_group: 6,
          multilayer_board: 2,
        },
      },
      '7': {
        label: 'Distance',
        max: 6,
        options: {
          within_30km: 6,
          '30km_to_80km': 4,
          over_80km: 2,
        },
      },
    },
    bonuses: {},
    penalties: {},
    tiers: { A: 65, B: 42, C: 20 },
  }

  await db.insert(scoringConfigVersions).values({
    versionLabel: 'v2-2026-06-08',
    isActive: true,
    config: scoringConfig,
  })

  console.log('Seeded scoring config v2 successfully')
  process.exit(0)
}

seedScoringConfigV2().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
