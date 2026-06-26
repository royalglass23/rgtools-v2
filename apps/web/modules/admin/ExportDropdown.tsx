'use client'

import { useState } from 'react'

const RANGES = [
  { value: 'day', label: 'Last 24 hours' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: '3months', label: 'Last 3 months' },
] as const

type Range = typeof RANGES[number]['value']

export function ExportDropdown({
  kind,
  query = {},
}: {
  kind: 'system' | 'audit'
  query?: Record<string, string | undefined>
}) {
  const [range, setRange] = useState<Range>('week')
  const params = new URLSearchParams({ kind, range })
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value)
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={range}
        onChange={(e) => setRange(e.target.value as Range)}
        className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-600 bg-white"
      >
        {RANGES.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <a
        href={`/api/admin/logs/export?${params.toString()}`}
        className="text-xs border border-gray-200 rounded px-3 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
      >
        Export
      </a>
    </div>
  )
}
