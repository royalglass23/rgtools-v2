import { and, eq, inArray, isNull, isNotNull, or, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { quotes } from '@/drizzle/schema'
import { clients, clientContacts, leads } from '@/drizzle/schema-leads'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type ResolveClientInput = {
  /** Canonical ServiceM8 company identity. When present, the client is "linked". */
  servicem8CompanyUuid?: string | null
  clientName: string
  companyName?: string | null
  phone?: string | null
  phoneNormalized?: string | null
  email?: string | null
}

export type ResolveClientResult = {
  clientId: string
  contactId: string | null
  matchedExistingClient: boolean
  linked: boolean
}

export async function resolveClient(tx: Tx, input: ResolveClientInput): Promise<ResolveClientResult> {
  const now = new Date()
  const companyUuid = input.servicem8CompanyUuid?.trim() || null

  if (companyUuid) {
    const [row] = await tx
      .insert(clients)
      .values({
        servicem8CompanyUuid: companyUuid,
        name: input.clientName,
        companyName: input.companyName || null,
        phone: input.phone || null,
        phoneNormalized: input.phoneNormalized || null,
        email: input.email || null,
      })
      .onConflictDoUpdate({
        target: clients.servicem8CompanyUuid,
        targetWhere: isNotNull(clients.servicem8CompanyUuid),
        set: {
          name: input.clientName,
          companyName: input.companyName || null,
          phone: input.phone || null,
          phoneNormalized: input.phoneNormalized || null,
          email: input.email || null,
          updatedAt: now,
        },
      })
      .returning({ id: clients.id })

    const contactId = await resolveContact(tx, row.id, input)
    return { clientId: row.id, contactId, matchedExistingClient: true, linked: true }
  }

  // Provisional path: no canonical identity yet. Match against other
  // provisional clients by normalized phone or email so we don't fragment a
  // company before ServiceM8 sync assigns it a company UUID.
  const matched = await findProvisionalMatch(tx, input.phoneNormalized || null, input.email || null)
  if (matched) {
    await tx
      .update(clients)
      .set({
        name: input.clientName,
        companyName: input.companyName || matched.companyName,
        phone: input.phone || matched.phone,
        phoneNormalized: input.phoneNormalized || matched.phoneNormalized,
        email: input.email || matched.email,
        updatedAt: now,
      })
      .where(eq(clients.id, matched.id))
    const contactId = await resolveContact(tx, matched.id, input)
    return { clientId: matched.id, contactId, matchedExistingClient: true, linked: false }
  }

  const [created] = await tx
    .insert(clients)
    .values({
      name: input.clientName,
      companyName: input.companyName || null,
      phone: input.phone || null,
      phoneNormalized: input.phoneNormalized || null,
      email: input.email || null,
    })
    .returning({ id: clients.id })

  const contactId = await resolveContact(tx, created.id, input)
  return { clientId: created.id, contactId, matchedExistingClient: false, linked: false }
}

/**
 * Resolve the contact (person) for a client, deduped WITHIN that company by
 * normalized phone or email. Scoping to the company is what makes "same email
 * = same contact" safe even when two companies share a generic info@ address.
 * Returns null when there is no phone/email and no name to anchor a contact.
 */
async function resolveContact(tx: Tx, clientId: string, input: ResolveClientInput): Promise<string | null> {
  const phoneNormalized = input.phoneNormalized || null
  const email = input.email || null
  const name = input.clientName?.trim() || null
  if (!phoneNormalized && !email && !name) return null

  const now = new Date()
  const matchers: SQL[] = []
  if (phoneNormalized) matchers.push(eq(clientContacts.phoneNormalized, phoneNormalized))
  if (email) matchers.push(eq(clientContacts.email, email))

  if (matchers.length > 0) {
    const [existing] = await tx
      .select({ id: clientContacts.id })
      .from(clientContacts)
      .where(and(eq(clientContacts.clientId, clientId), matchers.length === 1 ? matchers[0] : or(...matchers)))
      .limit(1)
    if (existing) {
      await tx
        .update(clientContacts)
        .set({ name, phone: input.phone || null, phoneNormalized, email, updatedAt: now })
        .where(eq(clientContacts.id, existing.id))
      return existing.id
    }
  }

  const [created] = await tx
    .insert(clientContacts)
    .values({ clientId, name, phone: input.phone || null, phoneNormalized, email })
    .returning({ id: clientContacts.id })
  return created.id
}

async function findProvisionalMatch(tx: Tx, phoneNormalized: string | null, email: string | null) {
  const matchers: SQL[] = []
  if (phoneNormalized) matchers.push(eq(clients.phoneNormalized, phoneNormalized))
  if (email) matchers.push(eq(clients.email, email))
  if (matchers.length === 0) return null

  const [row] = await tx
    .select()
    .from(clients)
    .where(and(isNull(clients.servicem8CompanyUuid), matchers.length === 1 ? matchers[0] : or(...matchers)))
    .limit(1)

  return row ?? null
}

/**
 * Absorb `loserIds` into `survivorId`: re-point every project and contact onto
 * the survivor, then delete the losers. Transactional — the caller owns the tx.
 */
export async function mergeClients(tx: Tx, survivorId: string, loserIds: string[]): Promise<void> {
  const losers = loserIds.filter((id) => id && id !== survivorId)
  if (losers.length === 0) return
  const now = new Date()

  // Move people to the survivor BEFORE deleting losers — the FK cascade would
  // otherwise drop their contacts.
  await tx.update(clientContacts).set({ clientId: survivorId, updatedAt: now }).where(inArray(clientContacts.clientId, losers))
  await tx.update(leads).set({ clientId: survivorId, updatedAt: now }).where(inArray(leads.clientId, losers))
  await tx.update(quotes).set({ clientId: survivorId, updatedAt: now }).where(inArray(quotes.clientId, losers))
  await tx.delete(clients).where(inArray(clients.id, losers))
}
