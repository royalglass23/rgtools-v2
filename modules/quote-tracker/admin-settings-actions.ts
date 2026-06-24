'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { settings, users } from '@/drizzle/schema'
import { logAudit } from '@/lib/audit-db'
import { logError } from '@/lib/logger'
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
    redirect('/login')
  }

  const actor = await db.query.users.findFirst({
    where: eq(users.id, session.user.id as string),
  })

  if (!actor) {
    redirect('/login?expired=1')
  }

  const values = trackingSettingKeys.map((key) => ({
    key,
    value: formData.get(key) === 'on' ? 'true' : 'false',
    updatedBy: actor.id,
  }))
  const notificationRecipients = parseNotificationRecipients(formData.get('notifications.to')?.toString() ?? '')
  const notificationValues = [
    {
      key: 'notifications.enabled',
      value: formData.get('notifications.enabled') === 'on' ? 'true' : 'false',
      updatedBy: actor.id,
    },
    {
      key: 'notifications.to',
      value: (notificationRecipients.length > 0 ? notificationRecipients : [...NOTIFICATION_SETTING_DEFAULTS.to]).join(','),
      updatedBy: actor.id,
    },
  ]
  const expirySettings = normalizeExpirySettings([
    { key: 'expiry.default', value: formData.get('expiry.default')?.toString() ?? '' },
  ])
  const expiryValues = [
    {
      key: 'expiry.default',
      value: expirySettings.defaultPreset,
      updatedBy: actor.id,
    },
  ]
  const allValues = [...values, ...notificationValues, ...expiryValues]

  try {
    await db.transaction(async (tx) => {
      for (const value of allValues) {
        await tx
          .insert(settings)
          .values(value)
          .onConflictDoUpdate({
            target: settings.key,
            set: {
              value: value.value,
              updatedBy: actor.id,
              updatedAt: new Date(),
            },
          })
      }

      await logAudit({
        actorId: actor.id,
        entityType: 'quote',
        action: 'quote.settings_updated',
        before: null,
        after: {
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
      }, tx)
    })
  } catch (error) {
    const errorId = await logError('quote-tracker.saveTrackingSettings', error, {
      userId: actor.id,
      metadata: { keys: allSettingsKeys },
    })
    redirect(`/admin/tracking?error=${errorId}`)
  }

  revalidatePath('/admin/tracking')
  redirect('/admin/tracking?saved=1')
}
