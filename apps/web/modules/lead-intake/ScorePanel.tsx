'use client'

import {
  DECISION_MATRIX,
  optionPoints,
  scoreLead,
  type DecisionMatrixAnswers,
} from '@/modules/lead-intake/scoring/score-lead'

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
  leadSource?: string
  paymentHistory?: string
  siteAccess?: string
  installationHeight?: string
}

type Props = {
  input: ScoredFields
  config?: unknown
  lastUpdated?: string | null
  followUpDate?: string | null
}

const tierStyles: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-blue-100 text-blue-800',
  C: 'bg-amber-100 text-amber-800',
  D: 'bg-orange-100 text-orange-800',
  E: 'bg-red-100 text-red-800',
}

const EMPTY_MARK = '-'

export function ScorePanel({ input, lastUpdated, followUpDate }: Props) {
  const answers: DecisionMatrixAnswers = {
    clientType: input.clientProfileKey || undefined,
    budgetBand: input.budgetBand || undefined,
    resourceConsent: input.rcStatus || undefined,
    buildingConsent: input.bcStatus || undefined,
    buildingStage: input.buildingStage || undefined,
    projectType: input.cat4 || undefined,
    priceSensitivity: input.priceSensitivityRead || undefined,
    decisionMakers: input.decisionMakers || undefined,
    source: input.leadSource || undefined,
    distanceBand: input.distanceBand || undefined,
    paymentHistory: input.paymentHistory || undefined,
    siteAccess: input.siteAccess || undefined,
    installationHeight: input.installationHeight || undefined,
  }

  const result = scoreLead(answers)
  const summaryText = `Score ${result.score}/100 | Question ${result.completeness.answered}/${result.completeness.total}`

  return (
    <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 md:items-center">
        <div className="flex flex-col items-center justify-center rounded border border-gray-100 bg-gray-50 px-4 py-5 text-center">
          <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tierStyles[result.tier]}`}>
            Tier {result.tier}
          </span>
          <div className="mt-3 text-sm font-medium text-gray-700">
            {summaryText}
          </div>
        </div>
        <div className="grid content-center gap-1 text-xs text-gray-500">
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
      <div className="mt-4 grid gap-2 md:grid-cols-2 md:gap-x-6">
        {DECISION_MATRIX.fields.map((field) => {
          const answerKey = answers[field.key]
          return (
            <ScoreRow
              key={field.key}
              label={field.label}
              points={answerKey ? optionPoints(field.key, answerKey) : 0}
              max={field.maxPoints}
            />
          )
        })}
      </div>
    </div>
  )
}

function ScoreRow({
  label,
  points,
  max,
}: {
  label: string
  points: number
  max: number
}) {
  const pct = max > 0 ? Math.round((points / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-44 truncate text-xs text-gray-600">{label}</span>
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
