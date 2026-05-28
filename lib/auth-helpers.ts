import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/drizzle/schema'

export async function authorizeUser(credentials: { username: string; password: string }) {
  if (!credentials.username || !credentials.password) return null
  const [user] = await db.select().from(users).where(eq(users.username, credentials.username))
  if (!user) return null
  const valid = await bcrypt.compare(credentials.password, user.passwordHash)
  if (!valid) return null
  return { id: user.id, name: user.username, role: user.role }
}
