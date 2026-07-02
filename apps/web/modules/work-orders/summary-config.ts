import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { settings } from '@rgtools/db/schema'

export const WORK_ORDER_SUMMARY_CONFIG_KEY = 'work_orders.summary_fields'

export type WorkOrderSummaryFieldId =
  | 'client'
  | 'jobNumber'
  | 'jobAddress'
  | 'leadScore'
  | 'importance'
  | 'risk'
  | 'installer'
  | 'stage'
  | 'hardware'
  | 'maintenanceProgram'
  | 'installDate'
  | 'dateCompleted'
  | 'servicem8Status'
  | 'jobDescription'

export type WorkOrderSummaryFieldConfig = {
  id: WorkOrderSummaryFieldId
  label: string
  source: 'rg' | 'servicem8' | 'context'
  visible: boolean
  filterable: boolean
  order: number
}

export const WORK_ORDER_SUMMARY_FIELD_CATALOG: WorkOrderSummaryFieldConfig[] = [
  { id: 'client', label: 'Client', source: 'rg', visible: true, filterable: false, order: 1 },
  { id: 'jobNumber', label: 'Job number', source: 'servicem8', visible: true, filterable: false, order: 2 },
  { id: 'jobAddress', label: 'Address', source: 'servicem8', visible: true, filterable: false, order: 3 },
  { id: 'leadScore', label: 'Score', source: 'context', visible: true, filterable: false, order: 4 },
  { id: 'importance', label: 'Importance', source: 'rg', visible: true, filterable: true, order: 5 },
  { id: 'risk', label: 'Risk', source: 'rg', visible: true, filterable: true, order: 6 },
  { id: 'installer', label: 'Installer', source: 'rg', visible: true, filterable: false, order: 7 },
  { id: 'stage', label: 'Stage', source: 'rg', visible: true, filterable: true, order: 8 },
  { id: 'hardware', label: 'Hardware', source: 'rg', visible: true, filterable: true, order: 9 },
  { id: 'maintenanceProgram', label: 'Maintenance Program', source: 'rg', visible: true, filterable: true, order: 10 },
  { id: 'installDate', label: 'Install date', source: 'rg', visible: true, filterable: false, order: 11 },
  { id: 'dateCompleted', label: 'Date completed', source: 'rg', visible: true, filterable: false, order: 12 },
  { id: 'servicem8Status', label: 'ServiceM8 status', source: 'servicem8', visible: false, filterable: false, order: 13 },
  { id: 'jobDescription', label: 'Job description', source: 'servicem8', visible: false, filterable: false, order: 14 },
]

export async function getWorkOrderSummaryConfig() {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, WORK_ORDER_SUMMARY_CONFIG_KEY))
    .limit(1)

  if (!row) return WORK_ORDER_SUMMARY_FIELD_CATALOG
  return normalizeSummaryConfig(row.value)
}

export function normalizeSummaryConfig(raw: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return WORK_ORDER_SUMMARY_FIELD_CATALOG
  }

  if (!Array.isArray(parsed)) return WORK_ORDER_SUMMARY_FIELD_CATALOG
  const byId = new Map(WORK_ORDER_SUMMARY_FIELD_CATALOG.map((field) => [field.id, field]))

  return parsed
    .map((candidate) => {
      if (!candidate || typeof candidate !== 'object') return null
      const row = candidate as Record<string, unknown>
      const base = byId.get(String(row.id) as WorkOrderSummaryFieldId)
      if (!base) return null
      return {
        ...base,
        visible: typeof row.visible === 'boolean' ? row.visible : base.visible,
        filterable: typeof row.filterable === 'boolean' ? row.filterable : base.filterable,
        order: typeof row.order === 'number' ? row.order : base.order,
      }
    })
    .filter((field): field is WorkOrderSummaryFieldConfig => Boolean(field))
    .sort((a, b) => a.order - b.order)
}

export function serializeSummaryConfig(fields: WorkOrderSummaryFieldConfig[]) {
  return JSON.stringify(fields.map((field) => ({
    id: field.id,
    visible: field.visible,
    filterable: field.filterable,
    order: field.order,
  })))
}
