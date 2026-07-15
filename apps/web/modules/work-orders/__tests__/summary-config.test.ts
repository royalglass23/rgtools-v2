import { describe, expect, it } from 'vitest'
import {
  normalizeSummaryConfig,
  serializeSummaryConfig,
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

  it('inserts missing fields in catalog order when the saved fields still use catalog order', () => {
    const saved = JSON.stringify([
      { id: 'client', visible: true, filterable: false, order: 1 },
      { id: 'importance', visible: false, filterable: true, order: 2 },
      { id: 'jobDescription', visible: false, filterable: false, order: 3 },
    ])

    const normalized = normalizeSummaryConfig(saved)

    expect(normalized.map((field) => field.id)).toEqual(
      WORK_ORDER_SUMMARY_FIELD_CATALOG.map((field) => field.id),
    )
  })

  it('persists Editable choices while forcing non-editable ownership fields read-only', () => {
    const normalized = normalizeSummaryConfig(JSON.stringify([
      { id: 'client', visible: true, filterable: false, editable: true, order: 1 },
      { id: 'item', visible: true, filterable: false, editable: false, order: 2 },
    ]))

    expect(normalized.find((field) => field.id === 'client')?.editable).toBe(false)
    expect(normalized.find((field) => field.id === 'item')?.editable).toBe(false)

    const serialized = JSON.parse(serializeSummaryConfig(normalized)) as Array<{
      id: string
      editable: boolean
    }>
    expect(serialized.find((field) => field.id === 'client')?.editable).toBe(false)
    expect(serialized.find((field) => field.id === 'item')?.editable).toBe(false)
  })
})
