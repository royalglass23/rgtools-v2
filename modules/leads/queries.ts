import { and, count, desc, eq, gte, isNotNull, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clients, leadCategoryScores, leads } from '@/drizzle/schema-leads'
import { getActiveScoringOptionLists } from '@/modules/lead-intake/scoring/config-options'

export type LeadsListFilters = {
  tier: 'all' | 'A' | 'B' | 'C' | 'D'
  sm8: 'all' | 'linked' | 'pending' | 'failed'
  date: '7' | '30' | 'all'
  page: number
  size: 10 | 20 | 50 | 100
}

export type ParseLeadsListFiltersOptions = {
  /** Prefix applied to every param name, e.g. `leads_` when the table is embedded alongside others. */
  prefix?: string
  /** Default values (admin-set) used when a param is absent from the URL. */
  defaults?: Partial<Record<'tier' | 'sm8' | 'date' | 'size', string>>
}

export function parseLeadsListFilters(
  searchParams: Record<string, string | string[] | undefined>,
  options: ParseLeadsListFiltersOptions = {},
): LeadsListFilters {
  const { prefix = '', defaults = {} } = options
  const pick = (name: 'tier' | 'sm8' | 'date' | 'size') =>
    stringValue(searchParams[`${prefix}${name}`]) ?? defaults[name]

  const tier = pick('tier')
  const sm8 = pick('sm8')
  const date = pick('date')
  const page = Number(stringValue(searchParams[`${prefix}page`]) ?? '1')
  const size = Number(pick('size') ?? '10')

  return {
    tier: tier === 'A' || tier === 'B' || tier === 'C' || tier === 'D' ? tier : 'all',
    sm8: sm8 === 'linked' || sm8 === 'pending' || sm8 === 'failed' ? sm8 : 'all',
    date: date === '7' || date === '30' || date === 'all' ? date : '30',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    size: size === 20 || size === 50 || size === 100 ? size : 10,
  }
}

export async function getLeadsList(filters: LeadsListFilters) {
  const where = listWhere(filters)
  const offset = (filters.page - 1) * filters.size

  const [totalRow] = await db.select({ total: count() }).from(leads).where(where)
  const rows = await db
    .select({
      id: leads.id,
      createdAt: leads.createdAt,
      clientName: clients.name,
      companyName: clients.companyName,
      location: leads.location,
      projectType: leads.projectType,
      tier: leads.tier,
      seedScore: leads.seedScore,
      servicem8JobUuid: leads.servicem8JobUuid,
      syncStatus: leads.syncStatus,
      completeness: leads.completeness,
    })
    .from(leads)
    .innerJoin(clients, eq(leads.clientId, clients.id))
    .where(where)
    .orderBy(desc(leads.createdAt))
    .limit(filters.size)
    .offset(offset)

  return {
    rows,
    total: totalRow?.total ?? 0,
    pageCount: Math.max(1, Math.ceil((totalRow?.total ?? 0) / filters.size)),
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getLeadDetail(leadId: string) {
  if (!UUID_RE.test(leadId)) return null

  const [lead] = await db
    .select({
      id: leads.id,
      createdAt: leads.createdAt,
      clientName: clients.name,
      companyName: clients.companyName,
      phone: clients.phone,
      email: clients.email,
      location: leads.location,
      source: leads.source,
      projectType: leads.projectType,
      freeText: leads.freeText,
      budgetBand: leads.budgetBand,
      consentStatus: leads.consentStatus,
      decisionMakers: leads.decisionMakers,
      priceSensitivityRead: leads.priceSensitivityRead,
      tier: leads.tier,
      seedScore: leads.seedScore,
      completeness: leads.completeness,
      strikeFlag: leads.strikeFlag,
      scoreReason: leads.scoreReason,
      servicem8JobUuid: leads.servicem8JobUuid,
      servicem8Status: leads.servicem8Status,
    })
    .from(leads)
    .innerJoin(clients, eq(leads.clientId, clients.id))
    .where(and(eq(leads.id, leadId), isNull(leads.archivedAt)))
    .limit(1)

  if (!lead) return null

  const categoryRows = await db
    .select({
      category: leadCategoryScores.category,
      answerKey: leadCategoryScores.answerKey,
      points: leadCategoryScores.points,
    })
    .from(leadCategoryScores)
    .where(eq(leadCategoryScores.leadId, leadId))
    .orderBy(leadCategoryScores.category)

  const optionLists = await getActiveScoringOptionLists()
  const scoredFields = [1, 2, 3, 4, 5, 6, 7].map((category) => {
    const row = categoryRows.find((candidate) => candidate.category === category)
    const configCategory = optionLists.categories[String(category)]
    const label = configCategory?.label ?? categoryLabel(category)
    const selected = configCategory?.options.find((option) => option.key === row?.answerKey)?.label

    return {
      category,
      label,
      answer: selected ?? row?.answerKey ?? 'Not selected',
      points: row?.points ?? 0,
    }
  })

  return {
    ...lead,
    scoredFields,
    distanceBand: scoredFields.find((field) => field.category === 7)?.answer ?? 'Not selected',
  }
}

function listWhere(filters: LeadsListFilters) {
  const conditions = [isNull(leads.archivedAt)]

  if (filters.tier !== 'all') conditions.push(eq(leads.tier, filters.tier))
  if (filters.sm8 === 'linked') conditions.push(isNotNull(leads.servicem8JobUuid))
  if (filters.sm8 === 'pending') {
    conditions.push(eq(leads.syncStatus, 'synced'))
    conditions.push(isNull(leads.servicem8JobUuid))
  }
  if (filters.sm8 === 'failed') conditions.push(eq(leads.syncStatus, 'sync_failed'))
  if (filters.date !== 'all') {
    const start = new Date()
    start.setDate(start.getDate() - Number(filters.date))
    conditions.push(gte(leads.createdAt, start))
  }

  return and(...conditions) ?? sql`true`
}

function stringValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function categoryLabel(category: number) {
  const labels: Record<number, string> = {
    1: 'Client Type',
    2: 'Budget Band',
    3: 'Consent Status',
    4: 'Complexity',
    5: 'Price-sensitivity Read',
    6: 'Decision-makers',
    7: 'Distance',
  }

  return labels[category] ?? `Category ${category}`
}
