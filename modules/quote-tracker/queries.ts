import { and, asc, count, desc, eq, gt, ilike, isNotNull, isNull, lte, or, sql, sum } from 'drizzle-orm'
import { db } from '@/lib/db'
import { quoteEngagement, quoteEvents, quoteRecipients, quoteViewerEmails, quotes, tagOverrides } from '@/drizzle/schema'
import type { QuoteListFilters } from './list-filters'
import { validateEmailGateSettings } from './email-gate'
import { rollupDeviceSessions, rollupGatedEmails } from './viewer-analytics'
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
  const [recipients, gatedEmailAnalytics] = await Promise.all([
    db
      .select()
      .from(quoteRecipients)
      .where(eq(quoteRecipients.quoteId, id))
      .orderBy(asc(quoteRecipients.email)),
    getGatedEmailAnalytics(id),
  ])

  return {
    quote,
    engagement: engagement ?? null,
    events,
    overrides,
    viewerSessions,
    recipients,
    gatedEmailAnalytics,
  }
}

export async function getViewerSessions(quoteId: string) {
  if (!UUID_RE.test(quoteId)) return []

  const events = await db
    .select()
    .from(quoteEvents)
    .where(eq(quoteEvents.quoteId, quoteId))
    .orderBy(asc(quoteEvents.createdAt))

  return rollupDeviceSessions(events)
}

export async function getGatedEmailAnalytics(quoteId: string) {
  if (!UUID_RE.test(quoteId)) return []

  const [events, links] = await Promise.all([
    db
      .select()
      .from(quoteEvents)
      .where(eq(quoteEvents.quoteId, quoteId))
      .orderBy(asc(quoteEvents.createdAt)),
    db
      .select({
        email: quoteViewerEmails.email,
        name: quoteViewerEmails.name,
        sessionId: quoteViewerEmails.sessionId,
      })
      .from(quoteViewerEmails)
      .where(eq(quoteViewerEmails.quoteId, quoteId)),
  ])

  return rollupGatedEmails(events, links)
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

export async function updateQuoteEmailGate(
  quoteId: string,
  input: {
    enabled: boolean
    recipientEmails: string | null
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!UUID_RE.test(quoteId)) return { ok: false, message: 'Quote not found.' }

  const result = validateEmailGateSettings(input)
  if (!result.ok) return result

  await db.transaction(async (tx) => {
    await tx
      .update(quotes)
      .set({
        emailGateEnabled: result.value.enabled,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, quoteId))

    await tx
      .delete(quoteRecipients)
      .where(eq(quoteRecipients.quoteId, quoteId))

    if (result.value.enabled && result.value.recipientEmails.length > 0) {
      await tx.insert(quoteRecipients).values(
        result.value.recipientEmails.map((email) => ({
          quoteId,
          email,
        })),
      )
    }
  })

  return { ok: true }
}

function listWhere(filters: QuoteListFilters) {
  const conditions = []

  if (filters.status !== 'all') {
    conditions.push(eq(quotes.statusTag, filters.status))
  }

  if (filters.linkStatus === 'active') {
    conditions.push(and(isNull(quotes.archivedAt), or(isNull(quotes.expiresAt), gt(quotes.expiresAt, sql`now()`))))
  }

  if (filters.linkStatus === 'expired') {
    conditions.push(or(isNotNull(quotes.archivedAt), lte(quotes.expiresAt, sql`now()`)))
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
