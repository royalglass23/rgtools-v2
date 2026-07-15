import type { WorkOrderLevel } from './domain'

export const WORK_ORDER_ITEM_OPERATIONAL_FIELDS = [
  'installer',
  'stage',
  'hardware',
  'maintenanceProgram',
  'installDate',
  'dateCompleted',
  'risk',
  'importance',
] as const

export type WorkOrderItemOperationalField = typeof WORK_ORDER_ITEM_OPERATIONAL_FIELDS[number]
export type WorkOrderItemOperationalValue = string | boolean | null

export type WorkOrderItemOperationalState = {
  installerId: string | null
  stageOptionId: string | null
  hardwareStatusOptionId: string | null
  maintenanceProgram: boolean
  installDate: string | null
  dateCompleted: string | null
  riskLevelOverride: WorkOrderLevel | null
  importanceOverride: WorkOrderLevel | null
}

export type WorkOrderItemOperationalUpdate = Partial<WorkOrderItemOperationalState>

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LEVELS = new Set(['low', 'medium', 'high'])

export function parseWorkOrderItemOperationalValue(
  field: WorkOrderItemOperationalField,
  rawValue: string | null,
): WorkOrderItemOperationalValue {
  assertWorkOrderItemOperationalField(field)
  const value = rawValue?.trim() || null

  if (field === 'maintenanceProgram') {
    if (value === 'yes') return true
    if (value === 'no') return false
    throw new Error('Maintenance Program must be Yes or No.')
  }

  if (field === 'installDate' || field === 'dateCompleted') {
    if (value === null) return null
    if (!isIsoDate(value)) {
      const label = field === 'installDate' ? 'Install date' : 'Date completed'
      throw new Error(`${label} must use YYYY-MM-DD.`)
    }
    return value
  }

  if (field === 'risk' || field === 'importance') {
    if (value === null || LEVELS.has(value)) return value
    const label = field === 'risk' ? 'Risk' : 'Importance'
    throw new Error(`${label} must be Low, Medium, High or None.`)
  }

  if (value === null || UUID_PATTERN.test(value)) return value
  throw new Error(`${operationalFieldLabel(field)} must be a valid option.`)
}

export function assertWorkOrderItemOperationalField(
  field: unknown,
): asserts field is WorkOrderItemOperationalField {
  if ((WORK_ORDER_ITEM_OPERATIONAL_FIELDS as readonly unknown[]).includes(field)) return
  throw new Error(`Work Order Item field ${String(field)} cannot be edited.`)
}

export function readWorkOrderItemOperationalValue(
  state: WorkOrderItemOperationalState,
  field: WorkOrderItemOperationalField,
): WorkOrderItemOperationalValue {
  if (field === 'installer') return state.installerId
  if (field === 'stage') return state.stageOptionId
  if (field === 'hardware') return state.hardwareStatusOptionId
  if (field === 'maintenanceProgram') return state.maintenanceProgram
  if (field === 'installDate') return state.installDate
  if (field === 'dateCompleted') return state.dateCompleted
  if (field === 'risk') return state.riskLevelOverride
  return state.importanceOverride
}

export function workOrderItemOperationalUpdate(
  field: WorkOrderItemOperationalField,
  value: WorkOrderItemOperationalValue,
): WorkOrderItemOperationalUpdate {
  if (field === 'installer') return { installerId: value as string | null }
  if (field === 'stage') return { stageOptionId: value as string | null }
  if (field === 'hardware') return { hardwareStatusOptionId: value as string | null }
  if (field === 'maintenanceProgram') return { maintenanceProgram: value as boolean }
  if (field === 'installDate') return { installDate: value as string | null }
  if (field === 'dateCompleted') return { dateCompleted: value as string | null }
  if (field === 'risk') return { riskLevelOverride: value as WorkOrderLevel | null }
  return { importanceOverride: value as WorkOrderLevel | null }
}

export function workOrderItemOperationalEventName(field: WorkOrderItemOperationalField) {
  if (field === 'installer') return 'item_installer_changed'
  if (field === 'stage') return 'item_stage_changed'
  if (field === 'hardware') return 'item_hardware_status_changed'
  if (field === 'maintenanceProgram') return 'item_maintenance_program_changed'
  if (field === 'installDate') return 'item_install_date_changed'
  if (field === 'dateCompleted') return 'item_date_completed_changed'
  if (field === 'risk') return 'item_risk_changed'
  return 'item_importance_changed'
}

export function operationalFieldLabel(field: WorkOrderItemOperationalField) {
  if (field === 'maintenanceProgram') return 'Maintenance Program'
  if (field === 'installDate') return 'Install date'
  if (field === 'dateCompleted') return 'Date completed'
  return field.charAt(0).toUpperCase() + field.slice(1)
}

function isIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}
