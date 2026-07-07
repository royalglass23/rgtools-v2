import { describe, expect, it } from 'vitest'
import { DECISION_MATRIX } from '../score-lead'
import { decisionMatrixToOptionLists } from '../config-options'

describe('decisionMatrixToOptionLists', () => {
  it('builds form option lists from the hardcoded Decision Matrix', () => {
    const result = decisionMatrixToOptionLists()

    expect(result.configVersionId).toBeNull()
    expect(result.config).toBe(DECISION_MATRIX)
    expect(result.categories['1']).toMatchObject({
      label: 'Client Type',
      options: [
        { key: 'builder_developer_pool_builder_landscaper', label: 'Builder / Developer / Pool Builder / Landscaper' },
        { key: 'homeowner', label: 'Homeowner' },
      ],
    })
    expect(result.categories['14']).toMatchObject({
      label: 'Installation Height',
      options: [
        { key: 'ground_floor_ladder', label: 'Ground Floor / Ladder' },
        { key: 'scaffold_ewp_crane', label: 'Scaffold / EWP / Crane' },
      ],
    })
  })
})
