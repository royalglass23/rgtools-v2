'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CopyLinkButton } from './CopyLinkButton'
import { isExpired } from './expiry'
import type { QuoteListFilters } from './list-filters'
import { StatusBadge, formatCurrency, formatRelative } from './presentation'
import type { StatusTag } from './score'

type QuoteRow = {
  id: string
  shortCode: string | null
  clientName: string
  companyName: string | null
  jobDescription: string | null
  jobAddress: string | null
  quoteValue: string | null
  statusTag: StatusTag | null
  aiScore: number | null
  totalOpens: number | null
  lastOpenedAt: Date | null
  forwardingSuspected: boolean | null
  expiresAt: Date | null
}

/** Param names this table owns; used for carry-over of other tables' params on shared URLs. */
const OWNED_PARAMS = ['search', 'status', 'linkStatus', 'sort', 'size', 'page'] as const

export function QuoteTableControls({
  filters,
  rows,
  total,
  pageCount,
  basePath = '/quote-tracker',
  paramPrefix = '',
}: {
  filters: QuoteListFilters
  rows: QuoteRow[]
  total: number
  pageCount: number
  /** Path the filter form + pagination links target. Defaults to the Quote Tracker page. */
  basePath?: string
  /** Prefix applied to query param names so multiple tables can coexist on one URL. */
  paramPrefix?: string
}) {
  return (
    <>
      <FilterBar filters={filters} basePath={basePath} paramPrefix={paramPrefix} />

      <div className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Job address</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Interest</th>
              <th className="px-4 py-3">Opens</th>
              <th className="px-4 py-3">Last opened</th>
              <th className="px-4 py-3">Link status</th>
              <th className="px-4 py-3">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((quote) => {
              const expired = isExpired(quote.expiresAt)
              const quoteUrl = !expired && quote.shortCode
                ? `https://quotes.royalglass.co.nz/q/${quote.shortCode}`
                : ''

              return (
                <tr key={quote.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/quote-tracker/${quote.id}`} className="block">
                      <span className="font-medium text-gray-950">{quote.clientName}</span>
                      {quote.companyName && <span className="block text-xs text-gray-500">{quote.companyName}</span>}
                    </Link>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-gray-700">
                    <Link href={`/quote-tracker/${quote.id}`} className="block truncate">
                      {quote.jobAddress ?? '-'}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    <Link href={`/quote-tracker/${quote.id}`} className="block">{formatCurrency(quote.quoteValue)}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/quote-tracker/${quote.id}`} className="block"><StatusBadge tag={quote.statusTag ?? 'cold'} /></Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <Link href={`/quote-tracker/${quote.id}`} className="block">{quote.aiScore ?? 0}/100</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <Link href={`/quote-tracker/${quote.id}`} className="block">{quote.totalOpens ?? 0}</Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    <Link href={`/quote-tracker/${quote.id}`} className="block">{formatRelative(quote.lastOpenedAt)}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/quote-tracker/${quote.id}`} className="block">
                      {expired ? (
                        <span className="inline-flex rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">Expired</span>
                      ) : (
                        <span className="inline-flex rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">Active</span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {quoteUrl ? <CopyLinkButton value={quoteUrl} /> : <span className="text-gray-400">-</span>}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  No tracked quotes yet. Use the Track Quote button to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <span>{total} tracked quotes</span>
        <div className="flex items-center gap-2">
          <PageLink filters={filters} page={Math.max(1, filters.page - 1)} disabled={filters.page <= 1} basePath={basePath} paramPrefix={paramPrefix}>Previous</PageLink>
          <span>Page {filters.page} of {pageCount}</span>
          <PageLink filters={filters} page={Math.min(pageCount, filters.page + 1)} disabled={filters.page >= pageCount} basePath={basePath} paramPrefix={paramPrefix}>Next</PageLink>
        </div>
      </div>
    </>
  )
}

function FilterBar({ filters, basePath, paramPrefix }: { filters: QuoteListFilters; basePath: string; paramPrefix: string }) {
  const searchParams = useSearchParams()
  const owned = new Set(OWNED_PARAMS.map((name) => `${paramPrefix}${name}`))
  const carryOver = Array.from(searchParams.entries()).filter(([key]) => !owned.has(key))
  const resetParams = new URLSearchParams(carryOver)
  resetParams.set(`${paramPrefix}status`, 'all')
  resetParams.set(`${paramPrefix}linkStatus`, 'active')
  resetParams.set(`${paramPrefix}sort`, 'last_opened')
  resetParams.set(`${paramPrefix}size`, '5')
  resetParams.set(`${paramPrefix}page`, '1')
  const resetHref = resetParams.toString() ? `${basePath}?${resetParams}` : basePath

  return (
    <form action={basePath} className="grid gap-3 rounded border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(180px,1fr)_150px_150px_190px_120px_auto]">
      {carryOver.map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Search</span>
        <input
          name={`${paramPrefix}search`}
          defaultValue={filters.search}
          placeholder="Client, address, company, code"
          className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
        />
      </label>
      <Select
        name={`${paramPrefix}status`}
        label="Status"
        value={filters.status}
        options={[['all', 'All'], ['hot', 'Hot'], ['warm', 'Warm'], ['cold', 'Cold'], ['dead', 'Dead']]}
      />
      <Select
        name={`${paramPrefix}linkStatus`}
        label="Link status"
        value={filters.linkStatus}
        options={[['active', 'Active'], ['expired', 'Expired'], ['all', 'All']]}
      />
      <Select
        name={`${paramPrefix}sort`}
        label="Sort"
        value={filters.sort}
        options={[
          ['last_opened', 'Latest opened'],
          ['client_asc', 'Client A-Z'],
          ['client_desc', 'Client Z-A'],
          ['value_asc', 'Value low-high'],
          ['value_desc', 'Value high-low'],
          ['interest_desc', 'Interest high-low'],
          ['interest_asc', 'Interest low-high'],
        ]}
      />
      <Select
        name={`${paramPrefix}size`}
        label="Page size"
        value={String(filters.size)}
        options={[['5', '5'], ['10', '10'], ['20', '20'], ['50', '50']]}
      />
      <input type="hidden" name={`${paramPrefix}page`} value="1" />
      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="rounded bg-[#142B3A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d3d52]"
        >
          Apply
        </button>
        <Link
          href={resetHref}
          className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Reset
        </Link>
      </div>
    </form>
  )
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string
  label: string
  value: string
  options: Array<[string, string]>
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <select
        name={name}
        value={value}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  )
}

function PageLink({
  filters,
  page,
  disabled,
  basePath,
  paramPrefix,
  children,
}: {
  filters: QuoteListFilters
  page: number
  disabled: boolean
  basePath: string
  paramPrefix: string
  children: React.ReactNode
}) {
  const searchParams = useSearchParams()
  if (disabled) return <span className="rounded border border-gray-200 px-3 py-1.5 text-gray-400">{children}</span>

  const params = new URLSearchParams(searchParams.toString())
  if (filters.search) params.set(`${paramPrefix}search`, filters.search)
  else params.delete(`${paramPrefix}search`)
  params.set(`${paramPrefix}status`, filters.status)
  params.set(`${paramPrefix}linkStatus`, filters.linkStatus)
  params.set(`${paramPrefix}sort`, filters.sort)
  params.set(`${paramPrefix}size`, String(filters.size))
  params.set(`${paramPrefix}page`, String(page))

  return <Link href={`${basePath}?${params}`} className="rounded border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50">{children}</Link>
}
