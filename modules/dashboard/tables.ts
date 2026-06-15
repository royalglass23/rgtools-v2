/**
 * Client-safe metadata describing which entity tables can appear on the dashboard,
 * their default-filter fields, and the validation/sanitisation of a saved selection.
 *
 * IMPORTANT: keep this file free of server-only imports (db, queries, etc.) so it can
 * be bundled into the admin editor client component.
 */

export const DASHBOARD_TABLE_KEYS = ['leads', 'quotes', 'work_orders'] as const
export type DashboardTableKey = (typeof DASHBOARD_TABLE_KEYS)[number]

export const MAX_DASHBOARD_TABLES = 3

export const DASHBOARD_TABLES_SETTING_KEY = 'dashboard_tables'

export type FilterFieldDef = {
  name: string
  label: string
  /** [value, label] pairs. The first value is also the field default. */
  options: ReadonlyArray<readonly [string, string]>
  default: string
}

export type DashboardTableMeta = {
  key: DashboardTableKey
  label: string
  /** Tables whose list page/component do not exist yet are shown disabled and never rendered. */
  available: boolean
  /** Prefix applied to this table's query params on the shared dashboard URL. */
  paramPrefix: string
  filterFields: FilterFieldDef[]
}

export const DASHBOARD_TABLES: DashboardTableMeta[] = [
  {
    key: 'leads',
    label: 'Leads',
    available: true,
    paramPrefix: 'leads_',
    filterFields: [
      { name: 'tier', label: 'Tier', options: [['all', 'All'], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D']], default: 'all' },
      { name: 'sm8', label: 'SM8', options: [['all', 'All'], ['linked', 'Linked'], ['pending', 'Pending'], ['failed', 'Failed']], default: 'all' },
      { name: 'date', label: 'Date', options: [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['all', 'All time']], default: '30' },
      { name: 'size', label: 'Page size', options: [['10', '10'], ['20', '20'], ['50', '50'], ['100', '100']], default: '10' },
    ],
  },
  // Placeholders — flip `available` to true once their list page + table-controls component exist.
  { key: 'quotes', label: 'Quotes', available: false, paramPrefix: 'quotes_', filterFields: [] },
  { key: 'work_orders', label: 'Work Orders', available: false, paramPrefix: 'wo_', filterFields: [] },
]

export type DashboardTableConfig = {
  key: DashboardTableKey
  /** Default-filter values keyed by field name (e.g. { tier: 'A', date: '30' }). */
  filter: Record<string, string>
}

export function getTableMeta(key: string): DashboardTableMeta | undefined {
  return DASHBOARD_TABLES.find((table) => table.key === key)
}

/** Build the default filter for a table from its field defaults. */
export function defaultFilterFor(key: DashboardTableKey): Record<string, string> {
  const meta = getTableMeta(key)
  if (!meta) return {}
  return Object.fromEntries(meta.filterFields.map((field) => [field.name, field.default]))
}

/** Coerce one table's raw filter to a valid filter (known fields only, values within options). */
function sanitizeFilter(meta: DashboardTableMeta, raw: unknown): Record<string, string> {
  const source = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {}
  const filter: Record<string, string> = {}

  for (const field of meta.filterFields) {
    const value = source[field.name]
    const allowed = field.options.some(([optionValue]) => optionValue === value)
    filter[field.name] = allowed ? (value as string) : field.default
  }

  return filter
}

/**
 * Validate/repair a saved selection: keep known + available tables, drop duplicates,
 * clamp to MAX_DASHBOARD_TABLES, and sanitise each filter. Pure — used on read and save.
 */
export function sanitizeDashboardConfig(raw: unknown): DashboardTableConfig[] {
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  const result: DashboardTableConfig[] = []

  for (const entry of raw) {
    if (result.length >= MAX_DASHBOARD_TABLES) break
    const key = (entry && typeof entry === 'object') ? (entry as { key?: unknown }).key : undefined
    if (typeof key !== 'string') continue

    const meta = getTableMeta(key)
    if (!meta || !meta.available || seen.has(key)) continue

    seen.add(key)
    result.push({
      key: meta.key,
      filter: sanitizeFilter(meta, (entry as { filter?: unknown }).filter),
    })
  }

  return result
}

export const DEFAULT_DASHBOARD_CONFIG: DashboardTableConfig[] = [
  { key: 'leads', filter: defaultFilterFor('leads') },
]
