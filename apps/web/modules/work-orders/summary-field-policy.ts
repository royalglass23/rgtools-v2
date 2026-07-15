import type { WorkOrderSummaryFieldId } from './summary-config'

const EDITABLE_SUMMARY_FIELDS = new Set<WorkOrderSummaryFieldId>([
  'item',
  'importance',
  'risk',
  'installer',
  'stage',
  'hardware',
  'maintenanceProgram',
  'installDate',
  'dateCompleted',
])

export function canConfigureSummaryFieldAsEditable(fieldId: WorkOrderSummaryFieldId) {
  return EDITABLE_SUMMARY_FIELDS.has(fieldId)
}
