export type ExpiryPreset = '1h' | '3h' | '12h' | '1d' | '7d' | '30d'

const PRESET_MS: Record<ExpiryPreset, number> = {
  '1h': 60 * 60 * 1000,
  '3h': 3 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

export function resolveExpiry(input: ExpiryPreset | { customDate: string } = '1h'): Date {
  if (typeof input === 'object') {
    return new Date(input.customDate)
  }

  return new Date(Date.now() + PRESET_MS[input])
}
