import Link from 'next/link'
import { requireModule } from '@/lib/guard'
import { refreshWorkOrdersAction } from '@/modules/work-orders/actions'
import type { WorkOrderLevel } from '@/modules/work-orders/domain'
import { parseWorkOrderListFilters, type WorkOrderListFilters } from '@/modules/work-orders/list-filters'
import { getWorkOrderFilterOptions, listWorkOrders, type WorkOrderRow } from '@/modules/work-orders/queries'

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireModule('work-orders')
  const filters = parseWorkOrderListFilters(await searchParams)
  const [{ rows, total, pageCount }, options] = await Promise.all([
    listWorkOrders(filters),
    getWorkOrderFilterOptions(),
  ])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Work Orders</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total} jobs shown from saved RG Tools records
          </p>
        </div>
        <form action={refreshWorkOrdersAction}>
          <button
            type="submit"
            className="rounded bg-[#142B3A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d3d52]"
          >
            Refresh from ServiceM8
          </button>
        </form>
      </div>

      <WorkOrderFilters filters={filters} options={options} />
      <WorkOrdersTable rows={rows} />

      <div className="grid grid-cols-3 items-center gap-3 text-sm text-gray-600">
        <span>{total} work orders</span>
        <div className="flex items-center justify-center gap-2">
          <PageLink filters={filters} page={Math.max(1, filters.page - 1)} disabled={filters.page <= 1}>Previous</PageLink>
          <span>Page {filters.page} of {pageCount}</span>
          <PageLink filters={filters} page={Math.min(pageCount, filters.page + 1)} disabled={filters.page >= pageCount}>Next</PageLink>
        </div>
        <div className="flex justify-end">
          <PageSizeSelect filters={filters} />
        </div>
      </div>
    </div>
  )
}

function WorkOrderFilters({
  filters,
  options,
}: {
  filters: WorkOrderListFilters
  options: Awaited<ReturnType<typeof getWorkOrderFilterOptions>>
}) {
  const resetHref = `/work-orders?size=${filters.size}`
  const statusOptions = Array.from(new Set(['Work Order', ...options.statuses, 'all']))

  return (
    <form action="/work-orders" className="grid gap-3 rounded border border-gray-200 bg-white p-4 shadow-sm lg:grid-cols-8">
      <input type="hidden" name="page" value="1" />
      <input type="hidden" name="size" value={String(filters.size)} />
      <label className="block lg:col-span-2">
        <span className="text-xs font-medium text-gray-600">Search</span>
        <div className="mt-1 flex gap-2">
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Client, address, job number"
            className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
          />
          <button type="submit" className="rounded bg-[#142B3A] px-3 py-2 text-sm font-medium text-white hover:bg-[#1d3d52]">
            Search
          </button>
        </div>
      </label>
      <Select name="servicem8Status" label="SM8 Status" value={filters.servicem8Status} options={statusOptions.map((status) => [status, status === 'all' ? 'All' : status])} />
      <Select name="risk" label="Risk" value={filters.risk} options={[['all', 'All'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]} />
      <Select name="importance" label="Importance" value={filters.importance} options={[['all', 'All'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]} />
      <Select name="installer" label="Installer" value={filters.installer} options={[['all', 'All'], ...options.installers.map((option) => [option.id, option.label] as [string, string])]} />
      <Select name="stage" label="Stage" value={filters.stage} options={[['all', 'All'], ...options.stages.map((option) => [option.id, option.label] as [string, string])]} />
      <Select name="hardware" label="Hardware" value={filters.hardware} options={[['all', 'All'], ...options.hardwareStatuses.map((option) => [option.id, option.label] as [string, string])]} />
      <Select
        name="sort"
        label="Sort"
        value={filters.sort}
        options={[
          ['lead_score', 'Lead score'],
          ['importance', 'Importance'],
          ['risk', 'Risk'],
          ['install_date', 'Install date'],
          ['client_asc', 'Client A-Z'],
          ['job_number', 'Job number'],
        ]}
      />
      <div className="flex items-end justify-end gap-2">
        <button type="submit" className="rounded bg-[#142B3A] px-3 py-2 text-sm font-medium text-white hover:bg-[#1d3d52]">
          Apply
        </button>
        <Link href={resetHref} className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Reset
        </Link>
      </div>
    </form>
  )
}

function WorkOrdersTable({ rows }: { rows: WorkOrderRow[] }) {
  return (
    <div className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1500px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Job</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Importance</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Installer</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Hardware</th>
              <th className="px-4 py-3">Install date</th>
              <th className="px-4 py-3">AI suggestion</th>
              <th className="px-4 py-3">Client notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 align-top">
                  <span className="font-medium text-gray-950">{row.clientName}</span>
                  {row.companyName && <span className="block text-xs text-gray-500">{row.companyName}</span>}
                  <span className="mt-1 inline-flex rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{row.servicem8Status}</span>
                </td>
                <td className="max-w-xs px-4 py-3 align-top text-gray-700">
                  <span className="font-medium text-gray-900">{row.jobNumber ?? '-'}</span>
                  <span className="block truncate">{row.jobAddress ?? '-'}</span>
                  <span className="block truncate text-xs text-gray-500">{row.jobDescription ?? '-'}</span>
                </td>
                <td className="px-4 py-3 align-top text-gray-700">{row.leadScore ?? '-'}</td>
                <td className="px-4 py-3 align-top"><LevelBadge level={row.importance} /></td>
                <td className="px-4 py-3 align-top"><LevelBadge level={row.riskLevel} /></td>
                <td className="px-4 py-3 align-top text-gray-700">{row.installerName ?? '-'}</td>
                <td className="px-4 py-3 align-top text-gray-700">{row.stageName ?? '-'}</td>
                <td className="px-4 py-3 align-top text-gray-700">{row.hardwareStatusName ?? '-'}</td>
                <td className="px-4 py-3 align-top text-gray-700">{formatNullableDate(row.installDate)}</td>
                <td className="max-w-xs px-4 py-3 align-top text-gray-700"><span className="block truncate">{row.aiSuggestion ?? '-'}</span></td>
                <td className="max-w-xs px-4 py-3 align-top text-gray-700"><span className="block truncate">{row.clientApproachNote ?? row.clientContextSummary ?? '-'}</span></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                  No work orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: Array<[string, string]> }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
      >
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  )
}

function LevelBadge({ level }: { level: WorkOrderLevel | null }) {
  if (!level) return <span className="text-gray-400">-</span>
  const classes = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-amber-100 text-amber-800',
    low: 'bg-green-100 text-green-800',
  }[level]
  return <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${classes}`}>{titleCase(level)}</span>
}

function PageLink({ filters, page, disabled, children }: { filters: WorkOrderListFilters; page: number; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span className="rounded border border-gray-200 px-3 py-1.5 text-gray-400">{children}</span>
  const params = paramsFor(filters)
  params.set('page', String(page))
  return <Link href={`/work-orders?${params}`} className="rounded border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50">{children}</Link>
}

function PageSizeSelect({ filters }: { filters: WorkOrderListFilters }) {
  return (
    <form action="/work-orders" className="flex items-center gap-2">
      {Array.from(paramsFor(filters).entries())
        .filter(([key]) => key !== 'size' && key !== 'page')
        .map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      <input type="hidden" name="page" value="1" />
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <span className="whitespace-nowrap">Page size</span>
        <select
          name="size"
          defaultValue={String(filters.size)}
          className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-950"
        >
          {(['10', '20', '50', '100'] as const).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <button type="submit" className="rounded border border-gray-300 px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
        Apply
      </button>
    </form>
  )
}

function paramsFor(filters: WorkOrderListFilters) {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  params.set('servicem8Status', filters.servicem8Status)
  params.set('risk', filters.risk)
  params.set('importance', filters.importance)
  params.set('installer', filters.installer)
  params.set('stage', filters.stage)
  params.set('hardware', filters.hardware)
  params.set('sort', filters.sort)
  params.set('size', String(filters.size))
  params.set('page', String(filters.page))
  return params
}

function formatNullableDate(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
