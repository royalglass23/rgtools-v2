import { describe, expect, it } from 'vitest'
import { scoringConfigToOptionLists, type ActiveScoringConfigRow } from '../config-options'

describe('scoringConfigToOptionLists', () => {
  it('builds form option lists from config category option keys', () => {
    const row: ActiveScoringConfigRow = {
      id: 'config-id',
      config: {
        categories: {
          '1': {
            label: 'Customer profile',
            max: 20,
            options: {
              changed_by_config: 11,
              another_live_value: 7,
            },
          },
          '2': {
            label: 'Project value',
            max: 20,
            options: {
              custom_budget_band: 5,
            },
          },
        },
        bonuses: {},
        penalties: {},
        tiers: {
          A: 75,
          B: 55,
          C: 30,
        },
      },
    }

    expect(scoringConfigToOptionLists(row)).toEqual({
      configVersionId: 'config-id',
      config: row.config,
      categories: {
        '1': {
          label: 'Customer profile',
          options: [
            { key: 'changed_by_config', label: 'changed by config' },
            { key: 'another_live_value', label: 'another live value' },
          ],
        },
        '2': {
          label: 'Project value',
          options: [
            { key: 'custom_budget_band', label: 'custom budget band' },
          ],
        },
      },
    })
  })
})
