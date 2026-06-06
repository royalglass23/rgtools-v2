export type LeadAnswers = {
  cat1?: string
  cat2?: string
  cat3?: string
  cat4?: string
  cat5?: string
  cat6?: string
  bonuses?: string[]
  penalties?: string[]
}

export type ScoringCategoryConfig = {
  label: string
  max: number
  options: Record<string, number>
}

export type ScoringConfig = {
  categories: Record<string, ScoringCategoryConfig>
  bonuses: Record<string, number>
  penalties: Record<string, number>
  tiers: Record<Exclude<LeadTier, 'D'>, number>
}

export type LeadTier = 'A' | 'B' | 'C' | 'D'
type CategoryAnswerField = keyof Pick<LeadAnswers, 'cat1' | 'cat2' | 'cat3' | 'cat4' | 'cat5' | 'cat6'>

export type ScoreResult = {
  score: number
  tier: LeadTier
  reason: string
  categoryRows: Array<{ category: number; answerKey: string | null; points: number }>
}

const answerFieldByCategory: Record<string, CategoryAnswerField> = {
  '1': 'cat1',
  '2': 'cat2',
  '3': 'cat3',
  '4': 'cat4',
  '5': 'cat5',
  '6': 'cat6',
}

export function scoreLead(answers: LeadAnswers, config: ScoringConfig): ScoreResult {
  const categoryKeys = Object.keys(config.categories).sort((a, b) => Number(a) - Number(b))
  const categoryRows = categoryKeys.map((categoryKey) => {
    const categoryConfig = config.categories[categoryKey]
    const answerField = answerFieldByCategory[categoryKey]
    const answerKey = answerField ? answers[answerField] ?? null : null
    const points = answerKey ? configPoint(categoryConfig.options, answerKey) : 0

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
  const tier = tierForScore(score, config)
  const reason = buildReason(tier, score, answers, config, categoryRows)

  return {
    score,
    tier,
    reason,
    categoryRows,
  }
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
