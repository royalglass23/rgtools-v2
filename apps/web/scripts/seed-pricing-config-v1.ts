import { config } from 'dotenv'
config({ path: '.env.local' })

// Replace this placeholder with the current LIVE values from:
// WP Admin -> RG Calculator -> Pricing.
// Do not run this seed until those live values have been pasted and reviewed.
const LIVE_VALUES_PLACEHOLDER = {
  scenarios: {
    ground_level: { ratePerMetre: 280, gatePrice: null },
    balcony_balustrade: { ratePerMetre: 320, gatePrice: null },
    premium_pool_fence: { ratePerMetre: 380, gatePrice: 680 },
    stair_balustrade: { ratePerMetre: 330, gatePrice: null },
  },
  minimumLength: 5,
  cornerSurcharge: 85,
  hardwareFinishSurcharge: {
    standard_chrome: 0,
    matte_black: 15,
    brushed_chrome: 12,
    powder_coated: 22,
    not_sure: 0,
  },
  fixingMethodSurcharge: {
    spigot_round: 0,
    standoff_posts: 0,
    viking: 0,
    jh_clamps: 0,
    side_channel: 0,
    top_channel: 0,
    aluminium_1: 0,
    aluminium_2: 0,
    sed: 0,
    not_sure: 0,
  },
  glassTypeSurcharge: {
    toughened_12mm: 0,
    laminated: 0,
  },
  glassColourSurcharge: {
    clear: 0,
    low_iron: 0,
    tinted: 0,
    frosted: 0,
  },
  interlikingRailsSurcharge: 0,
  rangeLowPercent: 90,
  rangeHighPercent: 120,
}

async function seedPricingConfigV1() {
  const { db } = await import('../lib/db')
  const { pricingConfigVersions } = await import('@rgtools/db/schema-leads')
  const { validatePricingConfigDraft } = await import('../modules/admin/pricing/config-admin')
  const { eq } = await import('drizzle-orm')

  const errors = validatePricingConfigDraft(LIVE_VALUES_PLACEHOLDER)
  if (errors.length > 0) {
    throw new Error(`Pricing seed is invalid: ${errors.join(' ')}`)
  }

  await db.transaction(async (tx) => {
    await tx
      .update(pricingConfigVersions)
      .set({ isActive: false })
      .where(eq(pricingConfigVersions.isActive, true))

    await tx
      .insert(pricingConfigVersions)
      .values({
        versionLabel: 'v1-live-wp-import',
        isActive: true,
        config: LIVE_VALUES_PLACEHOLDER,
      })
      .onConflictDoUpdate({
        target: pricingConfigVersions.versionLabel,
        set: {
          isActive: true,
          config: LIVE_VALUES_PLACEHOLDER,
        },
      })
  })

  console.log('Seeded pricing config v1 successfully')
  process.exit(0)
}

seedPricingConfigV1().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
