import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { settings } from '@/drizzle/schema'

export const TRACKING_SETTING_DEFAULTS = {
  'track.ip': true,
  'track.geo': true,
  'track.page_completion': true,
  'track.return_visits': true,
  'track.distinct_viewers': true,
  'track.download_print': true,
  'track.active_time': true,
  'track.time_to_open': true,
  'track.cta_clicks': true,
  'viewer.download': true,
  'viewer.print': true,
  'viewer.accept': false,
  'viewer.contact_us': false,
} as const

export type TrackingSettingKey = keyof typeof TRACKING_SETTING_DEFAULTS
export type TrackingSettings = Record<TrackingSettingKey, boolean>

export const NOTIFICATION_SETTING_DEFAULTS = {
  enabled: true,
  to: ['support@royalglass.co.nz'],
} as const

export const notificationSettingKeys = ['notifications.enabled', 'notifications.to'] as const
export type NotificationSettingKey = typeof notificationSettingKeys[number]
export type NotificationSettings = {
  enabled: boolean
  to: string[]
}

export const trackingSettingKeys = Object.keys(TRACKING_SETTING_DEFAULTS) as TrackingSettingKey[]
export const trackSettingKeys = trackingSettingKeys.filter((key) => key.startsWith('track.'))
export const viewerSettingKeys = trackingSettingKeys.filter((key) => key.startsWith('viewer.'))
export const allSettingsKeys = [...trackingSettingKeys, ...notificationSettingKeys]

export type TrackingSettingRow = {
  key: string
  value: string
}

export function isTrackingSettingKey(key: string): key is TrackingSettingKey {
  return Object.prototype.hasOwnProperty.call(TRACKING_SETTING_DEFAULTS, key)
}

export function normalizeTrackingSettings(rows: TrackingSettingRow[]): TrackingSettings {
  const normalized: TrackingSettings = { ...TRACKING_SETTING_DEFAULTS }

  for (const row of rows) {
    if (isTrackingSettingKey(row.key)) {
      normalized[row.key] = row.value !== 'false'
    }
  }

  return normalized
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseNotificationRecipients(value: string): string[] {
  const recipients = new Set<string>()

  for (const part of value.split(/[;,\n]/)) {
    const email = part.trim().toLowerCase()
    if (EMAIL_RE.test(email)) recipients.add(email)
  }

  return Array.from(recipients)
}

export function normalizeNotificationSettings(rows: TrackingSettingRow[]): NotificationSettings {
  const normalized: NotificationSettings = {
    enabled: NOTIFICATION_SETTING_DEFAULTS.enabled,
    to: [...NOTIFICATION_SETTING_DEFAULTS.to],
  }

  for (const row of rows) {
    if (row.key === 'notifications.enabled') normalized.enabled = row.value !== 'false'
    if (row.key === 'notifications.to') {
      const recipients = parseNotificationRecipients(row.value)
      normalized.to = recipients.length > 0 ? recipients : [...NOTIFICATION_SETTING_DEFAULTS.to]
    }
  }

  return normalized
}

export async function getTrackingSettings(): Promise<TrackingSettings> {
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(inArray(settings.key, trackingSettingKeys))

  return normalizeTrackingSettings(rows)
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(inArray(settings.key, notificationSettingKeys))

  return normalizeNotificationSettings(rows)
}

export async function getTrackingSetting(key: TrackingSettingKey): Promise<boolean> {
  const [row] = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1)

  return row ? row.value !== 'false' : TRACKING_SETTING_DEFAULTS[key]
}
