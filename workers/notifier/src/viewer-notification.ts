export type OpenEvent = {
  ipHash: string
  userAgentHash: string | null
  sessionId: string
  ip: string | null
}

export type NotifiedViewer = {
  ipHash: string
  userAgentHash: string
}

export function findNewViewersToNotify(
  openEvents: OpenEvent[],
  notifiedViewers: NotifiedViewer[],
): Array<{ ipHash: string; userAgentHash: string }> {
  if (openEvents.length === 0) return []

  const uniqueSessions = new Set(openEvents.map(e => e.sessionId)).size
  const uniqueIps = new Set(openEvents.map(e => e.ip).filter((ip): ip is string => ip != null)).size

  if (uniqueSessions === 1 && uniqueIps <= 1) return []

  const notifiedSet = new Set(notifiedViewers.map(v => `${v.ipHash}::${v.userAgentHash}`))
  const seen = new Set<string>()
  const result: Array<{ ipHash: string; userAgentHash: string }> = []

  for (const event of openEvents) {
    if (!event.userAgentHash) continue
    const key = `${event.ipHash}::${event.userAgentHash}`
    if (notifiedSet.has(key) || seen.has(key)) continue
    seen.add(key)
    result.push({ ipHash: event.ipHash, userAgentHash: event.userAgentHash })
  }

  return result
}
