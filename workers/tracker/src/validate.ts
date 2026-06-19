export interface BeaconPayload {
  token: string
  event: 'open' | 'scroll' | 'close' | 'page_view' | 'download' | 'cta'
  session: string
  depth?: number
  duration?: number
  activeDurationMs?: number
  pageNumber?: number
  ctaType?: 'accept' | 'contact'
}

const eventTypes: BeaconPayload['event'][] = ['open', 'scroll', 'close', 'page_view', 'download', 'cta']

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function validatePayload(body: unknown): body is BeaconPayload {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  const baseValid = (
    typeof b.token === 'string' && b.token.length > 0 &&
    typeof b.event === 'string' && eventTypes.includes(b.event as BeaconPayload['event']) &&
    typeof b.session === 'string' && b.session.length > 0
  )

  if (!baseValid) return false
  if (b.event === 'page_view' && !isPositiveInteger(b.pageNumber)) return false
  if (b.pageNumber != null && !isPositiveInteger(b.pageNumber)) return false
  if (b.duration != null && !isNonNegativeNumber(b.duration)) return false
  if (b.activeDurationMs != null && (typeof b.activeDurationMs !== 'number' || b.activeDurationMs < 0)) return false
  if (b.ctaType != null && b.ctaType !== 'accept' && b.ctaType !== 'contact') return false

  return true
}
