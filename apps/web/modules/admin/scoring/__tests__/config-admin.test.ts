import { describe, expect, it } from 'vitest'
import type { ScoringConfig } from '@/modules/lead-intake/scoring/score-lead'
import {
  buildRemovedOptionWarnings,
  nextScoringVersionLabel,
  validateScoringConfigDraft,
} from '../config-admin'

const baseConfig: ScoringConfig = {
  categories: {
    '1': {
      label: 'Client type',
      max: 20,
      options: {
        builder: 20,
        homeowner: 10,
      },
      optionLabels: {
        builder: 'Builder',
        homeowner: 'Homeowner',
      },
      optionOrder: ['builder', 'homeowner'],
    },
    '2': {
      label: 'Budget',
      max: 20,
      options: {
        large: 20,
        small: 5,
      },
    },
  },
  bonuses: {
    repeat_client: 5,
  },
  penalties: {
    distant: -4,
  },
  tiers: {
    A: 65,
    B: 42,
    C: 20,
  },
  strikes: {
    weights: {
      homeowner: 1,
    },
    softDemoteAt: 1,
    capAt: 2,
    capCeiling: 'C',
  },
}

describe('validateScoringConfigDraft', () => {
  it('accepts a complete scoring config', () => {
    expect(validateScoringConfigDraft(baseConfig)).toEqual([])
  })

  it('rejects strike keys that do not exist in any category option', () => {
    const config: ScoringConfig = {
      ...baseConfig,
      strikes: {
        ...baseConfig.strikes!,
        weights: {
          missing_key: 1,
        },
      },
    }

    expect(validateScoringConfigDraft(config)).toContain(
      'Strike option "missing_key" does not exist in any category option.',
    )
  })

  it('rejects tier thresholds that are not descending from A to C', () => {
    const config: ScoringConfig = {
      ...baseConfig,
      tiers: {
        A: 42,
        B: 65,
        C: 20,
      },
    }

    expect(validateScoringConfigDraft(config)).toContain(
      'Tier thresholds must descend from A to C.',
    )
  })

  it('rejects option order that omits or adds option keys', () => {
    const config: ScoringConfig = {
      ...baseConfig,
      categories: {
        ...baseConfig.categories,
        '1': {
          ...baseConfig.categories['1'],
          optionOrder: ['builder'],
        },
      },
    }

    expect(validateScoringConfigDraft(config)).toContain(
      'Category 1 option order must contain exactly its option keys.',
    )
  })

  it('rejects negative or non-integer option points', () => {
    const config: ScoringConfig = {
      ...baseConfig,
      categories: {
        ...baseConfig.categories,
        '1': {
          ...baseConfig.categories['1'],
          options: {
            builder: 10.5,
            homeowner: -1,
          },
        },
      },
    }

    expect(validateScoringConfigDraft(config)).toEqual(
      expect.arrayContaining([
        'Option "builder" points must be an integer zero or greater.',
        'Option "homeowner" points must be an integer zero or greater.',
      ]),
    )
  })

  it('rejects category max below its highest option points', () => {
    const config: ScoringConfig = {
      ...baseConfig,
      categories: {
        ...baseConfig.categories,
        '1': {
          ...baseConfig.categories['1'],
          max: 10,
        },
      },
    }

    expect(validateScoringConfigDraft(config)).toContain(
      'Category 1 max points must be at least its highest option points.',
    )
  })

  it('rejects category max above 100', () => {
    const config: ScoringConfig = {
      ...baseConfig,
      categories: {
        ...baseConfig.categories,
        '1': {
          ...baseConfig.categories['1'],
          max: 101,
        },
      },
    }

    expect(validateScoringConfigDraft(config)).toContain(
      'Category 1 max points must be between 0 and 100.',
    )
  })
})

describe('buildRemovedOptionWarnings', () => {
  it('warns when an option key used by historical lead scores is removed', () => {
    const nextConfig: ScoringConfig = {
      ...baseConfig,
      categories: {
        ...baseConfig.categories,
        '1': {
          ...baseConfig.categories['1'],
          options: {
            builder: 20,
          },
          optionOrder: ['builder'],
        },
      },
    }

    expect(buildRemovedOptionWarnings(baseConfig, nextConfig, new Set(['homeowner']))).toEqual([
      'Option key "homeowner" is used by existing leads. Removing or renaming it can break historical category score display.',
    ])
  })
})

describe('nextScoringVersionLabel', () => {
  it('bumps the version number and avoids existing labels for the same date', () => {
    expect(
      nextScoringVersionLabel('v3-2026-06-08', new Date('2026-06-11T01:00:00Z'), [
        'v4-2026-06-11',
      ]),
    ).toBe('v4-2026-06-11-2')
  })
})
