import { config } from 'dotenv'
config({ path: '.env.local' })

async function seedTrackingSettings() {
  const { db } = await import('../lib/db')
  const { settings } = await import('@rgtools/db/schema')
  const {
    NOTIFICATION_SETTING_DEFAULTS,
    TRACKING_SETTING_DEFAULTS,
    notificationSettingKeys,
    trackingSettingKeys,
  } = await import('../modules/quote-tracker/settings-query')

  for (const key of trackingSettingKeys) {
    await db
      .insert(settings)
      .values({ key, value: String(TRACKING_SETTING_DEFAULTS[key]) })
      .onConflictDoNothing()
  }

  const notificationDefaults = {
    'notifications.enabled': String(NOTIFICATION_SETTING_DEFAULTS.enabled),
    'notifications.to': NOTIFICATION_SETTING_DEFAULTS.to.join(','),
  }

  for (const key of notificationSettingKeys) {
    await db
      .insert(settings)
      .values({ key, value: notificationDefaults[key] })
      .onConflictDoNothing()
  }

  console.log(`Seeded ${trackingSettingKeys.length + notificationSettingKeys.length} quote tracking settings`)
  process.exit(0)
}

seedTrackingSettings().catch((error) => {
  console.error('Seed tracking settings failed:', error)
  process.exit(1)
})
