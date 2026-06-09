'use server'

import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLog } from '@/drizzle/schema'
import { leads } from '@/drizzle/schema-leads'

export async function deleteLeadAction(leadId: string) {
  const session = await auth()
  if (session?.user?.role !== 'admin' || !session.user.id) {
    throw new Error('Forbidden')
  }

  await db
    .update(leads)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(leads.id, leadId))

  await db.insert(auditLog).values({
    actorId: session.user.id,
    action: 'lead.deleted',
    targetId: leadId,
    detail: { softDelete: true },
  })

  redirect('/leads')
}
