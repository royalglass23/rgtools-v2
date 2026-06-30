import type { WorkOrderLevel } from './domain'

export type WorkOrderOptionFilter = string
export type WorkOrderSort = 'lead_score' | 'importance' | 'risk' | 'install_date' | 'client_asc' | 'job_number'
export type WorkOrderPageSize = 10 | 20 | 50 | 100
export type WorkOrderCurrentFilter = 'current' | 'non_current' | 'all'

export type WorkOrderListFilters = {
  q: string
  current: WorkOrderCurrentFilter
  risk: WorkOrderLevel | 'all'
  importance: WorkOrderLevel | 'all'
  stage: WorkOrderOptionFilter
  hardware: WorkOrderOptionFilter
  sort: WorkOrderSort
  page: number
  size: WorkOrderPageSize
}

const DEFAULT_FILTERS: WorkOrderListFilters = {
  q: '',
  current: 'current',
  risk: 'all',
  importance: 'all',
  stage: 'all',
  hardware: 'all',
  sort: 'lead_score',
  page: 1,
  size: 10,
}

const LEVELS = new Set(['low', 'medium', 'high'])
const SORTS = new Set<WorkOrderSort>(['lead_score', 'importance', 'risk', 'install_date', 'client_asc', 'job_number'])
const SIZES = new Set<WorkOrderPageSize>([10, 20, 50, 100])

export function parseWorkOrderListFilters(
  searchParams: Record<string, string | string[] | undefined>,
): WorkOrderListFilters {
  const q = stringValue(searchParams.q)?.trim() ?? DEFAULT_FILTERS.q
  const current = currentValue(searchParams.current)
  const risk = levelValue(searchParams.risk)
  const importance = levelValue(searchParams.importance)
  const stage = optionValue(searchParams.stage)
  const hardware = optionValue(searchParams.hardware)
  const sortCandidate = stringValue(searchParams.sort) as WorkOrderSort | undefined
  const page = Number(stringValue(searchParams.page) ?? DEFAULT_FILTERS.page)
  const size = Number(stringValue(searchParams.size) ?? DEFAULT_FILTERS.size)

  return {
    q,
    current,
    risk,
    importance,
    stage,
    hardware,
    sort: sortCandidate && SORTS.has(sortCandidate) ? sortCandidate : DEFAULT_FILTERS.sort,
    page: Number.isInteger(page) && page > 0 ? page : DEFAULT_FILTERS.page,
    size: SIZES.has(size as WorkOrderPageSize) ? size as WorkOrderPageSize : DEFAULT_FILTERS.size,
  }
}

function currentValue(value: string | string[] | undefined): WorkOrderCurrentFilter {
  const candidate = stringValue(value)
  return candidate === 'non_current' || candidate === 'all' ? candidate : 'current'
}

function levelValue(value: string | string[] | undefined): WorkOrderLevel | 'all' {
  const candidate = stringValue(value)
  return candidate && LEVELS.has(candidate) ? candidate as WorkOrderLevel : 'all'
}

function optionValue(value: string | string[] | undefined): string {
  const candidate = stringValue(value)?.trim()
  return candidate || 'all'
}

function stringValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
