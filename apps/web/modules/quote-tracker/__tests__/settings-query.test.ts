import { describe, expect, it } from 'vitest'
import {
  EXPIRY_SETTING_DEFAULTS,
  NOTIFICATION_SETTING_DEFAULTS,
  TRACKING_SETTING_DEFAULTS,
  normalizeExpirySettings,
  normalizeNotificationSettings,
  normalizeTrackingSettings,
  trackingSettingKeys,
} from '../settings-query'

describe('quote tracker settings', () => {
  it('returns defaults when no rows exist', () => {
    const settings = normalizeTrackingSettings([])

    expect(settings).toEqual(TRACKING_SETTING_DEFAULTS)
  })

  it('parses persisted false values and ignores unknown keys', () => {
    const settings = normalizeTrackingSettings([
      { key: 'track.geo', value: 'false' },
      { key: 'viewer.accept', value: 'true' },
      { key: 'unrelated.setting', value: 'false' },
    ])

    expect(settings['track.geo']).toBe(false)
    expect(settings['viewer.accept']).toBe(true)
    expect(settings['track.ip']).toBe(true)
    expect(Object.keys(settings)).toEqual(trackingSettingKeys)
  })
})

describe('quote notification settings', () => {
  it('returns notification defaults when no rows exist', () => {
    expect(normalizeNotificationSettings([])).toEqual(NOTIFICATION_SETTING_DEFAULTS)
  })

  it('parses enabled flag and notification recipient list', () => {
    const settings = normalizeNotificationSettings([
      { key: 'notifications.enabled', value: 'false' },
      { key: 'notifications.to', value: ' support@royalglass.co.nz, sales@royalglass.co.nz; bad-email ' },
    ])

    expect(settings.enabled).toBe(false)
    expect(settings.to).toEqual(['support@royalglass.co.nz', 'sales@royalglass.co.nz'])
  })
})

describe('quote expiry settings', () => {
  it('returns expiry defaults when no rows exist', () => {
    expect(normalizeExpirySettings([])).toEqual(EXPIRY_SETTING_DEFAULTS)
  })

  it('passes through valid presets and falls back to 30d for invalid values', () => {
    expect(normalizeExpirySettings([{ key: 'expiry.default', value: '7d' }]).defaultPreset).toBe('7d')
    expect(normalizeExpirySettings([{ key: 'expiry.default', value: 'forever' }]).defaultPreset).toBe('30d')
  })
})
