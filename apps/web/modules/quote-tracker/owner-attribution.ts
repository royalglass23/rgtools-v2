import { eq } from 'drizzle-orm'

import { users } from '@rgtools/db/schema'
import { db } from '@/lib/db'

export async function resolveOwnerUserIdFromServiceM8Staff(
  staffUuid: string | null | undefined,
): Promise<string | null> {
  const normalized = staffUuid?.trim()
  if (!normalized) return null

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.servicem8StaffUuid, normalized))
    .limit(1)

  return user?.id ?? null
}
