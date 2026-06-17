export type AnalyticsEventType = 'open' | 'scroll' | 'close' | 'page_view' | 'download' | 'cta'

export type AnalyticsEvent = {
  sessionId: string
  ip: string | null
  geoCity: string | null
  geoIsp: string | null
  geoCountry: string | null
  deviceType: string | null
  eventType: AnalyticsEventType
  pageNumber: number | null
  durationMs: number | null
  scrollDepth: number | null
  createdAt: Date
}

export type PageTime = { pageNumber: number; activeMs: number }

export type DeviceSession = {
  sessionId: string
  ip: string | null
  geoCity: string | null
  geoIsp: string | null
  geoCountry: string | null
  deviceType: string | null
  opens: number
  totalTimeMs: number
  maxScrollDepth: number
  pagesSeen: number
  perPage: PageTime[]
  hasCta: boolean
  firstSeenAt: Date
  lastSeenAt: Date
}

export function rollupDeviceSessions(events: AnalyticsEvent[]): DeviceSession[] {
  const ordered = [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const sessions = new Map<string, DeviceSession>()
  const perPageMs = new Map<string, Map<number, number>>()

  for (const event of ordered) {
    const existing = sessions.get(event.sessionId)
    const session = existing ?? {
      sessionId: event.sessionId,
      ip: event.ip,
      geoCity: event.geoCity,
      geoIsp: event.geoIsp,
      geoCountry: event.geoCountry,
      deviceType: event.deviceType,
      opens: 0,
      totalTimeMs: 0,
      maxScrollDepth: 0,
      pagesSeen: 0,
      perPage: [],
      hasCta: false,
      firstSeenAt: event.createdAt,
      lastSeenAt: event.createdAt,
    }

    session.ip ??= event.ip
    session.geoCity ??= event.geoCity
    session.geoIsp ??= event.geoIsp
    session.geoCountry ??= event.geoCountry
    session.deviceType ??= event.deviceType
    session.opens += event.eventType === 'open' ? 1 : 0
    session.totalTimeMs += event.durationMs ?? 0
    session.maxScrollDepth = Math.max(session.maxScrollDepth, event.scrollDepth ?? 0)
    session.hasCta = session.hasCta || event.eventType === 'cta'
    session.firstSeenAt = session.firstSeenAt < event.createdAt ? session.firstSeenAt : event.createdAt
    session.lastSeenAt = session.lastSeenAt > event.createdAt ? session.lastSeenAt : event.createdAt

    if (event.eventType === 'page_view' && event.pageNumber != null) {
      const pages = perPageMs.get(event.sessionId) ?? new Map<number, number>()
      pages.set(event.pageNumber, (pages.get(event.pageNumber) ?? 0) + (event.durationMs ?? 0))
      perPageMs.set(event.sessionId, pages)
    }

    sessions.set(event.sessionId, session)
  }

  for (const [sessionId, pages] of perPageMs) {
    const session = sessions.get(sessionId)
    if (!session) continue
    session.perPage = Array.from(pages.entries())
      .map(([pageNumber, activeMs]) => ({ pageNumber, activeMs }))
      .sort((a, b) => a.pageNumber - b.pageNumber)
    session.pagesSeen = session.perPage.length
  }

  return Array.from(sessions.values()).sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
}

export type EmailLink = {
  email: string
  name: string | null
  sessionId: string
}

export type EmailGroup = {
  email: string
  name: string | null
  devices: DeviceSession[]
  opens: number
  totalTimeMs: number
  pagesSeen: number
  hasCta: boolean
  lastSeenAt: Date | null
  forwardingSuspected: boolean
}

export function rollupGatedEmails(events: AnalyticsEvent[], links: EmailLink[]): EmailGroup[] {
  const emailBySession = new Map<string, { email: string; name: string | null }>()
  for (const link of links) {
    if (!emailBySession.has(link.sessionId)) {
      emailBySession.set(link.sessionId, { email: link.email, name: link.name })
    }
  }

  const eventsByEmail = new Map<string, { name: string | null; events: AnalyticsEvent[] }>()
  for (const event of events) {
    const link = emailBySession.get(event.sessionId)
    if (!link) continue
    const bucket = eventsByEmail.get(link.email) ?? { name: link.name, events: [] }
    bucket.events.push(event)
    eventsByEmail.set(link.email, bucket)
  }

  const groups: EmailGroup[] = []
  for (const [email, bucket] of eventsByEmail) {
    const devices = rollupDeviceSessions(bucket.events)
    const distinctPages = new Set<number>()
    for (const device of devices) {
      for (const page of device.perPage) distinctPages.add(page.pageNumber)
    }
    const lastSeenAt = devices.reduce<Date | null>(
      (latest, d) => (latest && latest > d.lastSeenAt ? latest : d.lastSeenAt),
      null,
    )
    groups.push({
      email,
      name: bucket.name,
      devices,
      opens: devices.reduce((sum, d) => sum + d.opens, 0),
      totalTimeMs: devices.reduce((sum, d) => sum + d.totalTimeMs, 0),
      pagesSeen: distinctPages.size,
      hasCta: devices.some((d) => d.hasCta),
      lastSeenAt,
      forwardingSuspected: devices.length > 1,
    })
  }

  return groups.sort((a, b) => (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0))
}
