'use client'

import { scoreLead, type ScoringConfig } from '@/lib/scoring/score-lead'

type ScoredFields = {
  clientProfileKey: string
  budgetBand?: string
  consentStatus?: string
  timeline?: string
  cat4?: string
  priceSensitivityRead?: string
  decisionMakers?: string
}

type Props = {
  input: ScoredFields
  config: ScoringConfig
}

const tierStyles: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-blue-100 text-blue-800',
  C: 'bg-amber-100 text-amber-800',
  D: 'bg-red-100 text-red-800',
}

export function ScorePanel({ input, config }: Props) {
  const answers = {
    cat1: input.clientProfileKey || undefined,
    cat2: input.budgetBand || undefined,
    cat3: input.consentStatus || input.timeline || undefined,
    cat4: input.cat4 || undefined,
    cat5: input.priceSensitivityRead || undefined,
    cat6: input.decisionMakers || undefined,
  }

  const result = scoreLead(answers, config)

  return (
    <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${tierStyles[result.tier]}`}>
          Tier {result.tier}
        </span>
        <span className="text-2xl font-bold text-gray-900">{result.score}</span>
        <span className="text-sm text-gray-500">/ 100</span>
      </div>
      <div className="space-y-2">
        {Object.entries(config.categories)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([key, category]) => {
            const row = result.categoryRows.find((r) => r.category === Number(key))
            const points = row?.points ?? 0
            const pct = category.max > 0 ? Math.round((points / category.max) * 100) : 0
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-44 truncate text-xs text-gray-600">{category.label}</span>
                <span className={`w-6 text-right text-xs font-medium ${points > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                  {points > 0 ? points : '—'}
                </span>
                <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                  {points > 0 && (
                    <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                  )}
                </div>
                <span className="w-8 text-right text-xs text-gray-400">/ {category.max}</span>
              </div>
            )
          })}
      </div>
    </div>
  )
}
