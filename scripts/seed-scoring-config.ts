import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local' })

const scoringConfigV1 = {
  categories: {
    '1': {
      label: 'Customer profile',
      max: 20,
      options: {
        repeat_builder: 19,
        existing_business: 15,
        new_builder: 13,
        owner_occupier: 9,
        investor: 4,
      },
    },
    '2': {
      label: 'Project value',
      max: 20,
      options: {
        ge_50k: 19,
        '10k_50k': 14,
        '2k_10k': 8,
        lt_2k: 3,
      },
    },
    '3': {
      label: 'Consent progress',
      max: 20,
      options: {
        approved: 19,
        under_review: 13,
        early_design: 7,
        enquiry_only: 2,
      },
    },
    '4': {
      label: 'Distance/complexity',
      max: 15,
      options: {
        near_standard: 14,
        mid_minor_custom: 9,
        remote_specialised: 4,
      },
    },
    '5': {
      label: 'Price sensitivity',
      max: 15,
      options: {
        fast_reasonable: 14,
        average: 9,
        heavy_shopper: 3,
      },
    },
    '6': {
      label: 'Decision complexity',
      max: 10,
      options: {
        single: 9,
        small_group: 6,
        multi_level: 2,
      },
    },
  },
  bonuses: {
    package: 3,
    price_match: 2,
    referral: 3,
  },
  penalties: {
    no_intent: -3,
    sub_viable: -2,
  },
  tiers: {
    A: 75,
    B: 55,
    C: 30,
  },
}

async function seedScoringConfig() {
  const { db } = await import('../lib/db')
  const { scoringConfigVersions } = await import('../drizzle/schema-leads')
  const { eq } = await import('drizzle-orm')

  const existingV1 = await db
    .select({
      id: scoringConfigVersions.id,
      isActive: scoringConfigVersions.isActive,
    })
    .from(scoringConfigVersions)
    .where(eq(scoringConfigVersions.versionLabel, 'v1'))

  if (existingV1.length > 0) {
    console.log(`Scoring config v1 already exists: ${existingV1[0].id}`)
    console.log(`is_active=${existingV1[0].isActive}`)
    return
  }

  const inserted = await db
    .insert(scoringConfigVersions)
    .values({
      versionLabel: 'v1',
      isActive: true,
      config: scoringConfigV1,
    })
    .returning({
      id: scoringConfigVersions.id,
      versionLabel: scoringConfigVersions.versionLabel,
      isActive: scoringConfigVersions.isActive,
    })

  console.log(`Inserted scoring config: ${JSON.stringify(inserted[0])}`)
}

seedScoringConfig()
  .then(() => {
    console.log('Scoring config seed completed successfully')
    process.exit(0)
  })
  .catch((err) => {
    if (err?.code === '23505') {
      console.log('Scoring config seed skipped: an active config already exists')
      process.exit(0)
    }

    console.error('Scoring config seed failed:', err)
    process.exit(1)
  })
