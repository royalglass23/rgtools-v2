/**
 * DB-backed access helpers — server-side only.
 * Thin wrappers over the pure logic in lib/access.ts.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users, modules, userModuleAccess } from '@rgtools/db/schema'
import { canAccessModule } from '@/lib/access'
import type { AccessUser, AccessModule } from '@/lib/access'

type ModuleRow = typeof modules.$inferSelect

/**
 * Returns all active modules the user is allowed to access.
 *
 * - Admin  → every active module (including adminOnly ones)
 * - Staff  → active, non-adminOnly modules where a grant row exists
 */
export async function getAccessibleModules(userId: string): Promise<ModuleRow[]> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  if (!user) return []

  const accessUser: AccessUser = {
    id: user.id,
    username: user.username,
    role: user.role,
    isProtected: user.isProtected,
  }

  if (accessUser.role === 'admin') {
    // Admins see all active modules
    return db.query.modules.findMany({
      where: eq(modules.isActive, true),
    })
  }

  // Staff: fetch grant rows, build grantSet, then filter
  const grants = await db
    .select()
    .from(userModuleAccess)
    .where(eq(userModuleAccess.userId, userId))

  const grantSet = new Set(grants.map((g) => g.moduleId))

  const activeModules = await db.query.modules.findMany({
    where: eq(modules.isActive, true),
  })

  return activeModules.filter((mod) => {
    const accessModule: AccessModule = {
      id: mod.id,
      slug: mod.slug,
      adminOnly: mod.adminOnly,
      isActive: mod.isActive,
    }
    return canAccessModule(accessUser, accessModule, grantSet)
  })
}

/**
 * Returns true if the user is allowed to access the module identified by `slug`.
 * Intended for use in middleware / route guards.
 */
export async function userCanAccessSlug(userId: string, slug: string): Promise<boolean> {
  const accessible = await getAccessibleModules(userId)
  return accessible.some((mod) => mod.slug === slug)
}
