import { describe, expect, it } from 'vitest'
import { buildScoringConfigV4 } from '@/scripts/seed-scoring-config-v4'
import { scoreLead, type LeadAnswers } from '../score-lead'

const config = buildScoringConfigV4()

function maxAnswers(overrides: LeadAnswers = {}): LeadAnswers {
  return {
    cat1: 'repeat_builder',
    cat2: '50k_plus',
    cat4: 'standard_non_custom',
    cat5: 'fast_decision',
    cat6: 'sole_decision_maker',
    cat7: 'within_30km',
    cat8: 'approved',
    cat9: 'approved',
    cat10: 'fitout_complete',
    ...overrides,
  }
}

describe('v4 scoring config', () => {
  it('uses categories 1,2,4,5,6,7,8,9,10 with no category 3 and max 100', () => {
    expect(Object.keys(config.categories)).toEqual(['1', '2', '4', '5', '6', '7', '8', '9', '10'])
    expect(config.categories['3']).toBeUndefined()
    expect(config.categories['8'].max).toBe(7)
    expect(config.categories['9'].max).toBe(6)
    expect(config.categories['10'].max).toBe(6)

    const totalMax = Object.values(config.categories).reduce((total, category) => total + category.max, 0)
    expect(totalMax).toBe(100)
  })

  it('scores RC, BC, and building stage ladders while retaining a 100 point maximum', () => {
    expect(scoreLead(maxAnswers({ cat8: 'not_required' }), config).categoryRows).toContainEqual({
      category: 8,
      answerKey: 'not_required',
      points: 7,
    })
    expect(scoreLead(maxAnswers({ cat8: 'approved' }), config).categoryRows).toContainEqual({
      category: 8,
      answerKey: 'approved',
      points: 7,
    })
    expect(scoreLead(maxAnswers({ cat8: 'under_review' }), config).categoryRows).toContainEqual({
      category: 8,
      answerKey: 'under_review',
      points: 4,
    })
    expect(scoreLead(maxAnswers({ cat8: 'not_applied' }), config).categoryRows).toContainEqual({
      category: 8,
      answerKey: 'not_applied',
      points: 1,
    })

    expect(scoreLead(maxAnswers({ cat9: 'not_required' }), config).categoryRows).toContainEqual({
      category: 9,
      answerKey: 'not_required',
      points: 6,
    })
    expect(scoreLead(maxAnswers({ cat9: 'approved' }), config).categoryRows).toContainEqual({
      category: 9,
      answerKey: 'approved',
      points: 6,
    })
    expect(scoreLead(maxAnswers({ cat9: 'under_review' }), config).categoryRows).toContainEqual({
      category: 9,
      answerKey: 'under_review',
      points: 4,
    })
    expect(scoreLead(maxAnswers({ cat9: 'not_applied' }), config).categoryRows).toContainEqual({
      category: 9,
      answerKey: 'not_applied',
      points: 1,
    })

    expect(scoreLead(maxAnswers({ cat10: 'planning' }), config).categoryRows).toContainEqual({
      category: 10,
      answerKey: 'planning',
      points: 1,
    })
    expect(scoreLead(maxAnswers({ cat10: 'foundation_framing' }), config).categoryRows).toContainEqual({
      category: 10,
      answerKey: 'foundation_framing',
      points: 3,
    })
    expect(scoreLead(maxAnswers({ cat10: 'enclosed' }), config).categoryRows).toContainEqual({
      category: 10,
      answerKey: 'enclosed',
      points: 5,
    })
    expect(scoreLead(maxAnswers({ cat10: 'fitout_complete' }), config).categoryRows).toContainEqual({
      category: 10,
      answerKey: 'fitout_complete',
      points: 6,
    })

    expect(scoreLead(maxAnswers(), config).score).toBe(100)
  })

  it('keeps blocker strike behavior for complexity, sensitivity, and decision-maker answers', () => {
    const oneStrike = scoreLead(maxAnswers({ cat4: 'complex_install' }), config)
    const twoStrikes = scoreLead(maxAnswers({ cat4: 'complex_install', cat5: 'high_sensitivity' }), config)
    const threeStrikes = scoreLead(
      maxAnswers({ cat4: 'complex_install', cat5: 'high_sensitivity', cat6: 'multilayer_board' }),
      config,
    )

    expect(oneStrike.strikeResult).toMatchObject({
      firedKeys: ['complex_install'],
      effect: 'soft_demote',
      preStrikeTier: 'A',
      finalTier: 'B',
    })
    expect(twoStrikes.strikeResult).toMatchObject({
      firedKeys: ['complex_install', 'high_sensitivity'],
      effect: 'cap',
      preStrikeTier: 'A',
      finalTier: 'C',
    })
    expect(threeStrikes.strikeResult).toMatchObject({
      firedKeys: ['complex_install', 'high_sensitivity', 'multilayer_board'],
      effect: 'cap',
      finalTier: 'C',
    })
  })
})
