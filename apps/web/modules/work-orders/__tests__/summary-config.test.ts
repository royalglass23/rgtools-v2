import { describe, expect, it } from 'vitest'
import {
  normalizeSummaryConfig,
  WORK_ORDER_SUMMARY_FIELD_CATALOG,
} from '../summary-config'

describe('Work Order summary configuration', () => {
  it('preserves an older saved layout while adding Item and Editable defaults', () => {
    const saved = JSON.stringify([
      { id: 'importance', visible: false, filterable: true, order: 1 },
      { id: 'client', visible: true, filterable: false, order: 2 },
    ])

    const normalized = normalizeSummaryConfig(saved)

    expect(normalized).toHaveLength(WORK_ORDER_SUMMARY_FIELD_CATALOG.length)
    expect(normalized.find((field) => field.id === 'importance')).toMatchObject({
      visible: false,
      filterable: true,
      editable: true,
    })
    expect(normalized.find((field) => field.id === 'client')).toMatchObject({
      visible: true,
      filterable: false,
      editable: false,
    })
    expect(normalized.find((field) => field.id === 'item')).toMatchObject({
      visible: true,
      filterable: false,
      editable: true,
    })

    const savedOrder = normalized
      .filter((field) => field.id === 'importance' || field.id === 'client')
      .map((field) => field.id)
    expect(savedOrder).toEqual(['importance', 'client'])
  })
})
