import { and, asc, count, desc, eq, ilike, or, sql, sum } from 'drizzle-orm'
import { db } from '@/lib/db'
import { quoteEngagement, quoteEvents, quotes, tagOverrides } from '@/drizzle/schema'
import type { QuoteListFilters } from './list-filters'
import type { StatusTag } from './score'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function listQuotes(filters: QuoteListFilters) {
  const where = listWhere(filters)
  const offset = (filters.page - 1) * filters.size
  const [totalRow] = await db.select({ total: count() }).from(quotes).where(where)
  const [kpis] = await db
    .select({
      coldCount: count(sql`case when ${quotes.statusTag} = 'cold' then 1 end`),
      hotCount: count(sql`case when ${quotes.statusTag} = 'hot' then 1 end`),
      warmCount: count(sql`case when ${quotes.statusTag} = 'warm' then 1 end`),
      deadCount: count(sql`case when ${quotes.statusTag} = 'dead' then 1 end`),
      forwardingCount: count(sql`case when ${quoteEngagement.forwardingSuspected} = true then 1 end`),
      totalValue: sum(quotes.quoteValue),
      averageScore: sql<number>`coalesce(round(avg(${quotes.aiScore})), 0)`,
    })
    .from(quotes)
    .leftJoin(quoteEngagement, eq(quoteEngagement.quoteId, quotes.id))
    .where(where)

  const rows = await db
    .select({
      id: quotes.id,
      shortCode: quotes.shortCode,
      clientName: quotes.clientName,
      companyName: quotes.companyName,
      jobDescription: quotes.jobDescription,
      jobAddress: quotes.jobAddress,
      quoteValue: quotes.quoteValue,
      statusTag: quotes.statusTag,
      aiScore: quotes.aiScore,
      totalOpens: quoteEngagement.totalOpens,
      lastOpenedAt: quoteEngagement.lastOpenedAt,
      forwardingSuspected: quoteEngagement.forwardingSuspected,
      expiresAt: quotes.expiresAt,
      createdAt: quotes.createdAt,
    })
    .from(quotes)
    .leftJoin(quoteEngagement, eq(quoteEngagement.quoteId, quotes.id))
    .where(where)
    .orderBy(...listOrderBy(filters))
    .limit(filters.size)
    .offset(offset)

  const total = totalRow?.total ?? 0

  return {
    rows,
    total,
    pageCount: Math.max(1, Math.ceil(total / filters.size)),
    kpis: {
      coldCount: kpis?.coldCount ?? 0,
      hotCount: kpis?.hotCount ?? 0,
      warmCount: kpis?.warmCount ?? 0,
      deadCount: kpis?.deadCount ?? 0,
      forwardingCount: kpis?.forwardingCount ?? 0,
      totalValue: kpis?.totalValue ?? '0',
      averageScore: Number(kpis?.averageScore ?? 0),
    },
  }
}

export async function getQuoteDetail(id: string) {
  if (!UUID_RE.test(id)) return null

  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, id))
    .limit(1)

  if (!quote) return null

  const [engagement] = await db
    .select()
    .from(quoteEngagement)
    .where(eq(quoteEngagement.quoteId, id))
    .limit(1)

  const [events, overrides, viewerSessions] = await Promise.all([
    db
      .select()
      .from(quoteEvents)
      .where(eq(quoteEvents.quoteId, id))
      .orderBy(desc(quoteEvents.createdAt)),
    db
      .select()
      .from(tagOverrides)
      .where(eq(tagOverrides.quoteId, id))
      .orderBy(desc(tagOverrides.createdAt)),
    getViewerSessions(id),
  ])

  return {
    quote,
    engagement: engagement ?? null,
    events,
    overrides,
    viewerSessions,
  }
}

export async function getViewerSessions(quoteId: string) {
  if (!UUID_RE.test(quoteId)) return []

  const events = await db
    .select()
    .from(quoteEvents)
    .where(eq(quoteEvents.quoteId, quoteId))
    .orderBy(asc(quoteEvents.createdAt))

  const sessions = new Map<string, {
    sessionId: string
    ip: string | null
    geoCity: string | null
    geoIsp: string | null
    geoCountry: string | null
    deviceType: string | null
    opens: number
    totalTimeMs: number
    maxScrollDepth: number
    maxPageSeen: number
    hasCta: boolean
    firstSeenAt: Date
    lastSeenAt: Date
  }>()

  for (const event of events) {
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
      maxPageSeen: 0,
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
    session.maxPageSeen = Math.max(session.maxPageSeen, event.pageNumber ?? 0)
    session.hasCta = session.hasCta || event.eventType === 'cta'
    session.firstSeenAt = session.firstSeenAt < event.createdAt ? session.firstSeenAt : event.createdAt
    session.lastSeenAt = session.lastSeenAt > event.createdAt ? session.lastSeenAt : event.createdAt

    sessions.set(event.sessionId, session)
  }

  return Array.from(sessions.values()).sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
}

export async function setManualTag(quoteId: string, tag: StatusTag, actorId: string) {
  if (!UUID_RE.test(quoteId) || !UUID_RE.test(actorId)) return

  const [quote] = await db
    .select({ statusTag: quotes.statusTag })
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1)

  if (!quote) return

  await db.insert(tagOverrides).values({
    quoteId,
    overriddenBy: actorId,
    previousTag: quote.statusTag ?? 'cold',
    newTag: tag,
  })

  await db
    .update(quotes)
    .set({ statusTag: tag, updatedAt: new Date() })
    .where(eq(quotes.id, quoteId))
}

export async function updateQuoteScore(quoteId: string, score: number, tag: StatusTag) {
  if (!UUID_RE.test(quoteId)) return

  await db
    .update(quotes)
    .set({ aiScore: score, statusTag: tag, updatedAt: new Date() })
    .where(eq(quotes.id, quoteId))
}

function listWhere(filters: QuoteListFilters) {
  const conditions = []

  if (filters.status !== 'all') {
    conditions.push(eq(quotes.statusTag, filters.status))
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(or(
      ilike(quotes.clientName, pattern),
      ilike(quotes.companyName, pattern),
      ilike(quotes.shortCode, pattern),
      ilike(quotes.jobDescription, pattern),
      ilike(quotes.jobAddress, pattern),
    ))
  }

  return conditions.length > 0 ? and(...conditions) : undefined
}

function listOrderBy(filters: QuoteListFilters) {
  if (filters.sort === 'client_asc') return [asc(quotes.clientName), desc(quotes.createdAt)]
  if (filters.sort === 'client_desc') return [desc(quotes.clientName), desc(quotes.createdAt)]
  if (filters.sort === 'value_asc') return [asc(sql<number>`cast(${quotes.quoteValue} as numeric)`), desc(quotes.createdAt)]
  if (filters.sort === 'value_desc') return [desc(sql<number>`cast(${quotes.quoteValue} as numeric)`), desc(quotes.createdAt)]
  if (filters.sort === 'interest_asc') return [asc(sql<number>`coalesce(${quotes.aiScore}, 0)`), desc(quotes.createdAt)]
  if (filters.sort === 'interest_desc') return [desc(sql<number>`coalesce(${quotes.aiScore}, 0)`), desc(quotes.createdAt)]

  return [sql`${quoteEngagement.lastOpenedAt} desc nulls last`, desc(quotes.createdAt)]
}
