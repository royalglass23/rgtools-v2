import { desc, eq, sql } from 'drizzle-orm'
import { quotes } from '@/drizzle/schema'
import { clientContacts, clients, leads } from '@/drizzle/schema-leads'
import { db } from '@/lib/db'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ClientShapeBase = {
  id: string
  name: string
  companyName: string | null
  servicem8CompanyUuid: string | null
  createdAt: Date
  updatedAt: Date
}

type ClientListShapeInput = ClientShapeBase & {
  contacts: Array<{ id: string; updatedAt: Date }>
  leads: Array<{ id: string; updatedAt: Date }>
  quotes: Array<{ id: string; updatedAt: Date }>
}

export type ClientListRow = {
  id: string
  companyName: string
  servicem8CompanyUuid: string | null
  contactCount: number
  projectCount: number
  lastActivityAt: Date
}

type ClientDetailShapeInput = ClientShapeBase & {
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
  return rows.map((row) => ({
    id: row.id,
    companyName: row.companyName || row.name,
    servicem8CompanyUuid: row.servicem8CompanyUuid,
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

export async function getClientsList(): Promise<ClientListRow[]> {
  const clientRows = await db.select().from(clients).orderBy(clients.name)
  const shaped = await Promise.all(clientRows.map(async (client) => {
    const [contactsRows, leadRows, quoteRows] = await Promise.all([
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
      contacts: contactsRows,
      leads: leadRows,
      quotes: quoteRows,
    }
  }))

  return shapeClientListRows(shaped).sort((left, right) => right.lastActivityAt.getTime() - left.lastActivityAt.getTime())
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
    contacts: contactsRows,
    leads: leadRows,
    quotes: quoteRows,
  })
}

function latestDate(dates: Date[]): Date {
  return dates.reduce((latest, date) => date.getTime() > latest.getTime() ? date : latest, dates[0])
}
