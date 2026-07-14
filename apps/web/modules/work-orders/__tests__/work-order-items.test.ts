import { describe, expect, it } from 'vitest'

import { attachActiveItemsToWorkOrders } from '../work-order-items'

function itemOperationalDefaults() {
  return {
    installerId: null,
    installerName: null,
    stageOptionId: null,
    stageName: null,
    hardwareStatusOptionId: null,
    hardwareStatusName: null,
    maintenanceProgram: false,
    installDate: null,
    dateCompleted: null,
    riskLevel: null,
    importance: null,
  } as const
}

describe('attachActiveItemsToWorkOrders', () => {
  it('groups multiple children under one parent and retains an empty parent', () => {
    const rows = attachActiveItemsToWorkOrders(
      [{ id: 'work-order-1' }, { id: 'work-order-2' }],
      [
        {
          ...itemOperationalDefaults(),
          id: 'item-1',
          workOrderId: 'work-order-1',
          itemCode: 'GLASS-001',
          quantity: '1.000',
          originalDescription: 'Shower glass',
          lineTotalExcludingGst: '900.00',
          generatedLabel: null,
          manualLabelOverride: null,
          isActive: true,
        },
        {
          ...itemOperationalDefaults(),
          id: 'item-2',
          workOrderId: 'work-order-1',
          itemCode: 'HARDWARE-001',
          quantity: '2.000',
          originalDescription: 'Shower hardware',
          lineTotalExcludingGst: '150.00',
          generatedLabel: null,
          manualLabelOverride: null,
          isActive: true,
        },
      ],
    )

    expect(rows).toEqual([
      expect.objectContaining({ id: 'work-order-1', activeItemCount: 2, items: expect.any(Array) }),
      expect.objectContaining({ id: 'work-order-2', activeItemCount: 0, items: [] }),
    ])
    expect(rows[0].items).toHaveLength(2)
  })

  it('keeps removed rows visible without adding them to the active item count', () => {
    const [workOrder] = attachActiveItemsToWorkOrders(
      [{ id: 'work-order-1' }],
      [
        { ...itemOperationalDefaults(), id: 'item-active', workOrderId: 'work-order-1', itemCode: 'GLASS-001', quantity: '1.000', originalDescription: 'Current glass', lineTotalExcludingGst: '900.00', generatedLabel: null, manualLabelOverride: null, isActive: true },
        { ...itemOperationalDefaults(), id: 'item-removed', workOrderId: 'work-order-1', itemCode: 'OLD-001', quantity: '1.000', originalDescription: 'Removed glass', lineTotalExcludingGst: '800.00', generatedLabel: null, manualLabelOverride: null, isActive: false },
      ],
    )

    expect(workOrder.activeItemCount).toBe(1)
    expect(workOrder.items).toHaveLength(2)
  })
})
