import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { settings } from '@rgtools/db/schema'
import { canConfigureSummaryFieldAsEditable } from './summary-field-policy'

export const WORK_ORDER_SUMMARY_CONFIG_KEY = 'work_orders.summary_fields'

export type WorkOrderSummaryFieldId =
  | 'client'
  | 'jobNumber'
  | 'jobAddress'
  | 'leadScore'
  | 'item'
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
  source: 'rg' | 'servicem8' | 'context' | 'composite'
  visible: boolean
  filterable: boolean
  editable: boolean
  order: number
}

export const WORK_ORDER_SUMMARY_FIELD_CATALOG: WorkOrderSummaryFieldConfig[] = [
  { id: 'client', label: 'Client', source: 'rg', visible: true, filterable: false, editable: false, order: 1 },
  { id: 'jobNumber', label: 'Job number', source: 'servicem8', visible: true, filterable: false, editable: false, order: 2 },
  { id: 'jobAddress', label: 'Address', source: 'servicem8', visible: true, filterable: false, editable: false, order: 3 },
  { id: 'leadScore', label: 'Score', source: 'context', visible: true, filterable: false, editable: false, order: 4 },
  { id: 'item', label: 'Item', source: 'composite', visible: true, filterable: false, editable: true, order: 5 },
  { id: 'importance', label: 'Importance', source: 'rg', visible: true, filterable: true, editable: true, order: 6 },
  { id: 'risk', label: 'Risk', source: 'rg', visible: true, filterable: true, editable: true, order: 7 },
  { id: 'installer', label: 'Installer', source: 'rg', visible: true, filterable: false, editable: true, order: 8 },
  { id: 'stage', label: 'Stage', source: 'rg', visible: true, filterable: true, editable: true, order: 9 },
  { id: 'hardware', label: 'Hardware', source: 'rg', visible: true, filterable: true, editable: true, order: 10 },
  { id: 'maintenanceProgram', label: 'Maintenance Program', source: 'rg', visible: true, filterable: true, editable: true, order: 11 },
  { id: 'installDate', label: 'Install date', source: 'rg', visible: true, filterable: false, editable: true, order: 12 },
  { id: 'dateCompleted', label: 'Date completed', source: 'rg', visible: true, filterable: false, editable: true, order: 13 },
  { id: 'servicem8Status', label: 'ServiceM8 status', source: 'servicem8', visible: false, filterable: false, editable: false, order: 14 },
  { id: 'jobDescription', label: 'Job description', source: 'servicem8', visible: false, filterable: false, editable: false, order: 15 },
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
    return defaultSummaryConfig()
  }

  if (!Array.isArray(parsed)) return defaultSummaryConfig()
  const byId = new Map(WORK_ORDER_SUMMARY_FIELD_CATALOG.map((field) => [field.id, field]))
  const savedFields = parsed
    .map((candidate) => {
      if (!candidate || typeof candidate !== 'object') return null
      const row = candidate as Record<string, unknown>
      const base = byId.get(String(row.id) as WorkOrderSummaryFieldId)
      if (!base) return null
      return {
        ...base,
        visible: typeof row.visible === 'boolean' ? row.visible : base.visible,
        filterable: typeof row.filterable === 'boolean' ? row.filterable : base.filterable,
        editable: canConfigureSummaryFieldAsEditable(base.id)
          && (typeof row.editable === 'boolean' ? row.editable : base.editable),
        order: typeof row.order === 'number' ? row.order : base.order,
      }
    })
    .filter((field): field is WorkOrderSummaryFieldConfig => Boolean(field))
    .sort((a, b) => a.order - b.order)

  const normalized = [...savedFields]
  const knownIds = new Set(savedFields.map((field) => field.id))
  for (const missingField of WORK_ORDER_SUMMARY_FIELD_CATALOG) {
    if (knownIds.has(missingField.id)) continue
    insertCatalogField(normalized, { ...missingField })
    knownIds.add(missingField.id)
  }

  return normalized.map((field, index) => ({ ...field, order: index + 1 }))
}

export function serializeSummaryConfig(fields: WorkOrderSummaryFieldConfig[]) {
  return JSON.stringify(fields.map((field) => ({
    id: field.id,
    visible: field.visible,
    filterable: field.filterable,
    editable: canConfigureSummaryFieldAsEditable(field.id) && field.editable,
    order: field.order,
  })))
}

function defaultSummaryConfig() {
  return WORK_ORDER_SUMMARY_FIELD_CATALOG.map((field) => ({ ...field }))
}

function insertCatalogField(
  fields: WorkOrderSummaryFieldConfig[],
  missingField: WorkOrderSummaryFieldConfig,
) {
  const catalogIndex = WORK_ORDER_SUMMARY_FIELD_CATALOG.findIndex((field) => field.id === missingField.id)
  const precedingIds = WORK_ORDER_SUMMARY_FIELD_CATALOG
    .slice(0, catalogIndex)
    .map((field) => field.id)
    .reverse()
  const precedingId = precedingIds.find((id) => fields.some((field) => field.id === id))
  const precedingIndex = precedingId
    ? fields.findIndex((field) => field.id === precedingId)
    : -1

  if (precedingIndex >= 0) {
    fields.splice(precedingIndex + 1, 0, missingField)
    return
  }

  const followingIds = WORK_ORDER_SUMMARY_FIELD_CATALOG
    .slice(catalogIndex + 1)
    .map((field) => field.id)
  const followingId = followingIds.find((id) => fields.some((field) => field.id === id))
  const followingIndex = followingId
    ? fields.findIndex((field) => field.id === followingId)
    : -1
  fields.splice(followingIndex < 0 ? fields.length : followingIndex, 0, missingField)
}
