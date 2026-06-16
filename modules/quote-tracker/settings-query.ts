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

export const trackingSettingKeys = Object.keys(TRACKING_SETTING_DEFAULTS) as TrackingSettingKey[]
export const trackSettingKeys = trackingSettingKeys.filter((key) => key.startsWith('track.'))
export const viewerSettingKeys = trackingSettingKeys.filter((key) => key.startsWith('viewer.'))

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

export async function getTrackingSettings(): Promise<TrackingSettings> {
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(inArray(settings.key, trackingSettingKeys))

  return normalizeTrackingSettings(rows)
}

export async function getTrackingSetting(key: TrackingSettingKey): Promise<boolean> {
  const [row] = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1)

  return row ? row.value !== 'false' : TRACKING_SETTING_DEFAULTS[key]
}
