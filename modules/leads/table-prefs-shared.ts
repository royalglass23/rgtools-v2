export type TablePrefs = {
  columns: { key: string; visible: boolean }[]
  sortColumn: string
  sortDir: 'asc' | 'desc'
}

export const LEADS_TABLE_KEY = 'leads'

export const LEADS_COLUMN_KEYS = [
  'date',
  'client',
  'address',
  'project',
  'tier',
  'score',
  'sm8',
  'completeness',
  'rcStatus',
  'bcStatus',
  'buildingStage',
  'followUpDate',
  'updatedAt',
  'aiSuggestion',
] as const

export const LEADS_SORT_COLUMNS = [
  'createdAt',
  'tier',
  'seedScore',
  'completeness',
  'followUpDate',
  'updatedAt',
  'clientName',
] as const

export const DEFAULT_LEADS_PREFS: TablePrefs = {
  columns: LEADS_COLUMN_KEYS.map((key) => ({
    key,
    visible: !['rcStatus', 'bcStatus', 'buildingStage', 'followUpDate', 'updatedAt', 'aiSuggestion'].includes(key),
  })),
  sortColumn: 'createdAt',
  sortDir: 'desc',
}

const columnKeySet = new Set<string>(LEADS_COLUMN_KEYS)
const sortColumnSet = new Set<string>(LEADS_SORT_COLUMNS)

export function normalizeTablePrefs(value: unknown): TablePrefs {
  const input = isRecord(value) ? value : {}
  const inputColumns = Array.isArray(input.columns) ? input.columns : []
  const usedKeys = new Set<string>()
  const columns: TablePrefs['columns'] = []

  for (const column of inputColumns) {
    if (!isRecord(column) || typeof column.key !== 'string' || !columnKeySet.has(column.key) || usedKeys.has(column.key)) {
      continue
    }

    usedKeys.add(column.key)
    columns.push({ key: column.key, visible: column.visible !== false })
  }

  for (const column of DEFAULT_LEADS_PREFS.columns) {
    if (!usedKeys.has(column.key)) columns.push({ ...column })
  }

  const sortColumn = typeof input.sortColumn === 'string' && sortColumnSet.has(input.sortColumn)
    ? input.sortColumn
    : DEFAULT_LEADS_PREFS.sortColumn
  const sortDir = input.sortDir === 'asc' || input.sortDir === 'desc'
    ? input.sortDir
    : DEFAULT_LEADS_PREFS.sortDir

  return { columns, sortColumn, sortDir }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
