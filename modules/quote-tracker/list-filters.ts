import type { StatusTag } from './score'

export type QuoteListStatus = StatusTag | 'all'
export type QuoteListSort =
  | 'last_opened'
  | 'client_asc'
  | 'client_desc'
  | 'value_asc'
  | 'value_desc'
  | 'interest_asc'
  | 'interest_desc'
export type QuoteListPageSize = 10 | 20 | 50

export type QuoteListFilters = {
  search: string
  status: QuoteListStatus
  sort: QuoteListSort
  page: number
  size: QuoteListPageSize
}

export function parseQuoteListFilters(
  searchParams: Record<string, string | string[] | undefined>,
): QuoteListFilters {
  const status = stringValue(searchParams.status)
  const sort = stringValue(searchParams.sort)
  const page = Number(stringValue(searchParams.page) ?? '1')
  const size = Number(stringValue(searchParams.size) ?? '10')

  return {
    search: (stringValue(searchParams.search) ?? '').trim(),
    status: isQuoteListStatus(status) ? status : 'all',
    sort: isQuoteListSort(sort) ? sort : 'last_opened',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    size: size === 20 || size === 50 ? size : 10,
  }
}

function stringValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function isQuoteListStatus(value: string | undefined): value is QuoteListStatus {
  return value === 'all' || value === 'hot' || value === 'warm' || value === 'cold' || value === 'dead'
}

function isQuoteListSort(value: string | undefined): value is QuoteListSort {
  return (
    value === 'last_opened' ||
    value === 'client_asc' ||
    value === 'client_desc' ||
    value === 'value_asc' ||
    value === 'value_desc' ||
    value === 'interest_asc' ||
    value === 'interest_desc'
  )
}
