'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLog, settings } from '@/drizzle/schema'
import {
  NOTIFICATION_SETTING_DEFAULTS,
  TRACKING_SETTING_DEFAULTS,
  allSettingsKeys,
  normalizeExpirySettings,
  parseNotificationRecipients,
  trackingSettingKeys,
  type TrackingSettingKey,
} from './settings-query'

export async function saveTrackingSettings(formData: FormData): Promise<void> {
  const session = await auth()
  if (session?.user?.role !== 'admin' || !session.user.id) {
    throw new Error('Forbidden')
  }

  const values = trackingSettingKeys.map((key) => ({
    key,
    value: formData.get(key) === 'on' ? 'true' : 'false',
    updatedBy: session.user.id as string,
  }))
  const notificationRecipients = parseNotificationRecipients(formData.get('notifications.to')?.toString() ?? '')
  const notificationValues = [
    {
      key: 'notifications.enabled',
      value: formData.get('notifications.enabled') === 'on' ? 'true' : 'false',
      updatedBy: session.user.id as string,
    },
    {
      key: 'notifications.to',
      value: (notificationRecipients.length > 0 ? notificationRecipients : [...NOTIFICATION_SETTING_DEFAULTS.to]).join(','),
      updatedBy: session.user.id as string,
    },
  ]
  const expirySettings = normalizeExpirySettings([
    { key: 'expiry.default', value: formData.get('expiry.default')?.toString() ?? '' },
  ])
  const expiryValues = [
    {
      key: 'expiry.default',
      value: expirySettings.defaultPreset,
      updatedBy: session.user.id as string,
    },
  ]
  const allValues = [...values, ...notificationValues, ...expiryValues]

  await db.transaction(async (tx) => {
    for (const value of allValues) {
      await tx
        .insert(settings)
        .values(value)
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: value.value,
            updatedBy: session.user.id as string,
            updatedAt: new Date(),
          },
        })
    }

    await tx.insert(auditLog).values({
      actorId: session.user.id as string,
      action: 'quote_tracking_settings.updated',
      detail: {
        tracking: values.reduce<Record<TrackingSettingKey, boolean>>(
        (detail, value) => {
          detail[value.key] = value.value === 'true'
          return detail
        },
        { ...TRACKING_SETTING_DEFAULTS },
        ),
        notifications: {
          enabled: notificationValues[0].value === 'true',
          to: notificationValues[1].value,
        },
        expiry: {
          defaultPreset: expirySettings.defaultPreset,
        },
        keys: allSettingsKeys,
      },
    })
  })

  revalidatePath('/admin/tracking')
}
