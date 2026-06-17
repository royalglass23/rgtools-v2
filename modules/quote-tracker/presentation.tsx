/**
 * Presentational helpers shared by the Quote Tracker page (server component) and
 * QuoteTableControls (client component). Kept free of `'use client'` and hooks so the
 * pure functions can be called during server render as well as in the client bundle.
 */
import type { StatusTag } from './score'

export function StatusBadge({ tag }: { tag: StatusTag }) {
  const classes: Record<StatusTag, string> = {
    hot: 'bg-red-100 text-red-800',
    warm: 'bg-amber-100 text-amber-800',
    cold: 'bg-blue-100 text-blue-800',
    dead: 'bg-gray-100 text-gray-700',
  }

  return <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold capitalize ${classes[tag]}`}>{tag}</span>
}

export function formatCurrency(value: string | null) {
  const numeric = Number(value ?? 0)
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(numeric)
}

export function formatRelative(date: Date | null) {
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

export function formatDateTime(value: Date | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

export function formatDuration(ms: number) {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

export function maskIp(ip: string | null) {
  if (!ip) return '-'
  const parts = ip.split('.')
  if (parts.length === 4) return `${parts.slice(0, 3).join('.')}.xxx`
  return `${ip.slice(0, 12)}...`
}
