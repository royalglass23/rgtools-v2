'use client'

import { useState, useTransition } from 'react'
import { saveTablePrefs } from './table-prefs-actions'
import type { TablePrefs } from './table-prefs-shared'

const COLUMN_LABELS: Record<string, string> = {
  date: 'Date',
  client: 'Client',
  address: 'Job Address',
  project: 'Project',
  tier: 'Tier',
  score: 'Score',
  sm8: 'SM8',
  completeness: 'Completeness',
  rcStatus: 'RC',
  bcStatus: 'BC',
  buildingStage: 'Building Stage',
  followUpDate: 'Follow-up date',
  updatedAt: 'Last update',
  aiSuggestion: 'AI suggestion',
}

const SORT_OPTIONS = [
  ['createdAt', 'Date'],
  ['clientName', 'Client'],
  ['tier', 'Tier'],
  ['seedScore', 'Score'],
  ['completeness', 'Completeness'],
  ['followUpDate', 'Follow-up date'],
  ['updatedAt', 'Last update'],
] as const

export function LeadTableConfiguration({ prefs }: { prefs: TablePrefs }) {
  const [tablePrefs, setTablePrefs] = useState(prefs)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function persistPrefs(nextPrefs: TablePrefs) {
    setTablePrefs(nextPrefs)
    setMessage(null)
    startTransition(async () => {
      await saveTablePrefs('leads', nextPrefs)
      setMessage('Configuration saved.')
    })
  }

  function toggleColumn(columnKey: string) {
    const target = tablePrefs.columns.find((column) => column.key === columnKey)
    const visibleCount = tablePrefs.columns.filter((column) => column.visible).length
    if (target?.visible && visibleCount <= 1) return

    persistPrefs({
      ...tablePrefs,
      columns: tablePrefs.columns.map((column) => (
        column.key === columnKey ? { ...column, visible: !column.visible } : column
      )),
    })
  }

  function moveColumn(columnKey: string, direction: -1 | 1) {
    const index = tablePrefs.columns.findIndex((column) => column.key === columnKey)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= tablePrefs.columns.length) return

    const columns = [...tablePrefs.columns]
    const [column] = columns.splice(index, 1)
    columns.splice(targetIndex, 0, column)
    persistPrefs({ ...tablePrefs, columns })
  }

  function updateSort(sortColumn: string, sortDir: 'asc' | 'desc') {
    persistPrefs({ ...tablePrefs, sortColumn, sortDir })
  }

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-gray-950">Lead Intake List Columns</h2>
          <p className="mt-1 text-sm text-gray-500">Choose which columns appear in the lead intake list and the order they appear in.</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tablePrefs.columns.map((column, index) => (
            <div key={column.key} className="flex items-center justify-between gap-2 rounded border border-gray-200 px-3 py-2">
              <label className="flex min-w-0 items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={column.visible}
                  onChange={() => toggleColumn(column.key)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="truncate">{COLUMN_LABELS[column.key] ?? column.key}</span>
              </label>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveColumn(column.key, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${COLUMN_LABELS[column.key] ?? column.key} up`}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => moveColumn(column.key, 1)}
                  disabled={index === tablePrefs.columns.length - 1}
                  aria-label={`Move ${COLUMN_LABELS[column.key] ?? column.key} down`}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Down
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-950">Default Sort</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Sort column</span>
            <select
              value={tablePrefs.sortColumn}
              onChange={(event) => updateSort(event.currentTarget.value, tablePrefs.sortDir)}
              className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
            >
              {SORT_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Direction</span>
            <select
              value={tablePrefs.sortDir}
              onChange={(event) => updateSort(tablePrefs.sortColumn, event.currentTarget.value === 'asc' ? 'asc' : 'desc')}
              className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
        </div>
      </section>

      <div className="text-sm text-gray-600">
        {isPending ? 'Saving...' : message}
      </div>
    </div>
  )
}
