export interface BeaconPayload {
  token: string
  event: 'open' | 'scroll' | 'close'
  session: string
  depth?: number
  duration?: number
}

export function validatePayload(body: unknown): body is BeaconPayload {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return (
    typeof b.token === 'string' && b.token.length > 0 &&
    typeof b.event === 'string' && ['open', 'scroll', 'close'].includes(b.event) &&
    typeof b.session === 'string' && b.session.length > 0
  )
}
