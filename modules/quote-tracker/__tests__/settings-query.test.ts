import { describe, expect, it } from 'vitest'
import {
  TRACKING_SETTING_DEFAULTS,
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
