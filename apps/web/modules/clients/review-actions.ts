'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { userCanAccessSlug } from '@/lib/access-db'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit-db'
import { clients } from '@rgtools/db/schema-leads'
import { mergeClients } from './client-resolver'

export async function confirmClientMergeReviewGroup(formData: FormData): Promise<void> {
  const session = await auth()
  if (session?.user?.role !== 'admin' || !session.user.id) {
    throw new Error('Forbidden')
  }
  if (!await userCanAccessSlug(session.user.id, 'clients')) {
    throw new Error('Forbidden')
  }

  const survivorId = String(formData.get('survivorId') ?? '')
  const loserIds = formData
    .getAll('loserIds')
    .map(String)
    .filter((id) => id && id !== survivorId)

  if (!survivorId || loserIds.length === 0) return

  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, survivorId))
      .limit(1)
    if (rows.length === 0) throw new Error('Survivor client not found')

    await mergeClients(tx, survivorId, loserIds)
    await logAudit({
      actorId: session.user.id as string,
      action: 'client.review_merge.confirmed',
      targetId: survivorId,
      before: { loserIds },
      after: { survivorId },
    }, tx)
  })

  revalidatePath('/admin/client-merge-review')
}
