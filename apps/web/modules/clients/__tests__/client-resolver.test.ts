// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clientAliases, clientContacts, clientMergedReferences, clients, leads } from '@rgtools/db/schema-leads'
import { resolveClient, mergeClients } from '../client-resolver'

const createdClientIds = new Set<string>()
const createdLeadIds = new Set<string>()

function track(clientId: string) {
  createdClientIds.add(clientId)
  return clientId
}

afterEach(async () => {
  for (const leadId of createdLeadIds) await db.delete(leads).where(eq(leads.id, leadId))
  createdLeadIds.clear()
  for (const clientId of createdClientIds) {
    await db.delete(clientMergedReferences).where(eq(clientMergedReferences.survivorClientId, clientId))
    await db.delete(clientAliases).where(eq(clientAliases.clientId, clientId))
    await db.delete(clientContacts).where(eq(clientContacts.clientId, clientId))
    await db.delete(clients).where(eq(clients.id, clientId))
  }
  createdClientIds.clear()
})

const uniqueUuid = () => `cmp-${crypto.randomUUID()}`

describe.skipIf(!process.env.RUN_DB_TESTS)('resolveClient', () => {
  it('returns a single linked client when the same ServiceM8 company UUID is resolved twice', async () => {
    const companyUuid = uniqueUuid()

    const first = await db.transaction((tx) =>
      resolveClient(tx, {
        servicem8CompanyUuid: companyUuid,
        clientName: 'Top View Construction',
        companyName: 'Top View Construction',
        email: 'vivi.zhang@topviewconstruction.co.nz',
        phone: '0210667838',
        phoneNormalized: '+64210667838',
      }),
    )
    track(first.clientId)

    const second = await db.transaction((tx) =>
      resolveClient(tx, {
        servicem8CompanyUuid: companyUuid,
        clientName: 'Top View Construction',
        companyName: 'Top View Construction',
        email: 'lynn.sun@topviewconstruction.co.nz',
        phone: '021 029 04114',
        phoneNormalized: '+642102904114',
      }),
    )
    track(second.clientId)

    expect(second.clientId).toBe(first.clientId)
    expect(second.linked).toBe(true)

    const rows = await db.select().from(clients).where(eq(clients.servicem8CompanyUuid, companyUuid))
    expect(rows).toHaveLength(1)
  })

  it('lets ServiceM8 win on name but preserves RGtools-owned fields on a linked client', async () => {
    const companyUuid = uniqueUuid()

    const first = await db.transaction((tx) =>
      resolveClient(tx, { servicem8CompanyUuid: companyUuid, clientName: 'Greatland' }),
    )
    track(first.clientId)

    // RGtools-owned business intelligence set out-of-band.
    await db
      .update(clients)
      .set({ notes: 'Prefers email contact', clientType: 'builder' })
      .where(eq(clients.id, first.clientId))

    await db.transaction((tx) =>
      resolveClient(tx, { servicem8CompanyUuid: companyUuid, clientName: 'Great Land Construction' }),
    )

    const [row] = await db.select().from(clients).where(eq(clients.id, first.clientId))
    expect(row.name).toBe('Great Land Construction') // ServiceM8 wins
    expect(row.notes).toBe('Prefers email contact') // RGtools-owned preserved
    expect(row.clientType).toBe('builder') // RGtools-owned preserved
  })

  it('matches an existing provisional client by normalized phone instead of duplicating', async () => {
    const phoneNormalized = `+6421${Math.floor(Math.random() * 1_000_000)}`

    const first = await db.transaction((tx) =>
      resolveClient(tx, { clientName: 'Rapid Solutions', phone: '021 555 000', phoneNormalized }),
    )
    track(first.clientId)
    expect(first.linked).toBe(false)

    const second = await db.transaction((tx) =>
      resolveClient(tx, { clientName: 'Rapid Solutions Ltd', phone: '021 555 000', phoneNormalized }),
    )
    track(second.clientId)

    expect(second.clientId).toBe(first.clientId)
    expect(second.matchedExistingClient).toBe(true)
  })

  it('creates separate provisional clients when there is no phone/email to match on', async () => {
    const first = await db.transaction((tx) => resolveClient(tx, { clientName: `NoContact ${crypto.randomUUID()}` }))
    track(first.clientId)
    const second = await db.transaction((tx) => resolveClient(tx, { clientName: `NoContact ${crypto.randomUUID()}` }))
    track(second.clientId)
    expect(second.clientId).not.toBe(first.clientId)
  })

  it('keeps distinct contacts per company and dedupes a repeated contact', async () => {
    const companyUuid = uniqueUuid()
    const base = { servicem8CompanyUuid: companyUuid, clientName: 'Top View Construction' as const }

    const vivi = await db.transaction((tx) =>
      resolveClient(tx, { ...base, email: 'vivi.zhang@topview.co.nz', phone: '0210667838', phoneNormalized: '+64210667838' }),
    )
    track(vivi.clientId)
    const lynn = await db.transaction((tx) =>
      resolveClient(tx, { ...base, email: 'lynn.sun@topview.co.nz', phone: '0210290411', phoneNormalized: '+642102904114' }),
    )
    const viviAgain = await db.transaction((tx) =>
      resolveClient(tx, { ...base, email: 'vivi.zhang@topview.co.nz', phone: '0210667838', phoneNormalized: '+64210667838' }),
    )

    expect(vivi.contactId).toBeTruthy()
    expect(lynn.contactId).not.toBe(vivi.contactId) // distinct people
    expect(viviAgain.contactId).toBe(vivi.contactId) // same person, deduped

    const contacts = await db.select().from(clientContacts).where(eq(clientContacts.clientId, vivi.clientId))
    expect(contacts).toHaveLength(2)
  })
})

describe.skipIf(!process.env.RUN_DB_TESTS)('mergeClients', () => {
  it('re-points leads onto the survivor, folds contacts in, and hides losers as merged references', async () => {
    const survivor = await db.transaction((tx) => resolveClient(tx, { clientName: 'Survivor', email: `survivor-${crypto.randomUUID()}@x.co` }))
    const loser = await db.transaction((tx) => resolveClient(tx, { clientName: 'Loser', email: `loser-${crypto.randomUUID()}@x.co` }))
    track(survivor.clientId)

    const [lead] = await db
      .insert(leads)
      .values({ clientId: loser.clientId, channel: 'phone', product: 'Other', location: 'Albany' })
      .returning({ id: leads.id })
    createdLeadIds.add(lead.id)

    await db.transaction((tx) => mergeClients(tx, survivor.clientId, [loser.clientId]))

    const [movedLead] = await db.select({ clientId: leads.clientId }).from(leads).where(eq(leads.id, lead.id))
    expect(movedLead.clientId).toBe(survivor.clientId)

    const loserRows = await db.select().from(clients).where(eq(clients.id, loser.clientId))
    expect(loserRows).toHaveLength(1)
    expect(loserRows[0]).toMatchObject({ mergedIntoClientId: survivor.clientId, isMerged: true })

    const survivorContacts = await db.select().from(clientContacts).where(eq(clientContacts.clientId, survivor.clientId))
    expect(survivorContacts.length).toBeGreaterThanOrEqual(2) // survivor's own + folded-in loser contact

    const survivorAliases = await db.select().from(clientAliases).where(eq(clientAliases.clientId, survivor.clientId))
    expect(survivorAliases).toEqual(expect.arrayContaining([
      expect.objectContaining({ alias: 'Loser', source: 'merge' }),
    ]))

    const references = await db
      .select()
      .from(clientMergedReferences)
      .where(eq(clientMergedReferences.mergedClientId, loser.clientId))
    expect(references).toEqual([
      expect.objectContaining({
        survivorClientId: survivor.clientId,
        mergedClientId: loser.clientId,
      }),
    ])
  })
})
