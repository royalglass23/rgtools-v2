import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MENU_AVAILABILITY,
  normalizeMenuAvailability,
  parseMenuAvailabilitySetting,
  roleCanSeeMenu,
  serializeMenuAvailability,
} from '../menu-availability'

describe('menu availability', () => {
  it('defaults to production-safe menu visibility', () => {
    expect(parseMenuAvailabilitySetting(null)).toEqual(DEFAULT_MENU_AVAILABILITY)
  })

  it('normalizes partial settings with safe defaults', () => {
    expect(normalizeMenuAvailability({ staff: { clients: true } }).staff).toEqual({
      ...DEFAULT_MENU_AVAILABILITY.staff,
      clients: true,
    })
  })

  it('uses parent menu availability for submenu slugs', () => {
    const availability = parseMenuAvailabilitySetting(serializeMenuAvailability({
      ...DEFAULT_MENU_AVAILABILITY,
      staff: {
        ...DEFAULT_MENU_AVAILABILITY.staff,
        'ps-generator': false,
      },
    }))

    expect(roleCanSeeMenu('staff', 'ps-generator', availability)).toBe(false)
    expect(roleCanSeeMenu('staff', 'ps-generator/history', availability)).toBe(false)
    expect(roleCanSeeMenu('staff', 'ps-generator/configuration', availability)).toBe(false)
  })

  it('allows unknown slugs unless another guard blocks them', () => {
    expect(roleCanSeeMenu('staff', 'future-module', DEFAULT_MENU_AVAILABILITY)).toBe(true)
  })
})
