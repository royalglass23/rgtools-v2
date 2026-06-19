// @vitest-environment node

import { describe, expect, it } from 'vitest'
import type { ActiveScoringOptionLists } from '@/modules/lead-intake/scoring/config-options'
import { mapTemplateRow } from '../map-template-row'
import type { RawImportRow } from '../types'

const optionLists: ActiveScoringOptionLists = {
  configVersionId: 'config-1',
  config: { categories: {}, bonuses: {}, penalties: {}, tiers: { A: 80, B: 60, C: 40 } },
  categories: {
    '1': { label: 'Client Type', options: [{ key: 'repeat_builder', label: 'Repeat Builder' }] },
    '2': {
      label: 'Budget Band',
      options: [
        { key: '50k_plus', label: '$50,000+' },
        { key: '10k_to_50k', label: '$10,000 â€“ $50,000' },
        { key: '2k_to_10k', label: '$2,000 â€“ $10,000' },
        { key: 'under_2k', label: 'Less than $2,000' },
      ],
    },
    '4': { label: 'Complexity', options: [{ key: 'complex_install', label: 'Complex Install' }] },
    '5': { label: 'Price Sensitivity', options: [{ key: 'fast_decision', label: 'Fast Decision' }] },
    '6': { label: 'Decision Makers', options: [{ key: 'one_decision_maker', label: 'One Decision Maker' }] },
    '8': { label: 'Resource Consent', options: [{ key: 'approved', label: 'Approved' }] },
    '9': { label: 'Building Consent', options: [{ key: 'under_review', label: 'Under Review' }] },
    '10': { label: 'Building Stage', options: [{ key: 'planning', label: 'Planning' }] },
  },
}

function raw(values: Partial<RawImportRow['values']> = {}): RawImportRow {
  return {
    rowNumber: 2,
    values: {
      'Job Number *': 'R260227',
      'Client Name *': 'Aroha Smith',
      Company: 'Smith Build',
      Phone: '',
      Email: '',
      'Job Address *': '1 Queen Street, Auckland',
      'Client Type *': 'Repeat Builder',
      'Budget Band *': '$50,000+',
      'Complexity *': 'Complex Install',
      'Price Sensitivity *': 'Fast Decision',
      'Decision Makers': 'One Decision Maker',
      'Resource Consent': 'Approved',
      'Building Consent': 'Under Review',
      'Building Stage': 'Planning',
      Notes: 'Imported from template.',
      ...values,
    },
  }
}

describe('mapTemplateRow', () => {
  it('maps every dropdown label to its active option key', () => {
    const row = mapTemplateRow(raw(), optionLists)

    expect(row.input).toMatchObject({
      externalRef: 'R260227',
      source: 'other',
      clientProfileKey: 'repeat_builder',
      budgetBand: '50k_plus',
      cat4: 'complex_install',
      priceSensitivityRead: 'fast_decision',
      decisionMakers: 'one_decision_maker',
      rcStatus: 'approved',
      bcStatus: 'under_review',
      buildingStage: 'planning',
    })
    expect(row.issues).toEqual([])
    expect(row.needsContact).toBe(true)
  })

  it('flags invalid dropdown values', () => {
    const row = mapTemplateRow(raw({ 'Budget Band *': 'Huge money' }), optionLists)

    expect(row.input.budgetBand).toBe('')
    expect(row.issues).toContainEqual({
      field: 'budgetBand',
      message: 'Huge money is not a valid Budget Band option.',
    })
  })

  it('maps budget bands with normal hyphens, en dashes, and mojibake dashes', () => {
    expect(mapTemplateRow(raw({ 'Budget Band *': '$10,000 - $50,000' }), optionLists).input.budgetBand)
      .toBe('10k_to_50k')
    expect(mapTemplateRow(raw({ 'Budget Band *': '$2,000 – $10,000' }), optionLists).input.budgetBand)
      .toBe('2k_to_10k')
    expect(mapTemplateRow(raw({ 'Budget Band *': '$10,000 â€“ $50,000' }), optionLists).input.budgetBand)
      .toBe('10k_to_50k')
    expect(mapTemplateRow(raw({ 'Budget Band *': 'Less than $2,000' }), optionLists).input.budgetBand)
      .toBe('under_2k')
  })

  it('flags missing required fields', () => {
    const row = mapTemplateRow(raw({
      'Job Number *': '',
      'Client Name *': '',
      'Job Address *': '',
      'Client Type *': '',
    }), optionLists)

    expect(row.issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(['jobNumber', 'clientName', 'location', 'clientProfileKey']),
    )
  })
})
