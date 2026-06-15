import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRICING_CONFIG,
  nextPricingVersionLabel,
  validatePricingConfigDraft,
  type PricingConfig,
} from '../config-admin'

describe('validatePricingConfigDraft', () => {
  it('accepts the canonical calculator pricing shape', () => {
    expect(validatePricingConfigDraft(DEFAULT_PRICING_CONFIG)).toEqual([])
  })

  it('requires every scenario key consumed by the calculator', () => {
    const config: PricingConfig = {
      ...DEFAULT_PRICING_CONFIG,
      scenarios: {
        ...DEFAULT_PRICING_CONFIG.scenarios,
        stair_balustrade: undefined as never,
      },
    }
    delete config.scenarios.stair_balustrade

    expect(validatePricingConfigDraft(config)).toContain(
      'Missing scenario pricing for stair_balustrade.',
    )
  })

  it('allows negative fixing-method surcharges but rejects negative values elsewhere', () => {
    const config: PricingConfig = {
      ...DEFAULT_PRICING_CONFIG,
      fixingMethodSurcharge: {
        ...DEFAULT_PRICING_CONFIG.fixingMethodSurcharge,
        side_channel: -25,
      },
      cornerSurcharge: -1,
    }

    expect(validatePricingConfigDraft(config)).toEqual([
      'cornerSurcharge must be a finite number zero or greater.',
    ])
  })

  it('rejects inverted estimate range percentages', () => {
    const config: PricingConfig = {
      ...DEFAULT_PRICING_CONFIG,
      rangeLowPercent: 125,
      rangeHighPercent: 110,
    }

    expect(validatePricingConfigDraft(config)).toContain(
      'rangeLowPercent must be less than or equal to rangeHighPercent.',
    )
  })
})

describe('nextPricingVersionLabel', () => {
  it('bumps the version number and avoids existing labels for the same date', () => {
    expect(
      nextPricingVersionLabel('v1-2026-06-10', new Date('2026-06-15T00:00:00Z'), [
        'v2-2026-06-15',
      ]),
    ).toBe('v2-2026-06-15-2')
  })
})
