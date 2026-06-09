import Link from 'next/link'
import { getLeadsList, parseLeadsListFilters, type LeadsListFilters } from '@/modules/leads/queries'

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseLeadsListFilters(await searchParams)
  const { rows, total, pageCount } = await getLeadsList(filters)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-950">Leads</h1>
        <Link
          href="/lead-intake"
          className="rounded bg-[#142B3A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d3d52]"
        >
          New Lead
        </Link>
      </div>

      <FilterBar filters={filters} />

      <div className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Job Address</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">SM8</th>
              <th className="px-4 py-3">Completeness</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                  <Link href={`/leads/${lead.id}`} className="block">
                    {formatDate(lead.createdAt)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} className="block">
                    <span className="font-medium text-gray-950">{lead.clientName}</span>
                    {lead.companyName && <span className="block text-xs text-gray-500">{lead.companyName}</span>}
                  </Link>
                </td>
                <td className="max-w-xs px-4 py-3 text-gray-700">
                  <Link href={`/leads/${lead.id}`} className="block truncate">{lead.location ?? '-'}</Link>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <Link href={`/leads/${lead.id}`} className="block">{lead.projectType ?? '-'}</Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} className="block"><TierBadge tier={lead.tier} /></Link>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <Link href={`/leads/${lead.id}`} className="block">{lead.seedScore ?? 0}</Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} className="block"><Sm8Badge linked={Boolean(lead.servicem8JobUuid)} status={lead.syncStatus} /></Link>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <Link href={`/leads/${lead.id}`} className="block">{lead.completeness ?? 0}%</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No leads found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <span>{total} leads</span>
        <div className="flex items-center gap-2">
          <PageLink filters={filters} page={Math.max(1, filters.page - 1)} disabled={filters.page <= 1}>Previous</PageLink>
          <span>Page {filters.page} of {pageCount}</span>
          <PageLink filters={filters} page={Math.min(pageCount, filters.page + 1)} disabled={filters.page >= pageCount}>Next</PageLink>
        </div>
      </div>
    </div>
  )
}

function FilterBar({ filters }: { filters: LeadsListFilters }) {
  return (
    <form className="grid gap-3 rounded border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-4">
      <Select name="tier" label="Tier" value={filters.tier} options={[['all', 'All'], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D']]} />
      <Select name="sm8" label="SM8" value={filters.sm8} options={[['all', 'All'], ['linked', 'Linked'], ['pending', 'Pending'], ['failed', 'Failed']]} />
      <Select name="date" label="Date" value={filters.date} options={[['7', 'Last 7 days'], ['30', 'Last 30 days'], ['all', 'All time']]} />
      <Select name="size" label="Page size" value={String(filters.size)} options={[['10', '10'], ['20', '20'], ['50', '50'], ['100', '100']]} />
      <input type="hidden" name="page" value="1" />
      <div className="sm:col-span-4">
        <button type="submit" className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Apply
        </button>
      </div>
    </form>
  )
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: Array<[string, string]> }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <select name={name} defaultValue={value} className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  )
}

function PageLink({ filters, page, disabled, children }: { filters: LeadsListFilters; page: number; disabled: boolean; children: React.ReactNode }) {
  const params = new URLSearchParams({
    tier: filters.tier,
    sm8: filters.sm8,
    date: filters.date,
    size: String(filters.size),
    page: String(page),
  })

  if (disabled) return <span className="rounded border border-gray-200 px-3 py-1.5 text-gray-400">{children}</span>
  return <Link href={`/leads?${params}`} className="rounded border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50">{children}</Link>
}

function TierBadge({ tier }: { tier: string | null }) {
  const classes = {
    A: 'bg-green-100 text-green-800',
    B: 'bg-blue-100 text-blue-800',
    C: 'bg-yellow-100 text-yellow-800',
    D: 'bg-gray-100 text-gray-700',
  }[tier ?? 'D']

  return <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${classes}`}>{tier ?? 'D'}</span>
}

function Sm8Badge({ linked, status }: { linked: boolean; status: string }) {
  if (linked) return <span className="inline-flex rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">Linked</span>
  if (status === 'sync_failed') return <span className="inline-flex rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">Failed</span>
  return <span className="inline-flex rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Pending</span>
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short' }).format(date)
}
