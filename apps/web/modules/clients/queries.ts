import { desc, eq, sql } from 'drizzle-orm'
import { quotes } from '@rgtools/db/schema'
import { clientAliases, clientContacts, clients, leads } from '@rgtools/db/schema-leads'
import { db } from '@/lib/db'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ClientShapeBase = {
  id: string
  name: string
  companyName: string | null
  email: string | null
  phone: string | null
  servicem8CompanyUuid: string | null
  canonicalSource: 'import' | 'manual' | 'system'
  reviewStatus: 'pending_review' | 'reviewed' | 'dismissed'
  identityType: string | null
  createdAt: Date
  updatedAt: Date
}

type ClientListShapeInput = ClientShapeBase & {
  aliases: Array<{ alias: string }>
  contacts: Array<{ id: string; updatedAt: Date }>
  leads: Array<{ id: string; updatedAt: Date }>
  quotes: Array<{ id: string; updatedAt: Date }>
}

export type ClientListRow = {
  id: string
  companyName: string
  servicem8CompanyUuid: string | null
  reviewStatus: 'pending_review' | 'reviewed' | 'dismissed'
  aliasNames: string[]
  cleanupFlags: {
    imported: boolean
    needsReview: boolean
    reviewed: boolean
    possibleDuplicate: boolean
    noContactDetails: boolean
    noClientType: boolean
    servicem8Linked: boolean
  }
  contactCount: number
  projectCount: number
  lastActivityAt: Date
}

export type ClientCleanupFilter =
  | 'all'
  | 'imported'
  | 'needs_review'
  | 'reviewed'
  | 'possible_duplicates'
  | 'no_contact_details'
  | 'no_client_type'
  | 'servicem8_linked'

export type ClientListFilters = {
  search?: string | null
  cleanupFilter?: ClientCleanupFilter | null
}

type ClientDetailShapeInput = ClientShapeBase & {
  aliases: Array<{ alias: string }>
  contacts: Array<{
    id: string
    name: string | null
    email: string | null
    phone: string | null
    phoneNormalized: string | null
    updatedAt: Date
  }>
  leads: Array<{
    id: string
    projectType: string | null
    location: string | null
    servicem8JobNumber: string | null
    tier: string | null
    createdAt: Date
    updatedAt: Date
  }>
  quotes: Array<{
    id: string
    shortCode: string | null
    jobDescription: string | null
    jobAddress: string | null
    quoteValue: string | null
    statusTag: string | null
    createdAt: Date
    updatedAt: Date
  }>
}

export type ClientDetail = ClientListRow & {
  contacts: ClientDetailShapeInput['contacts']
  leads: ClientDetailShapeInput['leads']
  quotes: ClientDetailShapeInput['quotes']
  projects: Array<{
    kind: 'lead' | 'quote'
    id: string
    title: string
    address: string | null
    createdAt: Date
    updatedAt: Date
  }>
}

export function shapeClientListRows(rows: ClientListShapeInput[]): ClientListRow[] {
  const duplicateNames = findDuplicateNames(rows)

  return rows.map((row) => ({
    id: row.id,
    companyName: row.companyName || row.name,
    servicem8CompanyUuid: row.servicem8CompanyUuid,
    reviewStatus: row.reviewStatus,
    aliasNames: row.aliases.map((alias) => alias.alias),
    cleanupFlags: {
      imported: row.canonicalSource === 'import',
      needsReview: row.reviewStatus === 'pending_review',
      reviewed: row.reviewStatus === 'reviewed',
      possibleDuplicate: duplicateNames.has(normalizedDisplayName(row)),
      noContactDetails: row.contacts.length === 0 && !row.email && !row.phone,
      noClientType: row.identityType === null,
      servicem8Linked: Boolean(row.servicem8CompanyUuid),
    },
    contactCount: row.contacts.length,
    projectCount: row.leads.length + row.quotes.length,
    lastActivityAt: latestDate([
      row.createdAt,
      row.updatedAt,
      ...row.contacts.map((contact) => contact.updatedAt),
      ...row.leads.map((lead) => lead.updatedAt),
      ...row.quotes.map((quote) => quote.updatedAt),
    ]),
  }))
}

export function filterClientListRows(rows: ClientListRow[], filters: ClientListFilters = {}): ClientListRow[] {
  const search = normalizeSearch(filters.search)
  const cleanupFilter = filters.cleanupFilter ?? 'all'

  return rows.filter((row) => {
    const matchesSearch = !search || [row.companyName, ...row.aliasNames]
      .some((value) => normalizeSearch(value).includes(search))

    return matchesSearch && matchesCleanupFilter(row, cleanupFilter)
  })
}

export function shapeClientDetail(row: ClientDetailShapeInput | null): ClientDetail | null {
  if (!row) return null
  const [summary] = shapeClientListRows([row])
  const projects: ClientDetail['projects'] = [
    ...row.leads.map((lead) => ({
      kind: 'lead' as const,
      id: lead.id,
      title: lead.projectType ?? lead.servicem8JobNumber ?? 'Lead',
      address: lead.location,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    })),
    ...row.quotes.map((quote) => ({
      kind: 'quote' as const,
      id: quote.id,
      title: quote.jobDescription ?? quote.shortCode ?? 'Quote',
      address: quote.jobAddress,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    })),
  ].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())

  return {
    ...summary,
    contacts: row.contacts,
    leads: row.leads,
    quotes: row.quotes,
    projects,
  }
}

export async function getClientsList(filters: ClientListFilters = {}): Promise<ClientListRow[]> {
  const clientRows = await db.select().from(clients).orderBy(clients.name)
  const shaped = await Promise.all(clientRows.map(async (client) => {
    const [aliasesRows, contactsRows, leadRows, quoteRows] = await Promise.all([
      db
        .select({ alias: clientAliases.alias })
        .from(clientAliases)
        .where(eq(clientAliases.clientId, client.id))
        .orderBy(clientAliases.alias),
      db
        .select({ id: clientContacts.id, updatedAt: clientContacts.updatedAt })
        .from(clientContacts)
        .where(eq(clientContacts.clientId, client.id)),
      db
        .select({ id: leads.id, updatedAt: leads.updatedAt })
        .from(leads)
        .where(eq(leads.clientId, client.id)),
      db
        .select({ id: quotes.id, updatedAt: quotes.updatedAt })
        .from(quotes)
        .where(eq(quotes.clientId, client.id)),
    ])

    return {
      ...client,
      aliases: aliasesRows,
      contacts: contactsRows,
      leads: leadRows,
      quotes: quoteRows,
    }
  }))

  return filterClientListRows(shapeClientListRows(shaped), filters)
    .sort((left, right) => right.lastActivityAt.getTime() - left.lastActivityAt.getTime())
}

export async function getClientDetail(clientId: string): Promise<ClientDetail | null> {
  if (!UUID_RE.test(clientId)) return null

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1)
  if (!client) return null

  const [contactsRows, leadRows, quoteRows] = await Promise.all([
    db
      .select({
        id: clientContacts.id,
        name: clientContacts.name,
        email: clientContacts.email,
        phone: clientContacts.phone,
        phoneNormalized: clientContacts.phoneNormalized,
        updatedAt: clientContacts.updatedAt,
      })
      .from(clientContacts)
      .where(eq(clientContacts.clientId, client.id))
      .orderBy(clientContacts.name),
    db
      .select({
        id: leads.id,
        projectType: leads.projectType,
        location: leads.location,
        servicem8JobNumber: leads.servicem8JobNumber,
        tier: leads.tier,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .where(eq(leads.clientId, client.id))
      .orderBy(desc(leads.updatedAt)),
    db
      .select({
        id: quotes.id,
        shortCode: quotes.shortCode,
        jobDescription: quotes.jobDescription,
        jobAddress: quotes.jobAddress,
        quoteValue: quotes.quoteValue,
        statusTag: sql<string | null>`${quotes.statusTag}`,
        createdAt: quotes.createdAt,
        updatedAt: quotes.updatedAt,
      })
      .from(quotes)
      .where(eq(quotes.clientId, client.id))
      .orderBy(desc(quotes.updatedAt)),
  ])

  return shapeClientDetail({
    ...client,
    aliases: [],
    contacts: contactsRows,
    leads: leadRows,
    quotes: quoteRows,
  })
}

function latestDate(dates: Date[]): Date {
  return dates.reduce((latest, date) => date.getTime() > latest.getTime() ? date : latest, dates[0])
}

function matchesCleanupFilter(row: ClientListRow, filter: ClientCleanupFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'imported') return row.cleanupFlags.imported
  if (filter === 'needs_review') return row.cleanupFlags.needsReview
  if (filter === 'reviewed') return row.cleanupFlags.reviewed
  if (filter === 'possible_duplicates') return row.cleanupFlags.possibleDuplicate
  if (filter === 'no_contact_details') return row.cleanupFlags.noContactDetails
  if (filter === 'no_client_type') return row.cleanupFlags.noClientType
  if (filter === 'servicem8_linked') return row.cleanupFlags.servicem8Linked
  return true
}

function findDuplicateNames(rows: ClientListShapeInput[]): Set<string> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const name = normalizedDisplayName(row)
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name))
}

function normalizedDisplayName(row: Pick<ClientShapeBase, 'name' | 'companyName'>): string {
  return normalizeSearch(row.companyName || row.name)
}

function normalizeSearch(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}
