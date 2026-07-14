'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Fragment, useMemo, useState } from 'react'
import { batchDeleteWorkOrdersAction } from './actions'
import type { WorkOrderLevel } from './domain'
import type { WorkOrderListFilters, WorkOrderSort, WorkOrderSortDirection, WorkOrderSortKey } from './list-filters'
import type { WorkOrderRow } from './queries'
import type { WorkOrderSummaryFieldConfig } from './summary-config'
import { WorkOrderItemsSummary } from './WorkOrderItemsSummary'

type FilterOption = { id: string; label: string }

type WorkOrderFilterOptions = {
  stages: FilterOption[]
  hardwareStatuses: FilterOption[]
}

export function WorkOrdersTableControls({
  rows,
  filters,
  fields,
  options,
  total,
  pageCount,
  basePath = '/work-orders',
  paramPrefix = '',
  isAdmin = false,
}: {
  rows: WorkOrderRow[]
  filters: WorkOrderListFilters
  fields: WorkOrderSummaryFieldConfig[]
  options: WorkOrderFilterOptions
  total: number
  pageCount: number
  basePath?: string
  paramPrefix?: string
  isAdmin?: boolean
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedSet.has(row.id))

  function toggleWorkOrder(workOrderId: string) {
    setSelectedIds((current) => (
      current.includes(workOrderId)
        ? current.filter((id) => id !== workOrderId)
        : [...current, workOrderId]
    ))
  }

  function toggleAllVisible() {
    setSelectedIds(allVisibleSelected ? [] : rows.map((row) => row.id))
  }

  return (
    <>
      <WorkOrderFilters
        filters={filters}
        options={options}
        fields={fields}
        basePath={basePath}
        paramPrefix={paramPrefix}
      />
      {isAdmin && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{selectedIds.length} selected</span>
          <button
            type="submit"
            form="batch-delete-work-orders-form"
            disabled={selectedIds.length === 0}
            className="rounded border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete selected
          </button>
        </div>
      )}

      {isAdmin && (
        <form
          id="batch-delete-work-orders-form"
          action={batchDeleteWorkOrdersAction}
          onSubmit={(event) => {
            if (selectedIds.length === 0) {
              event.preventDefault()
              return
            }

            if (!window.confirm(`Delete ${selectedIds.length} selected Work Order${selectedIds.length === 1 ? '' : 's'}? This cannot be undone.`)) {
              event.preventDefault()
            }
          }}
        >
          {selectedIds.map((workOrderId) => (
            <input key={workOrderId} type="hidden" name="workOrderId" value={workOrderId} />
          ))}
        </form>
      )}

      <WorkOrdersTable
        rows={rows}
        filters={filters}
        fields={fields}
        basePath={basePath}
        paramPrefix={paramPrefix}
        isAdmin={isAdmin}
        selectedSet={selectedSet}
        allVisibleSelected={allVisibleSelected}
        onToggleWorkOrder={toggleWorkOrder}
        onToggleAllVisible={toggleAllVisible}
      />

      <div className="grid grid-cols-1 items-center gap-3 text-sm text-gray-600 md:grid-cols-3">
        <span>{total} work orders</span>
        <div className="flex items-center justify-center gap-2">
          <PageLink filters={filters} page={Math.max(1, filters.page - 1)} disabled={filters.page <= 1} basePath={basePath} paramPrefix={paramPrefix}>Previous</PageLink>
          <span>Page {filters.page} of {pageCount}</span>
          <PageLink filters={filters} page={Math.min(pageCount, filters.page + 1)} disabled={filters.page >= pageCount} basePath={basePath} paramPrefix={paramPrefix}>Next</PageLink>
        </div>
        <div className="flex justify-end">
          <PageSizeSelect filters={filters} basePath={basePath} paramPrefix={paramPrefix} />
        </div>
      </div>
    </>
  )
}

function WorkOrderFilters({
  filters,
  options,
  fields,
  basePath,
  paramPrefix,
}: {
  filters: WorkOrderListFilters
  options: WorkOrderFilterOptions
  fields: WorkOrderSummaryFieldConfig[]
  basePath: string
  paramPrefix: string
}) {
  const searchParams = useSearchParams()
  const owned = new Set(['q', 'current', 'risk', 'importance', 'stage', 'hardware', 'maintenanceProgram', 'showRemovedItems', 'sort', 'size', 'page'].map((name) => `${paramPrefix}${name}`))
  const carryOver = Array.from(searchParams.entries()).filter(([key]) => !owned.has(key))
  const resetParams = new URLSearchParams(carryOver)
  resetParams.set(`${paramPrefix}size`, String(filters.size))
  resetParams.set(`${paramPrefix}page`, '1')
  const resetHref = resetParams.toString() ? `${basePath}?${resetParams}` : basePath
  const filterable = new Set(fields.filter((field) => field.filterable).map((field) => field.id))

  return (
    <form action={basePath} className="grid items-end gap-3 rounded border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[minmax(320px,1.6fr)_repeat(5,minmax(150px,1fr))_minmax(180px,1fr)_auto]">
      {carryOver.map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <input type="hidden" name={`${paramPrefix}page`} value="1" />
      <input type="hidden" name={`${paramPrefix}size`} value={String(filters.size)} />
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Search</span>
        <div className="mt-1 flex gap-2">
          <input
            name={`${paramPrefix}q`}
            defaultValue={filters.q}
            placeholder="Client, address, job number"
            className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
          />
          <button type="submit" className="rounded bg-[#142B3A] px-3 py-2 text-sm font-medium text-white hover:bg-[#1d3d52]">
            Search
          </button>
        </div>
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name={`${paramPrefix}showRemovedItems`}
          value="1"
          defaultChecked={filters.showRemovedItems}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="h-4 w-4 rounded border-gray-300"
        />
        Show removed items
      </label>
      {filterable.has('importance') && <Select name={`${paramPrefix}importance`} label="Importance" value={filters.importance} options={[['all', 'All'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]} />}
      {filterable.has('risk') && <Select name={`${paramPrefix}risk`} label="Risk" value={filters.risk} options={[['all', 'All'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]} />}
      {filterable.has('stage') && <Select name={`${paramPrefix}stage`} label="Stage" value={filters.stage} options={[['all', 'All'], ...options.stages.map((option) => [option.id, option.label] as [string, string])]} />}
      {filterable.has('hardware') && <Select name={`${paramPrefix}hardware`} label="Hardware" value={filters.hardware} options={[['all', 'All'], ...options.hardwareStatuses.map((option) => [option.id, option.label] as [string, string])]} />}
      {filterable.has('maintenanceProgram') && <Select name={`${paramPrefix}maintenanceProgram`} label="Maintenance Program" value={filters.maintenanceProgram} options={[['all', 'All'], ['yes', 'Yes'], ['no', 'No']]} />}
      <Select
        name={`${paramPrefix}sort`}
        label="Sort"
        value={filters.sort}
        options={[
          ['lead_score_desc', 'Lead score high-low'],
          ['lead_score_asc', 'Lead score low-high'],
          ['importance_desc', 'Importance high-low'],
          ['importance_asc', 'Importance low-high'],
          ['risk_desc', 'Risk high-low'],
          ['risk_asc', 'Risk low-high'],
          ['install_date_asc', 'Install date asc'],
          ['install_date_desc', 'Install date desc'],
          ['client_asc', 'Client A-Z'],
          ['client_desc', 'Client Z-A'],
          ['job_number_asc', 'Job number asc'],
          ['job_number_desc', 'Job number desc'],
        ]}
      />
      <div className="flex justify-end">
        <Link href={resetHref} className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Reset
        </Link>
      </div>
    </form>
  )
}

function WorkOrdersTable({
  rows,
  filters,
  fields,
  basePath,
  paramPrefix,
  isAdmin,
  selectedSet,
  allVisibleSelected,
  onToggleWorkOrder,
  onToggleAllVisible,
}: {
  rows: WorkOrderRow[]
  filters: WorkOrderListFilters
  fields: WorkOrderSummaryFieldConfig[]
  basePath: string
  paramPrefix: string
  isAdmin: boolean
  selectedSet: Set<string>
  allVisibleSelected: boolean
  onToggleWorkOrder: (workOrderId: string) => void
  onToggleAllVisible: () => void
}) {
  const searchParams = useSearchParams()
  const emptyMessage = hasActiveListFilters(filters)
    ? 'No Work Orders match these filters.'
    : 'No current Work Orders yet.'
  const visibleFields = fields.filter((field) => field.visible)

  return (
    <div className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1280px] table-auto divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              {isAdmin && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={onToggleAllVisible}
                    aria-label="Select all visible Work Orders"
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </th>
              )}
              {visibleFields.map((field) => (
                <SortHeader
                  key={field.id}
                  field={field}
                  filters={filters}
                  basePath={basePath}
                  paramPrefix={paramPrefix}
                  searchParams={searchParams}
                />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <Fragment key={row.id}>
                <tr className="hover:bg-gray-50">
                  {isAdmin && (
                    <td className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(row.id)}
                        onChange={() => onToggleWorkOrder(row.id)}
                        aria-label={`Select Work Order for ${row.clientName}`}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </td>
                  )}
                  {visibleFields.map((field) => <SummaryCell key={field.id} field={field} row={row} />)}
                </tr>
                <tr className="bg-white">
                  <td colSpan={visibleFields.length + (isAdmin ? 1 : 0)}>
                    <WorkOrderItemsSummary items={row.items} />
                  </td>
                </tr>
              </Fragment>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={visibleFields.length + (isAdmin ? 1 : 0)} className="px-4 py-8 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SortHeader({
  field,
  filters,
  basePath,
  paramPrefix,
  searchParams,
}: {
  field: WorkOrderSummaryFieldConfig
  filters: WorkOrderListFilters
  basePath: string
  paramPrefix: string
  searchParams: ReturnType<typeof useSearchParams>
}) {
  const sortKey = sortKeyForField(field.id)
  const current = splitSort(filters.sort)
  const isActive = current.key === sortKey
  const direction = isActive ? current.direction : defaultDirectionFor(sortKey)
  const nextDirection = isActive ? oppositeDirection(direction) : direction
  const params = paramsFor(filters, paramPrefix, searchParams)
  params.set(`${paramPrefix}sort`, `${sortKey}_${nextDirection}` as WorkOrderSort)
  params.set(`${paramPrefix}page`, '1')

  return (
    <th className="px-4 py-3">
      <Link
        href={`${basePath}?${params}`}
        className="inline-flex items-center gap-1 rounded text-left hover:text-gray-950 focus:outline-none focus:ring-2 focus:ring-[#142B3A] focus:ring-offset-2"
        aria-label={`Sort by ${field.label} ${nextDirection === 'asc' ? 'ascending' : 'descending'}`}
      >
        <span>{field.label}</span>
        <span className={isActive ? 'text-gray-700' : 'text-gray-300'}>{isActive ? (direction === 'asc' ? '↑' : '↓') : '↕'}</span>
      </Link>
    </th>
  )
}

function SummaryCell({ field, row }: { field: WorkOrderSummaryFieldConfig; row: WorkOrderRow }) {
  const href = `/work-orders/${row.id}`

  if (field.id === 'client') {
    return (
      <td className="align-top">
        <Link href={href} className="block px-4 py-3">
          <span className="font-medium text-gray-950">{row.clientName}</span>
          {row.companyName && <span className="block text-xs text-gray-500">{row.companyName}</span>}
        </Link>
      </td>
    )
  }
  if (field.id === 'jobNumber') {
    return (
      <LinkedCell href={href}>
        <span>{row.jobNumber ?? '-'}</span>
        <span className="mt-1 block text-xs text-gray-500">
          {row.activeItemCount} active {row.activeItemCount === 1 ? 'item' : 'items'}
        </span>
      </LinkedCell>
    )
  }
  if (field.id === 'importance') return <LinkedCell href={href}><LevelBadge level={row.importance} /></LinkedCell>
  if (field.id === 'risk') return <LinkedCell href={href}><LevelBadge level={row.riskLevel} /></LinkedCell>
  const values: Record<string, string | number | null> = {
    jobNumber: row.jobNumber,
    jobAddress: row.jobAddress,
    leadScore: row.leadScore,
    installer: row.installerName,
    stage: row.stageName,
    hardware: row.hardwareStatusName,
    maintenanceProgram: row.maintenanceProgram ? 'Yes' : 'No',
    installDate: formatNullableDate(row.installDate),
    dateCompleted: formatNullableDate(row.dateCompleted),
    servicem8Status: row.servicem8Status,
    jobDescription: row.jobDescription,
  }
  return <LinkedCell href={href}>{values[field.id] ?? '-'}</LinkedCell>
}

function LinkedCell({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <td className="align-top text-gray-700">
      <Link href={href} className="block px-4 py-3">
        {children}
      </Link>
    </td>
  )
}

function hasActiveListFilters(filters: WorkOrderListFilters) {
  return Boolean(filters.q)
    || filters.risk !== 'all'
    || filters.importance !== 'all'
    || filters.stage !== 'all'
    || filters.hardware !== 'all'
    || filters.maintenanceProgram !== 'all'
    || filters.showRemovedItems
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: Array<[string, string]> }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <select
        aria-label={label}
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

function LevelBadge({ level }: { level: WorkOrderLevel | null }) {
  if (!level) return <span className="text-gray-400">-</span>
  const classes = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-amber-100 text-amber-800',
    low: 'bg-green-100 text-green-800',
  }[level]
  return <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${classes}`}>{titleCase(level)}</span>
}

function PageLink({
  filters,
  page,
  disabled,
  basePath,
  paramPrefix,
  children,
}: {
  filters: WorkOrderListFilters
  page: number
  disabled: boolean
  basePath: string
  paramPrefix: string
  children: React.ReactNode
}) {
  if (disabled) return <span className="rounded border border-gray-200 px-3 py-1.5 text-gray-400">{children}</span>
  const params = paramsFor(filters, paramPrefix)
  params.set(`${paramPrefix}page`, String(page))
  return <Link href={`${basePath}?${params}`} className="rounded border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50">{children}</Link>
}

function PageSizeSelect({ filters, basePath, paramPrefix }: { filters: WorkOrderListFilters; basePath: string; paramPrefix: string }) {
  return (
    <form action={basePath} className="flex items-center gap-2">
      {Array.from(paramsFor(filters, paramPrefix).entries())
        .filter(([key]) => key !== `${paramPrefix}size` && key !== `${paramPrefix}page`)
        .map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      <input type="hidden" name={`${paramPrefix}page`} value="1" />
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <span className="whitespace-nowrap">Page size</span>
        <select
          aria-label="Page size"
          name={`${paramPrefix}size`}
          defaultValue={String(filters.size)}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-950"
        >
          {(['10', '20', '50', '100'] as const).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
    </form>
  )
}

function paramsFor(filters: WorkOrderListFilters, paramPrefix: string, searchParams?: ReturnType<typeof useSearchParams>) {
  const params = new URLSearchParams()
  if (searchParams) {
    const owned = new Set(['q', 'current', 'risk', 'importance', 'stage', 'hardware', 'maintenanceProgram', 'showRemovedItems', 'sort', 'size', 'page'].map((name) => `${paramPrefix}${name}`))
    for (const [key, value] of searchParams.entries()) {
      if (!owned.has(key)) params.append(key, value)
    }
  }
  if (filters.q) params.set(`${paramPrefix}q`, filters.q)
  params.set(`${paramPrefix}current`, filters.current)
  params.set(`${paramPrefix}risk`, filters.risk)
  params.set(`${paramPrefix}importance`, filters.importance)
  params.set(`${paramPrefix}stage`, filters.stage)
  params.set(`${paramPrefix}hardware`, filters.hardware)
  params.set(`${paramPrefix}maintenanceProgram`, filters.maintenanceProgram)
  if (filters.showRemovedItems) params.set(`${paramPrefix}showRemovedItems`, '1')
  params.set(`${paramPrefix}sort`, filters.sort)
  params.set(`${paramPrefix}size`, String(filters.size))
  params.set(`${paramPrefix}page`, String(filters.page))
  return params
}

function sortKeyForField(fieldId: WorkOrderSummaryFieldConfig['id']): WorkOrderSortKey {
  const keys: Record<WorkOrderSummaryFieldConfig['id'], WorkOrderSortKey> = {
    client: 'client',
    jobNumber: 'job_number',
    jobAddress: 'job_address',
    leadScore: 'lead_score',
    importance: 'importance',
    risk: 'risk',
    installer: 'installer',
    stage: 'stage',
    hardware: 'hardware',
    maintenanceProgram: 'maintenance_program',
    installDate: 'install_date',
    dateCompleted: 'date_completed',
    servicem8Status: 'servicem8_status',
    jobDescription: 'job_description',
  }
  return keys[fieldId]
}

function splitSort(sort: WorkOrderSort): { key: WorkOrderSortKey; direction: WorkOrderSortDirection } {
  const direction = sort.endsWith('_asc') ? 'asc' : 'desc'
  return {
    key: sort.slice(0, -`_${direction}`.length) as WorkOrderSortKey,
    direction,
  }
}

function defaultDirectionFor(key: WorkOrderSortKey): WorkOrderSortDirection {
  if (key === 'client'
    || key === 'job_number'
    || key === 'job_address'
    || key === 'installer'
    || key === 'stage'
    || key === 'hardware'
    || key === 'maintenance_program'
    || key === 'servicem8_status'
    || key === 'job_description') {
    return 'asc'
  }
  return 'desc'
}

function oppositeDirection(direction: WorkOrderSortDirection): WorkOrderSortDirection {
  return direction === 'asc' ? 'desc' : 'asc'
}

function formatNullableDate(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
