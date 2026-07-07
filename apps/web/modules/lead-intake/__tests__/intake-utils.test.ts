import { describe, expect, it } from 'vitest'
import {
  buildCategoryAnswers,
  normalizeInput,
  repairMatrixFieldAliases,
  validateScoredOptions,
  type IntakeCategoryOptions,
} from '../intake-utils'
import type { LeadIntakeInput } from '../actions'

function input(overrides: Partial<LeadIntakeInput> = {}): LeadIntakeInput {
  return {
    clientName: 'Alex Client',
    phone: '021 123 456',
    email: 'alex@example.com',
    clientProfileKey: 'repeat_builder',
    projectType: 'Shower',
    location: 'Auckland',
    source: 'phone',
    ...overrides,
  }
}

describe('intake-utils v4 scoring fields', () => {
  it('normalizes RC, BC, and building stage fields', () => {
    const normalized = normalizeInput(input({
      rcStatus: ' approved ',
      bcStatus: ' under_review ',
      buildingStage: ' enclosed ',
    }))

    expect(normalized.rcStatus).toBe('approved')
    expect(normalized.bcStatus).toBe('under_review')
    expect(normalized.buildingStage).toBe('enclosed')
  })

  it('builds category answers without legacy consent category 3 and includes cats 8, 9, and 10', () => {
    const answers = buildCategoryAnswers(normalizeInput(input({
      budgetBand: '50k_plus',
      cat4: 'standard_non_custom',
      priceSensitivityRead: 'fast_decision',
      decisionMakers: 'sole_decision_maker',
      consentStatus: 'both_consents_approved',
      rcStatus: 'approved',
      bcStatus: 'not_required',
      buildingStage: 'fitout_complete',
    })), 'within_30km')

    expect(answers).toEqual([
      { category: 1, answerKey: 'repeat_builder' },
      { category: 2, answerKey: '50k_plus' },
      { category: 4, answerKey: 'standard_non_custom' },
      { category: 5, answerKey: 'fast_decision' },
      { category: 6, answerKey: 'sole_decision_maker' },
      { category: 7, answerKey: 'within_30km' },
      { category: 8, answerKey: 'approved' },
      { category: 9, answerKey: 'not_required' },
      { category: 10, answerKey: 'fitout_complete' },
    ])
  })

  it('repairs project type values submitted in the building stage field', () => {
    const normalized = repairMatrixFieldAliases(normalizeInput(input({
      cat4: '',
      buildingStage: 'new_build_commercial_fit_out',
    })))

    expect(normalized.cat4).toBe('new_build_commercial_fit_out')
    expect(normalized.buildingStage).toBe('')
  })

  it('validates RC, BC, and building stage against active options', () => {
    const categories: IntakeCategoryOptions = {
      '1': { options: [{ key: 'repeat_builder' }] },
      '2': { options: [{ key: '50k_plus' }] },
      '4': { options: [{ key: 'standard_non_custom' }] },
      '5': { options: [{ key: 'fast_decision' }] },
      '6': { options: [{ key: 'sole_decision_maker' }] },
      '8': { options: [{ key: 'approved' }] },
      '9': { options: [{ key: 'not_required' }] },
      '10': { options: [{ key: 'fitout_complete' }] },
    }

    expect(validateScoredOptions(normalizeInput(input({
      budgetBand: '50k_plus',
      cat4: 'standard_non_custom',
      priceSensitivityRead: 'fast_decision',
      decisionMakers: 'sole_decision_maker',
      rcStatus: 'approved',
      bcStatus: 'not_required',
      buildingStage: 'fitout_complete',
    })), categories)).toBeNull()

    expect(validateScoredOptions(normalizeInput(input({
      rcStatus: 'missing_option',
    })), categories)).toBe('Resource Consent is not a valid active config option.')
  })
})
