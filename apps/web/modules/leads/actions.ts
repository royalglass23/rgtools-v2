'use server'

import { inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit-db'
import { leads } from '@rgtools/db/schema-leads'

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

    await Promise.all(leadIds.map((leadId) =>
      logAudit({
        actorId: session.user.id as string,
        entityType: 'lead',
        action: 'lead.deleted',
        targetId: leadId,
        before: { softDelete: false, batch: true },
        after: { softDelete: true, batch: true },
      }, tx),
    ))
  })

  revalidatePath('/leads')
}
