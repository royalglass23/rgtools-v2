'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { LeadsListFilters } from './queries'
import { batchDeleteLeadsAction } from './actions'

type LeadRow = {
  id: string
  createdAt: Date
  clientName: string
  companyName: string | null
  location: string | null
  projectType: string | null
  tier: string | null
  seedScore: number | null
  servicem8JobUuid: string | null
  syncStatus: string
  completeness: number | null
}

export function LeadsTableControls({
  filters,
  rows,
  total,
  pageCount,
  isAdmin,
  basePath = '/leads',
  paramPrefix = '',
}: {
  filters: LeadsListFilters
  rows: LeadRow[]
  total: number
  pageCount: number
  isAdmin: boolean
  /** Path the filter form + pagination links target. Defaults to the Leads page. */
  basePath?: string
  /** Prefix applied to query param names so multiple tables can coexist on one URL. */
  paramPrefix?: string
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const allVisibleSelected = rows.length > 0 && rows.every((lead) => selectedSet.has(lead.id))

  function toggleLead(leadId: string) {
    setSelectedIds((current) => (
      current.includes(leadId)
        ? current.filter((id) => id !== leadId)
        : [...current, leadId]
    ))
  }

  function toggleAllVisible() {
    setSelectedIds(allVisibleSelected ? [] : rows.map((lead) => lead.id))
  }

  return (
    <>
      <FilterBar filters={filters} basePath={basePath} paramPrefix={paramPrefix} />

      {isAdmin && (
        <form
          action={batchDeleteLeadsAction}
          onSubmit={(event) => {
            if (selectedIds.length === 0) {
              event.preventDefault()
              return
            }

            if (!window.confirm(`Delete ${selectedIds.length} selected lead${selectedIds.length === 1 ? '' : 's'}? This cannot be undone.`)) {
              event.preventDefault()
            }
          }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <span className="text-sm text-gray-600">{selectedIds.length} selected</span>
            <button
              type="submit"
              disabled={selectedIds.length === 0}
              className="rounded border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete selected
            </button>
          </div>

          {selectedIds.map((leadId) => (
            <input key={leadId} type="hidden" name="leadId" value={leadId} />
          ))}

          <LeadsTable
            rows={rows}
            isAdmin={isAdmin}
            selectedSet={selectedSet}
            allVisibleSelected={allVisibleSelected}
            onToggleLead={toggleLead}
            onToggleAllVisible={toggleAllVisible}
          />
        </form>
      )}

      {!isAdmin && (
        <LeadsTable
          rows={rows}
          isAdmin={isAdmin}
          selectedSet={selectedSet}
          allVisibleSelected={allVisibleSelected}
          onToggleLead={toggleLead}
          onToggleAllVisible={toggleAllVisible}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <span>{total} leads</span>
        <div className="flex items-center gap-2">
          <PageLink filters={filters} page={Math.max(1, filters.page - 1)} disabled={filters.page <= 1} basePath={basePath} paramPrefix={paramPrefix}>Previous</PageLink>
          <span>Page {filters.page} of {pageCount}</span>
          <PageLink filters={filters} page={Math.min(pageCount, filters.page + 1)} disabled={filters.page >= pageCount} basePath={basePath} paramPrefix={paramPrefix}>Next</PageLink>
        </div>
      </div>
    </>
  )
}

function FilterBar({ filters, basePath, paramPrefix }: { filters: LeadsListFilters; basePath: string; paramPrefix: string }) {
  const searchParams = useSearchParams()
  const owned = new Set(
    ['tier', 'sm8', 'date', 'size', 'page'].map((name) => `${paramPrefix}${name}`),
  )
  const carryOver = Array.from(searchParams.entries()).filter(([key]) => !owned.has(key))

  return (
    <form action={basePath} className="grid gap-3 rounded border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-4">
      {carryOver.map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <Select name={`${paramPrefix}tier`} label="Tier" value={filters.tier} options={[['all', 'All'], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D']]} />
      <Select name={`${paramPrefix}sm8`} label="SM8" value={filters.sm8} options={[['all', 'All'], ['linked', 'Linked'], ['pending', 'Pending'], ['failed', 'Failed']]} />
      <Select name={`${paramPrefix}date`} label="Date" value={filters.date} options={[['7', 'Last 7 days'], ['30', 'Last 30 days'], ['all', 'All time']]} />
      <Select name={`${paramPrefix}size`} label="Page size" value={String(filters.size)} options={[['10', '10'], ['20', '20'], ['50', '50'], ['100', '100']]} />
      <input type="hidden" name={`${paramPrefix}page`} value="1" />
    </form>
  )
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: Array<[string, string]> }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <select
        name={name}
        defaultValue={value}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
      >
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  )
}

function LeadsTable({
  rows,
  isAdmin,
  selectedSet,
  allVisibleSelected,
  onToggleLead,
  onToggleAllVisible,
}: {
  rows: LeadRow[]
  isAdmin: boolean
  selectedSet: Set<string>
  allVisibleSelected: boolean
  onToggleLead: (leadId: string) => void
  onToggleAllVisible: () => void
}) {
  return (
    <div className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            {isAdmin && (
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={onToggleAllVisible}
                  aria-label="Select all visible leads"
                  className="h-4 w-4 rounded border-gray-300"
                />
              </th>
            )}
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
              {isAdmin && (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(lead.id)}
                    onChange={() => onToggleLead(lead.id)}
                    aria-label={`Select lead for ${lead.clientName}`}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </td>
              )}
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
              <td colSpan={isAdmin ? 9 : 8} className="px-4 py-8 text-center text-gray-500">No leads found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function PageLink({ filters, page, disabled, basePath, paramPrefix, children }: { filters: LeadsListFilters; page: number; disabled: boolean; basePath: string; paramPrefix: string; children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const params = new URLSearchParams(searchParams.toString())
  params.set(`${paramPrefix}tier`, filters.tier)
  params.set(`${paramPrefix}sm8`, filters.sm8)
  params.set(`${paramPrefix}date`, filters.date)
  params.set(`${paramPrefix}size`, String(filters.size))
  params.set(`${paramPrefix}page`, String(page))

  if (disabled) return <span className="rounded border border-gray-200 px-3 py-1.5 text-gray-400">{children}</span>
  return <Link href={`${basePath}?${params}`} className="rounded border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50">{children}</Link>
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
