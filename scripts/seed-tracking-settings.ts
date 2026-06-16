import { config } from 'dotenv'
config({ path: '.env.local' })

async function seedTrackingSettings() {
  const { db } = await import('../lib/db')
  const { settings } = await import('../drizzle/schema')
  const { TRACKING_SETTING_DEFAULTS, trackingSettingKeys } = await import('../modules/quote-tracker/settings-query')

  for (const key of trackingSettingKeys) {
    await db
      .insert(settings)
      .values({ key, value: String(TRACKING_SETTING_DEFAULTS[key]) })
      .onConflictDoNothing()
  }

  console.log(`Seeded ${trackingSettingKeys.length} quote tracking settings`)
  process.exit(0)
}

seedTrackingSettings().catch((error) => {
  console.error('Seed tracking settings failed:', error)
  process.exit(1)
})
