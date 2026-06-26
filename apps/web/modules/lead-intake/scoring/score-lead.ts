export type LeadAnswers = {
  cat1?: string
  cat2?: string
  cat3?: string
  cat4?: string
  cat5?: string
  cat6?: string
  cat7?: string
  cat8?: string
  cat9?: string
  cat10?: string
  bonuses?: string[]
  penalties?: string[]
}

export type ScoringCategoryConfig = {
  label: string
  max: number
  options: Record<string, number>
  optionLabels?: Record<string, string>
  optionOrder?: string[]
}

export type StrikesConfig = {
  weights: Record<string, number>
  softDemoteAt: number
  capAt: number
  capCeiling: LeadTier
}

export type ScoringConfig = {
  categories: Record<string, ScoringCategoryConfig>
  bonuses: Record<string, number>
  penalties: Record<string, number>
  tiers: Record<Exclude<LeadTier, 'D'>, number>
  strikes?: StrikesConfig
}

export type LeadTier = 'A' | 'B' | 'C' | 'D'
type CategoryAnswerField = keyof Pick<
  LeadAnswers,
  'cat1' | 'cat2' | 'cat3' | 'cat4' | 'cat5' | 'cat6' | 'cat7' | 'cat8' | 'cat9' | 'cat10'
>

type StrikeEffect = 'none' | 'soft_demote' | 'cap'

export type StrikeResult = {
  firedKeys: string[]
  totalWeight: number
  preStrikeTier: LeadTier
  finalTier: LeadTier
  effect: StrikeEffect
}

export type ScoreResult = {
  score: number
  tier: LeadTier
  reason: string
  categoryRows: Array<{ category: number; answerKey: string | null; points: number }>
  strikeResult: StrikeResult
  flagNote: string | null
}

const answerFieldByCategory: Record<string, CategoryAnswerField> = {
  '1': 'cat1',
  '2': 'cat2',
  '3': 'cat3',
  '4': 'cat4',
  '5': 'cat5',
  '6': 'cat6',
  '7': 'cat7',
  '8': 'cat8',
  '9': 'cat9',
  '10': 'cat10',
}

const TIER_SEVERITY: Record<LeadTier, number> = { A: 0, B: 1, C: 2, D: 3 }

function mostSevereTier(a: LeadTier, b: LeadTier): LeadTier {
  return TIER_SEVERITY[a] >= TIER_SEVERITY[b] ? a : b
}

function demoteOneTier(tier: LeadTier): LeadTier {
  const map: Record<LeadTier, LeadTier> = { A: 'B', B: 'C', C: 'D', D: 'D' }
  return map[tier]
}

export function scoreLead(answers: LeadAnswers, config: ScoringConfig): ScoreResult {
  const strikeWeights = config.strikes?.weights ?? {}
  const categoryKeys = Object.keys(config.categories).sort((a, b) => Number(a) - Number(b))

  const categoryRows = categoryKeys.map((categoryKey) => {
    const categoryConfig = config.categories[categoryKey]
    const answerField = answerFieldByCategory[categoryKey]
    const answerKey = answerField ? answers[answerField] ?? null : null
    const isStrikeKey = answerKey !== null && answerKey in strikeWeights
    const points = answerKey ? (isStrikeKey ? 0 : configPoint(categoryConfig.options, answerKey)) : 0

    return {
      category: Number(categoryKey),
      answerKey,
      points,
    }
  })

  const categoryScore = categoryRows.reduce((total, row) => total + row.points, 0)
  const bonusScore = sumAdjustments(answers.bonuses, config.bonuses)
  const penaltyScore = sumAdjustments(answers.penalties, config.penalties)
  const score = clampScore(categoryScore + bonusScore + penaltyScore)
  const preStrikeTier = tierForScore(score, config)
  const strikeResult = computeStrikeResult(preStrikeTier, answers, categoryKeys, config)
  const flagNote = buildFlagNote(strikeResult.firedKeys, categoryRows, config)
  const reason = buildReason(strikeResult.finalTier, score, answers, config, categoryRows)

  return {
    score,
    tier: strikeResult.finalTier,
    reason,
    categoryRows,
    strikeResult,
    flagNote,
  }
}

function computeStrikeResult(
  preStrikeTier: LeadTier,
  answers: LeadAnswers,
  categoryKeys: string[],
  config: ScoringConfig,
): StrikeResult {
  const strikes = config.strikes
  if (!strikes) {
    return {
      firedKeys: [],
      totalWeight: 0,
      preStrikeTier,
      finalTier: preStrikeTier,
      effect: 'none',
    }
  }

  const firedKeys: string[] = []
  let totalWeight = 0
  for (const categoryKey of categoryKeys) {
    const answerField = answerFieldByCategory[categoryKey]
    if (!answerField) continue
    const answerKey = answers[answerField]
    if (answerKey && answerKey in strikes.weights) {
      firedKeys.push(answerKey)
      totalWeight += strikes.weights[answerKey]
    }
  }

  const candidates: LeadTier[] = [preStrikeTier]
  if (totalWeight >= strikes.softDemoteAt) {
    candidates.push(demoteOneTier(preStrikeTier))
  }
  if (totalWeight >= strikes.capAt) {
    candidates.push(strikes.capCeiling)
  }
  const finalTier = candidates.reduce(mostSevereTier)

  const effect: StrikeEffect =
    totalWeight >= strikes.capAt
      ? 'cap'
      : totalWeight >= strikes.softDemoteAt
        ? 'soft_demote'
        : 'none'

  return { firedKeys, totalWeight, preStrikeTier, finalTier, effect }
}

function buildFlagNote(
  firedKeys: string[],
  categoryRows: ScoreResult['categoryRows'],
  config: ScoringConfig,
): string | null {
  if (firedKeys.length === 0) return null
  const firedSet = new Set(firedKeys)
  const labels: string[] = []
  for (const row of categoryRows) {
    if (row.answerKey && firedSet.has(row.answerKey)) {
      labels.push(config.categories[String(row.category)]?.label ?? `Category ${row.category}`)
    }
  }
  return `Blocker flag${labels.length > 1 ? 's' : ''}: ${labels.join(', ')}`
}

function configPoint(options: Record<string, number>, answerKey: string): number {
  return options[answerKey] ?? 0
}

function sumAdjustments(answerKeys: string[] | undefined, configValues: Record<string, number>): number {
  return (answerKeys ?? []).reduce((total, answerKey) => total + (configValues[answerKey] ?? 0), 0)
}

function clampScore(score: number): number {
  return Math.min(Math.max(score, 0), 100)
}

function tierForScore(score: number, config: ScoringConfig): LeadTier {
  const rankedTiers = (Object.entries(config.tiers) as Array<[Exclude<LeadTier, 'D'>, number]>)
    .sort(([, leftThreshold], [, rightThreshold]) => rightThreshold - leftThreshold)

  for (const [tier, threshold] of rankedTiers) {
    if (score >= threshold) return tier
  }

  return 'D'
}

function buildReason(
  tier: LeadTier,
  score: number,
  answers: LeadAnswers,
  config: ScoringConfig,
  categoryRows: ScoreResult['categoryRows'],
): string {
  const selectedCategories = categoryRows
    .filter((row) => row.answerKey)
    .map((row) => {
      const categoryConfig = config.categories[String(row.category)]
      return `${categoryConfig.label}: ${formatAnswerKey(row.answerKey!)}`
    })

  const selectedBonuses = (answers.bonuses ?? []).map((answerKey) => `bonus: ${formatAnswerKey(answerKey)}`)
  const selectedPenalties = (answers.penalties ?? []).map((answerKey) => `penalty: ${formatAnswerKey(answerKey)}`)
  const reasonParts = [...selectedCategories, ...selectedBonuses, ...selectedPenalties]
  const details = reasonParts.length > 0 ? reasonParts.join(', ') : 'no scored answers yet'

  return `Tier ${tier} (${score}): ${details}`
}

function formatAnswerKey(answerKey: string): string {
  return answerKey.replaceAll('_', ' ')
}
