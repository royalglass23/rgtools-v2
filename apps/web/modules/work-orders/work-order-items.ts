export type WorkOrderItemSummaryRow = {
  id: string
  itemCode: string | null
  quantity: string
  originalDescription: string
  lineTotalExcludingGst: string | null
  generatedLabel: string | null
  manualLabelOverride: string | null
  isActive: boolean
}

export type PersistedWorkOrderItemSummaryRow = WorkOrderItemSummaryRow & {
  workOrderId: string
}

export function attachActiveItemsToWorkOrders<T extends { id: string }>(
  workOrders: T[],
  items: PersistedWorkOrderItemSummaryRow[],
): Array<T & { activeItemCount: number; items: WorkOrderItemSummaryRow[] }> {
  const itemsByWorkOrderId = new Map<string, WorkOrderItemSummaryRow[]>()

  for (const item of items) {
    const groupedItems = itemsByWorkOrderId.get(item.workOrderId) ?? []
    const summaryItem: WorkOrderItemSummaryRow = {
      id: item.id,
      itemCode: item.itemCode,
      quantity: item.quantity,
      originalDescription: item.originalDescription,
      lineTotalExcludingGst: item.lineTotalExcludingGst,
      generatedLabel: item.generatedLabel,
      manualLabelOverride: item.manualLabelOverride,
      isActive: item.isActive,
    }
    groupedItems.push(summaryItem)
    itemsByWorkOrderId.set(item.workOrderId, groupedItems)
  }

  return workOrders.map((workOrder) => {
    const workOrderItems = itemsByWorkOrderId.get(workOrder.id) ?? []
    return {
      ...workOrder,
      activeItemCount: workOrderItems.filter((item) => item.isActive).length,
      items: workOrderItems,
    }
  })
}
