'use client'

import { useActionState, useMemo, useState } from 'react'
import {
  DASHBOARD_TABLES,
  MAX_DASHBOARD_TABLES,
  defaultFilterFor,
  getTableMeta,
  type DashboardTableConfig,
  type DashboardTableKey,
  type DashboardTableMeta,
} from '@/modules/dashboard/tables'
import { saveDashboardTables, type SaveDashboardTablesResult } from './actions'
import { DismissibleNotice } from '@/modules/ui/DismissibleNotice'

const emptyResult: SaveDashboardTablesResult | null = null

async function submit(
  _previous: SaveDashboardTablesResult | null,
  formData: FormData,
): Promise<SaveDashboardTablesResult> {
  return saveDashboardTables(formData)
}

export function DashboardTablesEditor({ initialConfig }: { initialConfig: DashboardTableConfig[] }) {
  const [selected, setSelected] = useState<DashboardTableConfig[]>(initialConfig)
  const [result, formAction, pending] = useActionState(submit, emptyResult)

  const selectedKeys = useMemo(() => new Set(selected.map((entry) => entry.key)), [selected])
  const atLimit = selected.length >= MAX_DASHBOARD_TABLES

  // Ticked tables come first in their chosen order (reorderable); unticked tables
  // are locked to the bottom in the canonical order and cannot be moved.
  const orderedMetas = useMemo<DashboardTableMeta[]>(() => {
    const selectedMetas = selected
      .map((entry) => getTableMeta(entry.key))
      .filter((meta): meta is DashboardTableMeta => Boolean(meta))
    const unselectedMetas = DASHBOARD_TABLES.filter((meta) => !selectedKeys.has(meta.key))
    return [...selectedMetas, ...unselectedMetas]
  }, [selected, selectedKeys])

  function toggle(key: DashboardTableKey) {
    setSelected((current) => {
      if (current.some((entry) => entry.key === key)) {
        return current.filter((entry) => entry.key !== key)
      }
      if (current.length >= MAX_DASHBOARD_TABLES) return current
      return [...current, { key, filter: defaultFilterFor(key) }]
    })
  }

  function move(key: DashboardTableKey, direction: -1 | 1) {
    setSelected((current) => {
      const index = current.findIndex((entry) => entry.key === key)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function setFilterValue(key: DashboardTableKey, field: string, value: string) {
    setSelected((current) =>
      current.map((entry) =>
        entry.key === key ? { ...entry, filter: { ...entry.filter, [field]: value } } : entry,
      ),
    )
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="config" value={JSON.stringify(selected)} />

      {result && 'success' in result && (
        <DismissibleNotice tone="success" noticeKey="dashboard-tables-saved">
          Dashboard tables saved.
        </DismissibleNotice>
      )}
      {result && 'error' in result && (
        <DismissibleNotice tone="error" noticeKey={result.error}>
          {result.error}
        </DismissibleNotice>
      )}

      <p className="text-sm text-gray-500">
        Choose up to {MAX_DASHBOARD_TABLES} tables to show on the dashboard and set each one&apos;s
        default filter. Users can still change filters live on the dashboard.
      </p>

      <div className="space-y-4">
        {orderedMetas.map((meta) => {
          const isSelected = selectedKeys.has(meta.key)
          const order = selected.findIndex((entry) => entry.key === meta.key)
          const entry = order >= 0 ? selected[order] : null
          const disableToggle = !meta.available || (!isSelected && atLimit)

          return (
            <section
              key={meta.key}
              className={`rounded border p-4 shadow-sm ${isSelected ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={disableToggle}
                    onChange={() => toggle(meta.key)}
                    className="h-4 w-4 rounded border-gray-300 disabled:opacity-50"
                  />
                  <span className="text-sm font-semibold text-gray-900">{meta.label}</span>
                  {!meta.available && (
                    <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                      Coming soon
                    </span>
                  )}
                </label>

                {isSelected && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-gray-400">#{order + 1}</span>
                    <button
                      type="button"
                      onClick={() => move(meta.key, -1)}
                      disabled={order <= 0}
                      className="rounded border border-gray-300 px-2 py-1 text-gray-600 disabled:opacity-40"
                      aria-label={`Move ${meta.label} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(meta.key, 1)}
                      disabled={order >= selected.length - 1}
                      className="rounded border border-gray-300 px-2 py-1 text-gray-600 disabled:opacity-40"
                      aria-label={`Move ${meta.label} down`}
                    >
                      ↓
                    </button>
                  </div>
                )}
              </div>

              {isSelected && entry && meta.filterFields.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  {meta.filterFields.map((field) => (
                    <label key={field.name} className="block">
                      <span className="text-xs font-medium text-gray-600">{field.label}</span>
                      <select
                        value={entry.filter[field.name] ?? field.default}
                        onChange={(event) => setFilterValue(meta.key, field.name, event.target.value)}
                        className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
                      >
                        {field.options.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <div className="flex justify-end border-t border-gray-200 pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-[#142B3A] px-5 py-2.5 text-sm font-medium text-white shadow-sm disabled:bg-gray-300"
        >
          {pending ? 'Saving...' : 'Save dashboard tables'}
        </button>
      </div>
    </form>
  )
}
