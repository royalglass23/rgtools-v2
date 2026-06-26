export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  const firstForwardedIp = forwarded?.split(',')[0]?.trim()
  return firstForwardedIp || 'unknown'
}
