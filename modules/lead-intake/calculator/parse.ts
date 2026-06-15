/** Coerces an unknown value to a trimmed string, or '' for non-string/number input. */
export function stringValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}

/** Coerces an unknown value to a finite number, or NaN when it can't be parsed. */
export function numberValue(value: unknown): number {
  const number = typeof value === 'number' ? value : Number.parseFloat(stringValue(value))
  return Number.isFinite(number) ? number : Number.NaN
}
