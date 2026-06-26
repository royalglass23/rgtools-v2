const IP_HEADER_PRIORITY = [
  'cf-connecting-ip',
  'true-client-ip',
  'x-vercel-forwarded-for',
  'x-forwarded-for',
  'x-real-ip',
] as const

export function resolveAuditIpAddress(headers: Pick<Headers, 'get'>): string | null {
  for (const header of IP_HEADER_PRIORITY) {
    const candidate = firstPublicIp(headers.get(header))
    if (candidate) return candidate
  }
  return null
}

function firstPublicIp(value: string | null) {
  if (!value) return null

  for (const part of value.split(',')) {
    const ip = normalizeIp(part)
    if (ip && !isPrivateOrLoopbackIp(ip)) return ip
  }

  return null
}

function normalizeIp(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('[')) return trimmed.slice(1, trimmed.indexOf(']'))

  const ipv4WithPort = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/)
  return ipv4WithPort?.[1] ?? trimmed
}

function isPrivateOrLoopbackIp(ip: string) {
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1' || ip.toLowerCase().startsWith('fe80:')) return true
  if (ip === '127.0.0.1' || ip.startsWith('127.')) return true
  if (ip.startsWith('10.')) return true
  if (ip.startsWith('192.168.')) return true

  const match = ip.match(/^172\.(\d{1,3})\./)
  if (match) {
    const secondOctet = Number(match[1])
    if (secondOctet >= 16 && secondOctet <= 31) return true
  }

  return false
}
