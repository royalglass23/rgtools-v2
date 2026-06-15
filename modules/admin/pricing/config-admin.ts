const SCENARIO_KEYS = [
  'ground_level',
  'balcony_balustrade',
  'premium_pool_fence',
  'stair_balustrade',
] as const

const HARDWARE_FINISH_KEYS = [
  'standard_chrome',
  'matte_black',
  'brushed_chrome',
  'powder_coated',
  'not_sure',
] as const

const FIXING_METHOD_KEYS = [
  'spigot_round',
  'standoff_posts',
  'viking',
  'jh_clamps',
  'side_channel',
  'top_channel',
  'aluminium_1',
  'aluminium_2',
  'sed',
  'not_sure',
] as const

const GLASS_TYPE_KEYS = ['toughened_12mm', 'laminated'] as const
const GLASS_COLOUR_KEYS = ['clear', 'low_iron', 'tinted', 'frosted'] as const

type Scenario = typeof SCENARIO_KEYS[number]
type HardwareFinish = typeof HARDWARE_FINISH_KEYS[number]
type FixingMethod = typeof FIXING_METHOD_KEYS[number]
type GlassType = typeof GLASS_TYPE_KEYS[number]
type GlassColour = typeof GLASS_COLOUR_KEYS[number]

export interface ScenarioPricing {
  ratePerMetre: number
  gatePrice: number | null
}

export interface PricingConfig {
  scenarios: Record<Scenario, ScenarioPricing>
  minimumLength: number
  cornerSurcharge: number
  hardwareFinishSurcharge: Record<HardwareFinish, number>
  fixingMethodSurcharge: Record<FixingMethod, number>
  glassTypeSurcharge: Record<GlassType, number>
  glassColourSurcharge: Record<GlassColour, number>
  interlikingRailsSurcharge: number
  rangeLowPercent: number
  rangeHighPercent: number
}

export const PRICING_KEYS = {
  scenarios: SCENARIO_KEYS,
  hardwareFinishes: HARDWARE_FINISH_KEYS,
  fixingMethods: FIXING_METHOD_KEYS,
  glassTypes: GLASS_TYPE_KEYS,
  glassColours: GLASS_COLOUR_KEYS,
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  scenarios: {
    ground_level: { ratePerMetre: 280, gatePrice: null },
    balcony_balustrade: { ratePerMetre: 320, gatePrice: null },
    premium_pool_fence: { ratePerMetre: 380, gatePrice: 680 },
    stair_balustrade: { ratePerMetre: 330, gatePrice: null },
  },
  minimumLength: 5,
  cornerSurcharge: 85,
  hardwareFinishSurcharge: {
    standard_chrome: 0,
    matte_black: 15,
    brushed_chrome: 12,
    powder_coated: 22,
    not_sure: 0,
  },
  fixingMethodSurcharge: {
    spigot_round: 0,
    standoff_posts: 0,
    viking: 0,
    jh_clamps: 0,
    side_channel: 0,
    top_channel: 0,
    aluminium_1: 0,
    aluminium_2: 0,
    sed: 0,
    not_sure: 0,
  },
  glassTypeSurcharge: {
    toughened_12mm: 0,
    laminated: 0,
  },
  glassColourSurcharge: {
    clear: 0,
    low_iron: 0,
    tinted: 0,
    frosted: 0,
  },
  interlikingRailsSurcharge: 0,
  rangeLowPercent: 90,
  rangeHighPercent: 120,
}

export function validatePricingConfigDraft(config: PricingConfig): string[] {
  const errors: string[] = []

  for (const scenarioKey of SCENARIO_KEYS) {
    const scenario = config.scenarios?.[scenarioKey]
    if (!scenario) {
      errors.push(`Missing scenario pricing for ${scenarioKey}.`)
      continue
    }
    requireNonNegativeNumber(errors, `scenarios.${scenarioKey}.ratePerMetre`, scenario.ratePerMetre)
    if (scenarioKey === 'premium_pool_fence') {
      requireNonNegativeNumber(errors, `scenarios.${scenarioKey}.gatePrice`, scenario.gatePrice)
    } else if (scenario.gatePrice !== null) {
      errors.push(`scenarios.${scenarioKey}.gatePrice must be null.`)
    }
  }

  requireNonNegativeNumber(errors, 'minimumLength', config.minimumLength)
  requireNonNegativeNumber(errors, 'cornerSurcharge', config.cornerSurcharge)
  requireNumberMap(errors, 'hardwareFinishSurcharge', config.hardwareFinishSurcharge, HARDWARE_FINISH_KEYS, false)
  requireNumberMap(errors, 'fixingMethodSurcharge', config.fixingMethodSurcharge, FIXING_METHOD_KEYS, true)
  requireNumberMap(errors, 'glassTypeSurcharge', config.glassTypeSurcharge, GLASS_TYPE_KEYS, false)
  requireNumberMap(errors, 'glassColourSurcharge', config.glassColourSurcharge, GLASS_COLOUR_KEYS, false)
  requireNonNegativeNumber(errors, 'interlikingRailsSurcharge', config.interlikingRailsSurcharge)
  requireNonNegativeNumber(errors, 'rangeLowPercent', config.rangeLowPercent)
  requireNonNegativeNumber(errors, 'rangeHighPercent', config.rangeHighPercent)

  if (
    Number.isFinite(config.rangeLowPercent)
    && Number.isFinite(config.rangeHighPercent)
    && config.rangeLowPercent > config.rangeHighPercent
  ) {
    errors.push('rangeLowPercent must be less than or equal to rangeHighPercent.')
  }

  return Array.from(new Set(errors))
}

export function nextPricingVersionLabel(
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

function requireNumberMap<K extends string>(
  errors: string[],
  label: string,
  values: Record<K, number> | undefined,
  keys: readonly K[],
  allowNegative: boolean,
) {
  for (const key of keys) {
    if (!values || !(key in values)) {
      errors.push(`Missing ${label}.${key}.`)
      continue
    }
    if (allowNegative) {
      requireFiniteNumber(errors, `${label}.${key}`, values[key])
    } else {
      requireNonNegativeNumber(errors, `${label}.${key}`, values[key])
    }
  }
}

function requireNonNegativeNumber(errors: string[], label: string, value: unknown) {
  if (!Number.isFinite(value) || Number(value) < 0) {
    errors.push(`${label} must be a finite number zero or greater.`)
  }
}

function requireFiniteNumber(errors: string[], label: string, value: unknown) {
  if (!Number.isFinite(value)) {
    errors.push(`${label} must be a finite number.`)
  }
}
