import Link from 'next/link'
import { requireModule } from '@/lib/guard'
import { CopyLinkButton } from '@/modules/quote-tracker/CopyLinkButton'
import { listQuotes } from '@/modules/quote-tracker/queries'
import { parseQuoteListFilters, type QuoteListFilters } from '@/modules/quote-tracker/list-filters'
import { STATUS_TAG_RULES, type StatusTag } from '@/modules/quote-tracker/score'

export default async function QuoteTrackerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireModule('quote-tracker')
  const filters = parseQuoteListFilters(await searchParams)
  const { rows, total, pageCount, kpis } = await listQuotes(filters)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-950">Quote Tracker</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Hot quotes" value={String(kpis.hotCount)} tone="red" />
        <KpiCard label="Warm quotes" value={String(kpis.warmCount)} tone="amber" />
        <KpiCard label="Cold quotes" value={String(kpis.coldCount)} tone="blue" />
        <KpiCard label="Dead quotes" value={String(kpis.deadCount)} tone="gray" />
        <KpiCard label="Total value" value={formatCurrency(kpis.totalValue)} tone="green" />
        <KpiCard label="Avg interest" value={`${kpis.averageScore}/100`} tone="slate" />
        <KpiCard label="Forwarding flags" value={String(kpis.forwardingCount)} tone="amber" />
      </div>

      <form action="/quote-tracker" className="grid gap-3 rounded border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(180px,1fr)_160px_190px_120px_auto]">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Search</span>
          <input
            name="search"
            defaultValue={filters.search}
            placeholder="Client, address, company, code"
            className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
          />
        </label>
        <Select
          name="status"
          label="Status"
          value={filters.status}
          options={[['all', 'All'], ['hot', 'Hot'], ['warm', 'Warm'], ['cold', 'Cold'], ['dead', 'Dead']]}
        />
        <Select
          name="sort"
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
          name="size"
          label="Page size"
          value={String(filters.size)}
          options={[['10', '10'], ['20', '20'], ['50', '50']]}
        />
        <input type="hidden" name="page" value="1" />
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded bg-[#142B3A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d3d52]"
          >
            Apply
          </button>
          <Link
            href="/quote-tracker"
            className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reset
          </Link>
        </div>
      </form>

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
              <th className="px-4 py-3">Forwarding</th>
              <th className="px-4 py-3">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((quote) => {
              const quoteUrl = quote.shortCode
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
                      {quote.forwardingSuspected ? (
                        <span className="inline-flex rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">Flagged</span>
                      ) : (
                        <span className="text-gray-400">-</span>
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
                  No tracked quotes yet. Create one from a lead.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <span>{total} tracked quotes</span>
        <div className="flex items-center gap-2">
          <PageLink filters={filters} page={Math.max(1, filters.page - 1)} disabled={filters.page <= 1}>Previous</PageLink>
          <span>Page {filters.page} of {pageCount}</span>
          <PageLink filters={filters} page={Math.min(pageCount, filters.page + 1)} disabled={filters.page >= pageCount}>Next</PageLink>
        </div>
      </div>

      <details className="rounded border border-gray-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-950">
          How status is computed
        </summary>
        <div className="border-t border-gray-100 p-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {(['hot', 'warm', 'cold', 'dead'] as StatusTag[]).map((tag) => (
              <div key={tag}>
                <dt><StatusBadge tag={tag} /></dt>
                <dd className="mt-2 text-gray-600">{STATUS_TAG_RULES[tag]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-gray-500">Manual overrides win over computed status.</p>
        </div>
      </details>
    </div>
  )
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'red' | 'green' | 'slate' | 'amber' | 'gray' }) {
  const classes = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    green: 'border-green-200 bg-green-50 text-green-900',
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    gray: 'border-gray-200 bg-gray-50 text-gray-800',
  }[tone]

  return (
    <div className={`rounded border p-4 shadow-sm ${classes}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-75">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
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
        defaultValue={value}
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
  children,
}: {
  filters: QuoteListFilters
  page: number
  disabled: boolean
  children: React.ReactNode
}) {
  if (disabled) return <span className="rounded border border-gray-200 px-3 py-1.5 text-gray-400">{children}</span>

  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  params.set('status', filters.status)
  params.set('sort', filters.sort)
  params.set('size', String(filters.size))
  params.set('page', String(page))

  return <Link href={`/quote-tracker?${params}`} className="rounded border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50">{children}</Link>
}

function StatusBadge({ tag }: { tag: StatusTag }) {
  const classes: Record<StatusTag, string> = {
    hot: 'bg-red-100 text-red-800',
    warm: 'bg-amber-100 text-amber-800',
    cold: 'bg-blue-100 text-blue-800',
    dead: 'bg-gray-100 text-gray-700',
  }

  return <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold capitalize ${classes[tag]}`}>{tag}</span>
}

function formatCurrency(value: string | null) {
  const numeric = Number(value ?? 0)
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(numeric)
}

function formatRelative(date: Date | null) {
  if (!date) return 'Never'

  const diffMs = date.getTime() - Date.now()
  const absMs = Math.abs(diffMs)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['day', 24 * 60 * 60 * 1000],
    ['hour', 60 * 60 * 1000],
    ['minute', 60 * 1000],
  ]
  const rtf = new Intl.RelativeTimeFormat('en-NZ', { numeric: 'auto' })

  for (const [unit, ms] of units) {
    if (absMs >= ms) return rtf.format(Math.round(diffMs / ms), unit)
  }

  return 'Just now'
}
