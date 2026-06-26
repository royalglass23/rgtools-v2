import type { ScoringConfig } from '@/modules/lead-intake/scoring/score-lead'

const OPTION_KEY_PATTERN = /^[a-z0-9][a-z0-9_]*$/

export function validateScoringConfigDraft(config: ScoringConfig): string[] {
  const errors: string[] = []
  const optionKeys = new Set<string>()

  for (const [categoryKey, category] of Object.entries(config.categories)) {
    if (!category.label.trim()) {
      errors.push(`Category ${categoryKey} needs a label.`)
    }

    if (!Number.isInteger(category.max) || category.max < 0 || category.max > 100) {
      errors.push(`Category ${categoryKey} max points must be between 0 and 100.`)
    }

    const entries = Object.entries(category.options)
    if (entries.length === 0) {
      errors.push(`Category ${categoryKey} needs at least one option.`)
    }

    for (const [optionKey, points] of entries) {
      if (!OPTION_KEY_PATTERN.test(optionKey)) {
        errors.push(`Option key "${optionKey}" must use lowercase letters, numbers, and underscores only.`)
      }
      if (!Number.isInteger(points) || points < 0) {
        errors.push(`Option "${optionKey}" points must be an integer zero or greater.`)
      }
      optionKeys.add(optionKey)
    }

    const optionOrder = category.optionOrder ?? Object.keys(category.options)
    const optionKeyList = Object.keys(category.options)
    if (!sameStringSet(optionOrder, optionKeyList)) {
      errors.push(`Category ${categoryKey} option order must contain exactly its option keys.`)
    }

    const highestOptionPoints = Math.max(0, ...Object.values(category.options))
    if (category.max < highestOptionPoints) {
      errors.push(`Category ${categoryKey} max points must be at least its highest option points.`)
    }
  }

  const tiers = config.tiers
  if (!(tiers.A > tiers.B && tiers.B > tiers.C)) {
    errors.push('Tier thresholds must descend from A to C.')
  }

  for (const [tier, threshold] of Object.entries(tiers)) {
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
      errors.push(`Tier ${tier} threshold must be between 0 and 100.`)
    }
  }

  if (config.strikes) {
    for (const strikeKey of Object.keys(config.strikes.weights)) {
      if (!optionKeys.has(strikeKey)) {
        errors.push(`Strike option "${strikeKey}" does not exist in any category option.`)
      }
    }

    if (config.strikes.softDemoteAt < 0 || config.strikes.capAt < 0) {
      errors.push('Strike thresholds must be zero or greater.')
    }

    if (config.strikes.capAt < config.strikes.softDemoteAt) {
      errors.push('Strike cap threshold must be greater than or equal to the soft-demote threshold.')
    }
  }

  return Array.from(new Set(errors))
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}

export function buildRemovedOptionWarnings(
  previousConfig: ScoringConfig,
  nextConfig: ScoringConfig,
  usedOptionKeys: Set<string>,
): string[] {
  const previousKeys = collectOptionKeys(previousConfig)
  const nextKeys = collectOptionKeys(nextConfig)
  const warnings: string[] = []

  for (const optionKey of previousKeys) {
    if (!nextKeys.has(optionKey) && usedOptionKeys.has(optionKey)) {
      warnings.push(
        `Option key "${optionKey}" is used by existing leads. Removing or renaming it can break historical category score display.`,
      )
    }
  }

  return warnings
}

export function nextScoringVersionLabel(
  currentLabel: string,
  now = new Date(),
  existingLabels: string[] = [],
): string {
  const versionMatch = currentLabel.match(/^v(\d+)/)
  const nextVersion = versionMatch ? Number(versionMatch[1]) + 1 : 1
  const datePart = now.toISOString().slice(0, 10)
  const baseLabel = `v${nextVersion}-${datePart}`
  const existing = new Set(existingLabels)

  if (!existing.has(baseLabel)) return baseLabel

  let suffix = 2
  while (existing.has(`${baseLabel}-${suffix}`)) {
    suffix += 1
  }
  return `${baseLabel}-${suffix}`
}

export function collectOptionKeys(config: ScoringConfig): Set<string> {
  const keys = new Set<string>()
  for (const category of Object.values(config.categories)) {
    for (const key of Object.keys(category.options)) {
      keys.add(key)
    }
  }
  return keys
}
