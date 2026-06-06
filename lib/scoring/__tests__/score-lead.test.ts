import { describe, expect, it } from 'vitest'
import { scoreLead, type LeadAnswers, type ScoringConfig } from '../score-lead'

const baseConfig: ScoringConfig = {
  categories: {
    '1': {
      label: 'Customer profile',
      max: 20,
      options: {
        repeat_builder: 19,
        existing_business: 15,
        new_builder: 13,
        owner_occupier: 9,
        investor: 4,
      },
    },
    '2': {
      label: 'Project value',
      max: 20,
      options: {
        ge_50k: 19,
        '10k_50k': 14,
        '2k_10k': 8,
        lt_2k: 3,
      },
    },
    '3': {
      label: 'Consent progress',
      max: 20,
      options: {
        approved: 19,
        under_review: 13,
        early_design: 7,
        enquiry_only: 2,
      },
    },
    '4': {
      label: 'Distance/complexity',
      max: 15,
      options: {
        near_standard: 14,
        mid_minor_custom: 9,
        remote_specialised: 4,
      },
    },
    '5': {
      label: 'Price sensitivity',
      max: 15,
      options: {
        fast_reasonable: 14,
        average: 9,
        heavy_shopper: 3,
      },
    },
    '6': {
      label: 'Decision complexity',
      max: 10,
      options: {
        single: 9,
        small_group: 6,
        multi_level: 2,
      },
    },
  },
  bonuses: {
    package: 3,
    price_match: 2,
    referral: 3,
  },
  penalties: {
    no_intent: -3,
    sub_viable: -2,
  },
  tiers: {
    A: 75,
    B: 55,
    C: 30,
  },
}

function boundaryConfig(thresholds = baseConfig.tiers): ScoringConfig {
  return {
    categories: {
      '1': {
        label: 'Boundary category',
        max: 100,
        options: {
          exact_a: 75,
          below_a: 74,
          exact_b: 55,
          below_b: 54,
          exact_c: 30,
          below_c: 29,
        },
      },
      '2': { label: 'Unused 2', max: 0, options: {} },
      '3': { label: 'Unused 3', max: 0, options: {} },
      '4': { label: 'Unused 4', max: 0, options: {} },
      '5': { label: 'Unused 5', max: 0, options: {} },
      '6': { label: 'Unused 6', max: 0, options: {} },
    },
    bonuses: {},
    penalties: {},
    tiers: thresholds,
  }
}

describe('scoreLead', () => {
  it('scores a full set of answers with exact score, tier, reason, and rows', () => {
    const result = scoreLead({
      cat1: 'repeat_builder',
      cat2: 'ge_50k',
      cat3: 'approved',
      cat4: 'near_standard',
      cat5: 'fast_reasonable',
      cat6: 'single',
    }, baseConfig)

    expect(result.score).toBe(94)
    expect(result.tier).toBe('A')
    expect(result.reason).toBe(
      'Tier A (94): Customer profile: repeat builder, Project value: ge 50k, Consent progress: approved, Distance/complexity: near standard, Price sensitivity: fast reasonable, Decision complexity: single',
    )
    expect(result.categoryRows).toEqual([
      { category: 1, answerKey: 'repeat_builder', points: 19 },
      { category: 2, answerKey: 'ge_50k', points: 19 },
      { category: 3, answerKey: 'approved', points: 19 },
      { category: 4, answerKey: 'near_standard', points: 14 },
      { category: 5, answerKey: 'fast_reasonable', points: 14 },
      { category: 6, answerKey: 'single', points: 9 },
    ])
  })

  it('scores partial leads and returns zero-point rows for unanswered categories', () => {
    const result = scoreLead({
      cat1: 'owner_occupier',
      cat2: '10k_50k',
      cat3: 'under_review',
    }, baseConfig)

    expect(result.score).toBe(36)
    expect(result.tier).toBe('C')
    expect(result.categoryRows).toEqual([
      { category: 1, answerKey: 'owner_occupier', points: 9 },
      { category: 2, answerKey: '10k_50k', points: 14 },
      { category: 3, answerKey: 'under_review', points: 13 },
      { category: 4, answerKey: null, points: 0 },
      { category: 5, answerKey: null, points: 0 },
      { category: 6, answerKey: null, points: 0 },
    ])
  })

  it('applies bonuses and penalties, clamping scores to the 0-100 range', () => {
    const withAdjustments = scoreLead({
      cat1: 'repeat_builder',
      cat2: 'ge_50k',
      cat3: 'approved',
      cat4: 'near_standard',
      cat5: 'fast_reasonable',
      cat6: 'single',
      bonuses: ['package', 'price_match', 'referral'],
      penalties: ['no_intent'],
    }, baseConfig)
    const belowZero = scoreLead({
      penalties: ['no_intent', 'sub_viable'],
    }, baseConfig)

    expect(withAdjustments.score).toBe(99)
    expect(withAdjustments.tier).toBe('A')
    expect(belowZero.score).toBe(0)
    expect(belowZero.tier).toBe('D')
  })

  it.each([
    ['exact_a', 'A'],
    ['below_a', 'B'],
    ['exact_b', 'B'],
    ['below_b', 'C'],
    ['exact_c', 'C'],
    ['below_c', 'D'],
  ] satisfies Array<[string, string]>)('maps %s to tier %s at configured boundaries', (answerKey, tier) => {
    expect(scoreLead({ cat1: answerKey }, boundaryConfig()).tier).toBe(tier)
  })

  it('changes output when the config points change for the same answers', () => {
    const answers: LeadAnswers = {
      cat1: 'owner_occupier',
      cat2: '10k_50k',
      cat3: 'under_review',
    }
    const modifiedConfig: ScoringConfig = {
      ...baseConfig,
      categories: {
        ...baseConfig.categories,
        '1': {
          ...baseConfig.categories['1'],
          options: {
            ...baseConfig.categories['1'].options,
            owner_occupier: 20,
          },
        },
      },
    }

    expect(scoreLead(answers, baseConfig).score).toBe(36)
    expect(scoreLead(answers, modifiedConfig).score).toBe(47)
  })

  it('returns all six category rows when all categories are unanswered', () => {
    const result = scoreLead({}, baseConfig)

    expect(result.categoryRows).toHaveLength(6)
    expect(result.categoryRows).toEqual([
      { category: 1, answerKey: null, points: 0 },
      { category: 2, answerKey: null, points: 0 },
      { category: 3, answerKey: null, points: 0 },
      { category: 4, answerKey: null, points: 0 },
      { category: 5, answerKey: null, points: 0 },
      { category: 6, answerKey: null, points: 0 },
    ])
  })
})
