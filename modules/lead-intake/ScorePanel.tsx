'use client'

import { scoreLead, type ScoringConfig } from '@/modules/lead-intake/scoring/score-lead'

type ScoredFields = {
  clientProfileKey: string
  budgetBand?: string
  rcStatus?: string
  bcStatus?: string
  buildingStage?: string
  cat4?: string
  priceSensitivityRead?: string
  decisionMakers?: string
  distanceBand?: string | null
}

type Props = {
  input: ScoredFields
  config: ScoringConfig
  lastUpdated?: string | null
  followUpDate?: string | null
}

const tierStyles: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-blue-100 text-blue-800',
  C: 'bg-amber-100 text-amber-800',
  D: 'bg-red-100 text-red-800',
}

const CONSENT_CATEGORY_KEYS = new Set(['8', '9', '10'])
const EMPTY_MARK = '—'

export function ScorePanel({ input, config, lastUpdated, followUpDate }: Props) {
  const answers = {
    cat1: input.clientProfileKey || undefined,
    cat2: input.budgetBand || undefined,
    cat4: input.cat4 || undefined,
    cat5: input.priceSensitivityRead || undefined,
    cat6: input.decisionMakers || undefined,
    cat7: input.distanceBand || undefined,
    cat8: input.rcStatus || undefined,
    cat9: input.bcStatus || undefined,
    cat10: input.buildingStage || undefined,
  }

  const result = scoreLead(answers, config)
  const sortedCategories = Object.entries(config.categories).sort(([a], [b]) => Number(a) - Number(b))
  const regularCategories = sortedCategories.filter(([key]) => !CONSENT_CATEGORY_KEYS.has(key))
  const consentCategories = sortedCategories.filter(([key]) => CONSENT_CATEGORY_KEYS.has(key))
  const consentPoints = consentCategories.reduce((total, [key]) => {
    const row = result.categoryRows.find((r) => r.category === Number(key))
    return total + (row?.points ?? 0)
  }, 0)

  return (
    <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${tierStyles[result.tier]}`}>
          Tier {result.tier}
        </span>
        <span className="text-2xl font-bold text-gray-900">{result.score}</span>
        <span className="text-sm text-gray-500">/ 100</span>
      </div>
      {result.flagNote && (
        <div className="mt-2 mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
          ⚑ {result.flagNote}
        </div>
      )}
      {!result.flagNote && <div className="mb-4" />}
      <div className="grid gap-2 lg:grid-cols-2 lg:gap-x-6">
        {regularCategories.map(([key, category]) => {
          const row = result.categoryRows.find((r) => r.category === Number(key))
          return <ScoreRow key={key} label={category.label} points={row?.points ?? 0} max={category.max} />
        })}

        {consentCategories.length > 0 && (
          <div className="space-y-1.5 border-t border-gray-100 pt-2">
            <div className="flex items-center gap-3">
              <span className="w-44 truncate text-xs font-semibold text-gray-700">Consent readiness</span>
              <span className={`w-6 text-right text-xs font-semibold ${consentPoints > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                {consentPoints > 0 ? consentPoints : EMPTY_MARK}
              </span>
              <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                {consentPoints > 0 && (
                  <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${Math.round((consentPoints / 19) * 100)}%` }} />
                )}
              </div>
              <span className="w-8 text-right text-xs text-gray-500">/ 19</span>
            </div>
            <div className="space-y-1 pl-3">
              {consentCategories.map(([key, category]) => {
                const row = result.categoryRows.find((r) => r.category === Number(key))
                return (
                  <ScoreRow
                    key={key}
                    label={category.label}
                    points={row?.points ?? 0}
                    max={category.max}
                    compact
                  />
                )
              })}
            </div>
          </div>
        )}

        <div className="grid gap-1 border-t border-gray-100 pt-2 text-xs text-gray-500">
          <div>
            <span className="font-medium text-gray-600">Last update:</span>{' '}
            <span>{formatMetaDate(lastUpdated)}</span>
          </div>
          <div>
            <span className="font-medium text-gray-600">Follow-up:</span>{' '}
            <span>{formatMetaDate(followUpDate)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ScoreRow({
  label,
  points,
  max,
  compact = false,
}: {
  label: string
  points: number
  max: number
  compact?: boolean
}) {
  const pct = max > 0 ? Math.round((points / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className={`${compact ? 'w-40' : 'w-44'} truncate text-xs text-gray-600`}>{label}</span>
      <span className={`w-6 text-right text-xs font-medium ${points > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
        {points > 0 ? points : EMPTY_MARK}
      </span>
      <div className="h-1.5 flex-1 rounded-full bg-gray-100">
        {points > 0 && (
          <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
        )}
      </div>
      <span className="w-8 text-right text-xs text-gray-400">/ {max}</span>
    </div>
  )
}

function formatMetaDate(value: string | null | undefined): string {
  if (!value) return EMPTY_MARK
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10)
}
