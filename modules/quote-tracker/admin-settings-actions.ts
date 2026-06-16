'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLog, settings } from '@/drizzle/schema'
import {
  TRACKING_SETTING_DEFAULTS,
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

  await db.transaction(async (tx) => {
    for (const value of values) {
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
      detail: values.reduce<Record<TrackingSettingKey, boolean>>(
        (detail, value) => {
          detail[value.key] = value.value === 'true'
          return detail
        },
        { ...TRACKING_SETTING_DEFAULTS },
      ),
    })
  })

  revalidatePath('/admin/tracking')
}
