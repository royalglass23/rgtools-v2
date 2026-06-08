import { describe, expect, it } from 'vitest'
import { scoreLead, type LeadAnswers, type ScoringConfig } from '../score-lead'

// Config with three strike keys, one per "blocker" category:
// cat4: remote_specialised (weight 1.0)
// cat5: heavy_shopper      (weight 1.0)
// cat6: multi_level        (weight 1.0)
// softDemoteAt=1.0, capAt=2.0, capCeiling='C'
const strikeConfig: ScoringConfig = {
  categories: {
    '1': {
      label: 'Score control',
      max: 100,
      options: { gives_a: 80, gives_b: 60, gives_c: 35, gives_d: 10 },
    },
    '4': {
      label: 'Complexity',
      max: 15,
      options: { near_standard: 14, remote_specialised: 4 },
    },
    '5': {
      label: 'Price sensitivity',
      max: 15,
      options: { fast_reasonable: 14, heavy_shopper: 3 },
    },
    '6': {
      label: 'Decision complexity',
      max: 10,
      options: { single: 9, multi_level: 2 },
    },
  },
  bonuses: {},
  penalties: {},
  tiers: { A: 75, B: 55, C: 30 },
  strikes: {
    weights: {
      remote_specialised: 1.0,
      heavy_shopper: 1.0,
      multi_level: 1.0,
    },
    softDemoteAt: 1.0,
    capAt: 2.0,
    capCeiling: 'C',
  },
}

// Same categories, no strikes block — used to verify score invariance
const noStrikeConfig: ScoringConfig = {
  ...strikeConfig,
  strikes: undefined,
}

// Build answers: cat1 sets score tier; strike keys fill cat4/cat5/cat6
function makeAnswers(scoreTierKey: string, strikeKeys: string[]): LeadAnswers {
  const [s1, s2] = strikeKeys
  return {
    cat1: scoreTierKey,
    ...(s1 ? { cat4: s1 } : {}),
    ...(s2 ? { cat5: s2 } : {}),
  }
}

describe('strike layer — resolution table', () => {
  it.each([
    // [startTier, scoreTierKey, strikeCount, strikeKeys, expectedFinalTier, expectedEffect]
    ['D', 'gives_d',  0, [],                                      'D', 'none'        ],
    ['D', 'gives_d',  1, ['remote_specialised'],                   'D', 'soft_demote' ],
    ['D', 'gives_d',  2, ['remote_specialised', 'heavy_shopper'],  'D', 'cap'         ],
    ['C', 'gives_c',  0, [],                                      'C', 'none'        ],
    ['C', 'gives_c',  1, ['remote_specialised'],                   'D', 'soft_demote' ],
    ['C', 'gives_c',  2, ['remote_specialised', 'heavy_shopper'],  'D', 'cap'         ],
    ['B', 'gives_b',  0, [],                                      'B', 'none'        ],
    ['B', 'gives_b',  1, ['remote_specialised'],                   'C', 'soft_demote' ],
    ['B', 'gives_b',  2, ['remote_specialised', 'heavy_shopper'],  'C', 'cap'         ],
    ['A', 'gives_a',  0, [],                                      'A', 'none'        ],
    ['A', 'gives_a',  1, ['remote_specialised'],                   'B', 'soft_demote' ],
    ['A', 'gives_a',  2, ['remote_specialised', 'heavy_shopper'],  'C', 'cap'         ],
  ] as const)(
    'score-tier %s + %i strike(s) → final tier %s, effect %s',
    (startTier, scoreTierKey, _strikeCount, strikeKeys, expectedTier, expectedEffect) => {
      const answers = makeAnswers(scoreTierKey, [...strikeKeys])
      const result = scoreLead(answers, strikeConfig)

      expect(result.tier).toBe(expectedTier)
      expect(result.strikeResult.finalTier).toBe(expectedTier)
      expect(result.strikeResult.preStrikeTier).toBe(startTier)
      expect(result.strikeResult.effect).toBe(expectedEffect)
      expect(result.strikeResult.firedKeys).toEqual([...strikeKeys])
      expect(result.strikeResult.totalWeight).toBe(strikeKeys.length * 1.0)
    },
  )
})

describe('strike layer — blocker options contribute 0 points', () => {
  it('a strike key earns 0 points; a non-strike key in the same category earns its config points', () => {
    const withStrike = scoreLead({ cat1: 'gives_b', cat4: 'remote_specialised' }, strikeConfig)
    const withNormal = scoreLead({ cat1: 'gives_b', cat4: 'near_standard' }, strikeConfig)

    const strikeRow = withStrike.categoryRows.find((r) => r.category === 4)!
    const normalRow = withNormal.categoryRows.find((r) => r.category === 4)!

    expect(strikeRow.answerKey).toBe('remote_specialised')
    expect(strikeRow.points).toBe(0)
    expect(normalRow.answerKey).toBe('near_standard')
    expect(normalRow.points).toBe(14)
  })
})

describe('strike layer — score is unchanged by strikes', () => {
  it('same non-strike answers produce identical scores with and without a strikes config', () => {
    const answers: LeadAnswers = { cat1: 'gives_a', cat4: 'near_standard', cat5: 'fast_reasonable' }
    const withStrikes = scoreLead(answers, strikeConfig)
    const withoutStrikes = scoreLead(answers, noStrikeConfig)

    expect(withStrikes.score).toBe(withoutStrikes.score)
    // tier may differ (strikes config present but 0 fired), but here 0 fired so same
    expect(withStrikes.tier).toBe(withoutStrikes.tier)
  })

  it('strike options zero points but do not change the score field (score = additive sum of non-strike rows)', () => {
    const noStrikeAnswers: LeadAnswers = { cat1: 'gives_b' }
    const strikeAnswers: LeadAnswers = { cat1: 'gives_b', cat4: 'remote_specialised' }

    const baseResult = scoreLead(noStrikeAnswers, strikeConfig)
    const strikeResult = scoreLead(strikeAnswers, strikeConfig)

    // remote_specialised is zeroed, so score = just cat1 = 60 for both
    expect(baseResult.score).toBe(60)
    expect(strikeResult.score).toBe(60)
    // tier changes because of soft-demote
    expect(baseResult.tier).toBe('B')
    expect(strikeResult.tier).toBe('C')
  })
})

describe('strike layer — no strikes config is a no-op', () => {
  it('a config without a strikes block is byte-for-byte behaviourally unchanged', () => {
    const answers: LeadAnswers = { cat1: 'gives_a', cat4: 'near_standard' }
    const result = scoreLead(answers, noStrikeConfig)

    expect(result.tier).toBe('A')
    expect(result.strikeResult).toEqual({
      firedKeys: [],
      totalWeight: 0,
      preStrikeTier: 'A',
      finalTier: 'A',
      effect: 'none',
    })
  })
})

describe('strike layer — cap is a ceiling, never an improvement', () => {
  it('D + 2 strikes stays D (cap ceiling of C does not lift a D to C)', () => {
    const answers = makeAnswers('gives_d', ['remote_specialised', 'heavy_shopper'])
    const result = scoreLead(answers, strikeConfig)

    expect(result.tier).toBe('D')
    expect(result.strikeResult.finalTier).toBe('D')
    expect(result.strikeResult.effect).toBe('cap')
  })
})
