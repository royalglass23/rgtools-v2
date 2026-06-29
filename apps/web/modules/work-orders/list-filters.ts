import type { WorkOrderLevel } from './domain'

export type WorkOrderStatusFilter = string
export type WorkOrderOptionFilter = string
export type WorkOrderSort = 'lead_score' | 'importance' | 'risk' | 'install_date' | 'client_asc' | 'job_number'
export type WorkOrderPageSize = 10 | 20 | 50 | 100

export type WorkOrderListFilters = {
  q: string
  servicem8Status: WorkOrderStatusFilter
  risk: WorkOrderLevel | 'all'
  importance: WorkOrderLevel | 'all'
  installer: WorkOrderOptionFilter
  stage: WorkOrderOptionFilter
  hardware: WorkOrderOptionFilter
  sort: WorkOrderSort
  page: number
  size: WorkOrderPageSize
}

const DEFAULT_FILTERS: WorkOrderListFilters = {
  q: '',
  servicem8Status: 'Work Order',
  risk: 'all',
  importance: 'all',
  installer: 'all',
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
  const servicem8Status = stringValue(searchParams.servicem8Status)?.trim() || DEFAULT_FILTERS.servicem8Status
  const risk = levelValue(searchParams.risk)
  const importance = levelValue(searchParams.importance)
  const installer = optionValue(searchParams.installer)
  const stage = optionValue(searchParams.stage)
  const hardware = optionValue(searchParams.hardware)
  const sortCandidate = stringValue(searchParams.sort) as WorkOrderSort | undefined
  const page = Number(stringValue(searchParams.page) ?? DEFAULT_FILTERS.page)
  const size = Number(stringValue(searchParams.size) ?? DEFAULT_FILTERS.size)

  return {
    q,
    servicem8Status,
    risk,
    importance,
    installer,
    stage,
    hardware,
    sort: sortCandidate && SORTS.has(sortCandidate) ? sortCandidate : DEFAULT_FILTERS.sort,
    page: Number.isInteger(page) && page > 0 ? page : DEFAULT_FILTERS.page,
    size: SIZES.has(size as WorkOrderPageSize) ? size as WorkOrderPageSize : DEFAULT_FILTERS.size,
  }
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
