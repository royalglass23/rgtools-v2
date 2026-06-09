'use server'

import { inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLog } from '@/drizzle/schema'
import { leads } from '@/drizzle/schema-leads'

export async function batchDeleteLeadsAction(formData: FormData) {
  const session = await auth()
  if (session?.user?.role !== 'admin' || !session.user.id) {
    throw new Error('Forbidden')
  }

  const leadIds = formData
    .getAll('leadId')
    .map((value) => String(value))
    .filter(Boolean)

  if (leadIds.length === 0) return

  const now = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(leads)
      .set({ archivedAt: now, updatedAt: now })
      .where(inArray(leads.id, leadIds))

    await tx.insert(auditLog).values(
      leadIds.map((leadId) => ({
        actorId: session.user.id as string,
        action: 'lead.deleted',
        targetId: leadId,
        detail: { softDelete: true, batch: true },
      })),
    )
  })

  revalidatePath('/leads')
}
