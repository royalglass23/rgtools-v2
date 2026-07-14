export type WorkOrderItemSummaryRow = {
  id: string
  workOrderId: string
  itemCode: string | null
  quantity: string
  originalDescription: string
  lineTotalExcludingGst: string | null
  generatedLabel: string | null
  manualLabelOverride: string | null
  labelStatus?: 'pending' | 'generated' | 'manual' | 'failed' | 'source_changed'
  sourceDescriptionFingerprint?: string | null
  isActive: boolean
  installerId: string | null
  installerName: string | null
  stageOptionId: string | null
  stageName: string | null
  hardwareStatusOptionId: string | null
  hardwareStatusName: string | null
  maintenanceProgram: boolean
  installDate: string | null
  dateCompleted: string | null
  riskLevel: 'low' | 'medium' | 'high' | null
  importance: 'low' | 'medium' | 'high' | null
}

export type PersistedWorkOrderItemSummaryRow = WorkOrderItemSummaryRow

export function attachActiveItemsToWorkOrders<T extends { id: string }>(
  workOrders: T[],
  items: PersistedWorkOrderItemSummaryRow[],
): Array<T & { activeItemCount: number; items: WorkOrderItemSummaryRow[] }> {
  const itemsByWorkOrderId = new Map<string, WorkOrderItemSummaryRow[]>()

  for (const item of items) {
    const groupedItems = itemsByWorkOrderId.get(item.workOrderId) ?? []
    const summaryItem: WorkOrderItemSummaryRow = {
      id: item.id,
      workOrderId: item.workOrderId,
      itemCode: item.itemCode,
      quantity: item.quantity,
      originalDescription: item.originalDescription,
      lineTotalExcludingGst: item.lineTotalExcludingGst,
      generatedLabel: item.generatedLabel,
      manualLabelOverride: item.manualLabelOverride,
      labelStatus: item.labelStatus,
      sourceDescriptionFingerprint: item.sourceDescriptionFingerprint,
      isActive: item.isActive,
      installerId: item.installerId,
      installerName: item.installerName,
      stageOptionId: item.stageOptionId,
      stageName: item.stageName,
      hardwareStatusOptionId: item.hardwareStatusOptionId,
      hardwareStatusName: item.hardwareStatusName,
      maintenanceProgram: item.maintenanceProgram,
      installDate: item.installDate,
      dateCompleted: item.dateCompleted,
      riskLevel: item.riskLevel,
      importance: item.importance,
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
