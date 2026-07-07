'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { userCanAccessSlug } from '@/lib/access-db'
import { logAudit } from '@/lib/audit-db'
import { logError } from '@/lib/logger'
import { db } from '@/lib/db'
import { clientAliases, clientContacts, clients } from '@rgtools/db/schema-leads'
import { collectClientAliases } from './client-aliases'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const identityTypeValues = ['company', 'individual_homeowner', 'household', 'contractor', 'sole_trader', 'other'] as const
const clientTypeValues = ['homeowner', 'builder', 'developer', 'investor', 'repeat_exclusive'] as const
const reviewStatusValues = ['pending_review', 'reviewed', 'dismissed'] as const
type ClientIdentityType = typeof identityTypeValues[number]
type LeadClientType = typeof clientTypeValues[number]
type ClientReviewStatus = typeof reviewStatusValues[number]
const identityTypes = new Set<ClientIdentityType>(identityTypeValues)
const clientTypes = new Set<LeadClientType>(clientTypeValues)
const reviewStatuses = new Set<ClientReviewStatus>(reviewStatusValues)

export async function updateClientDashboardAction(clientId: string, formData: FormData): Promise<void> {
  const session = await auth()
  if (session?.user?.role !== 'admin' || !session.user.id) {
    throw new Error('Forbidden')
  }
  if (!await userCanAccessSlug(session.user.id, 'clients')) {
    throw new Error('Forbidden')
  }
  if (!UUID_RE.test(clientId)) throw new Error('Invalid client')

  const now = new Date()
  const reviewStatus = enumValue(formData, 'reviewStatus', reviewStatuses) ?? 'pending_review'
  const primaryContact = {
    name: clean(formData.get('primaryContactName')),
    email: clean(formData.get('primaryContactEmail')),
    phone: clean(formData.get('primaryContactPhone')),
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(clients)
        .set({
          name: requiredString(formData, 'name', 'Client name is required.'),
          companyName: clean(formData.get('companyName')),
          email: clean(formData.get('email')),
          phone: clean(formData.get('phone')),
          identityType: enumValue(formData, 'identityType', identityTypes),
          clientType: enumValue(formData, 'clientType', clientTypes),
          notes: clean(formData.get('notes')),
          reviewStatus,
          reviewNote: clean(formData.get('reviewNote')),
          reviewedBy: reviewStatus === 'reviewed' ? session.user.id : null,
          reviewedAt: reviewStatus === 'reviewed' ? now : null,
          canonicalSource: 'manual',
          canonicalUpdatedBy: session.user.id,
          canonicalUpdatedAt: now,
          updatedAt: now,
        })
        .where(eq(clients.id, clientId))

      if (primaryContact.name || primaryContact.email || primaryContact.phone) {
        const [existingContact] = await tx
          .select({ id: clientContacts.id })
          .from(clientContacts)
          .where(eq(clientContacts.clientId, clientId))
          .orderBy(clientContacts.createdAt)
          .limit(1)

        if (existingContact) {
          await tx
            .update(clientContacts)
            .set({ ...primaryContact, updatedAt: now })
            .where(eq(clientContacts.id, existingContact.id))
        } else {
          await tx
            .insert(clientContacts)
            .values({ clientId, ...primaryContact })
        }
      }

      const aliases = collectClientAliases(String(formData.get('aliases') ?? '').split(/\r?\n/))
      await tx
        .delete(clientAliases)
        .where(and(eq(clientAliases.clientId, clientId), eq(clientAliases.source, 'manual')))

      if (aliases.length > 0) {
        await tx
          .insert(clientAliases)
          .values(aliases.map((alias) => ({ clientId, alias, source: 'manual' as const })))
          .onConflictDoNothing()
      }

      await logAudit({
        actorId: session.user.id,
        action: 'client.dashboard.updated',
        targetId: clientId,
        detail: {
          reviewStatus,
          hasPrimaryContact: Boolean(primaryContact.name || primaryContact.email || primaryContact.phone),
          manualAliasCount: aliases.length,
        },
      }, tx)
    })
  } catch (error) {
    const errorId = await logError('clients.dashboardUpdate.failed', error, {
      userId: session.user.id,
      metadata: { clientId },
    })
    throw new Error(`Failed to update client. Ref: ${errorId}`)
  }

  revalidatePath('/clients')
  revalidatePath(`/clients/${clientId}`)
}

function requiredString(formData: FormData, key: string, message: string): string {
  const value = clean(formData.get(key))
  if (!value) throw new Error(message)
  return value
}

function clean(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function enumValue<T extends string>(formData: FormData, key: string, allowed: Set<T>): T | null {
  const value = clean(formData.get(key))
  return value && allowed.has(value as T) ? value as T : null
}
