import { describe, expect, it } from 'vitest'
import {
  DECISION_MATRIX,
  MATRIX_FIELD_COUNT,
  scoreLead,
  tierForScore,
  type DecisionMatrixAnswers,
} from '../score-lead'

const bestAnswers = Object.fromEntries(
  DECISION_MATRIX.fields.map((field) => [field.key, field.options[0].key]),
) as DecisionMatrixAnswers

describe('Decision Matrix scorer', () => {
  it('exports a 100 point matrix with Team Notes, Team Actions, and cadence offsets', () => {
    expect(DECISION_MATRIX.fields).toHaveLength(13)
    expect(MATRIX_FIELD_COUNT).toBe(13)
    expect(DECISION_MATRIX.fields.reduce((total, field) => total + field.maxPoints, 0)).toBe(100)
    expect(DECISION_MATRIX.fields.flatMap((field) => field.options).every((option) => option.teamNote.length > 0)).toBe(true)
    expect(DECISION_MATRIX.tiers.map((tier) => [tier.tier, tier.minScore, tier.followUpOffsetDays])).toEqual([
      ['A', 85, 1],
      ['B', 70, 7],
      ['C', 50, 21],
      ['D', 30, 30],
      ['E', 0, 75],
    ])
    expect(DECISION_MATRIX.tiers.every((tier) => tier.teamAction.length > 0)).toBe(true)
  })

  it('scores all-empty answers as zero, Tier E, and 0/13 completeness', () => {
    expect(scoreLead({})).toEqual({
      score: 0,
      tier: 'E',
      completeness: { answered: 0, total: 13 },
    })
  })

  it('scores all-best answers as 100, Tier A, and 13/13 completeness', () => {
    expect(scoreLead(bestAnswers)).toEqual({
      score: 100,
      tier: 'A',
      completeness: { answered: 13, total: 13 },
    })
  })

  it('covers every field option with its canonical point value', () => {
    for (const field of DECISION_MATRIX.fields) {
      for (const option of field.options) {
        expect(scoreLead({ [field.key]: option.key }).score, `${field.key}:${option.key}`).toBe(option.points)
      }
    }
  })

  it.each([
    [85, 'A'],
    [84, 'B'],
    [70, 'B'],
    [69, 'C'],
    [50, 'C'],
    [49, 'D'],
    [30, 'D'],
    [29, 'E'],
  ] as const)('maps score %i to Tier %s', (score, tier) => {
    expect(tierForScore(score)).toBe(tier)
  })
})
