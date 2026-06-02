'use server'

import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { type Session } from 'next-auth'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, modules, userModuleAccess, auditLog } from '@/drizzle/schema'
import { assertCanManageUser } from '@/lib/access'
import type { AccessUser } from '@/lib/access'
import { AUDIT_ACTIONS, buildAuditDetail } from '@/lib/audit'

// ── Helper: resolve the calling actor as an AccessUser ────────────────────────

interface ActorContext {
  session: Session
  actor: AccessUser
}

async function getActorOrThrow(): Promise<ActorContext> {
  const rawSession = await auth()
  // next-auth's `auth()` is overloaded; when called with no args in server context
  // it returns Session | null. We cast to disambiguate from the middleware overload.
  const session = rawSession as Session | null

  if (session?.user?.role !== 'admin') {
    throw new Error('Forbidden')
  }

  const actorRow = await db.query.users.findFirst({
    where: eq(users.id, session.user.id as string),
  })

  if (!actorRow) {
    throw new Error('Forbidden: actor not found')
  }

  const actor: AccessUser = {
    id: actorRow.id,
    username: actorRow.username,
    role: actorRow.role,
    isProtected: actorRow.isProtected,
  }

  return { session, actor }
}

// ── createUser ────────────────────────────────────────────────────────────────

/**
 * Create a new user account.
 * Only admins may call this action.
 * bcrypt cost 12; username must be unique (DB enforces via UNIQUE constraint).
 */
export async function createUser(data: {
  username: string
  password: string
  role: 'admin' | 'staff'
}): Promise<{ success: true } | { error: string }> {
  const { username, password, role } = data

  // 1. Auth guard — throws if not admin
  const { session, actor } = await getActorOrThrow()

  try {
    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // 3. Insert user + audit in a transaction
    await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({ username, passwordHash, role })
        .returning()

      await tx.insert(auditLog).values({
        actorId: session.user.id as string,
        action: AUDIT_ACTIONS.USER_CREATE,
        targetId: newUser.id,
        detail: buildAuditDetail(AUDIT_ACTIONS.USER_CREATE, { username, role }),
      })
    })

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}

// ── updateUserRole ────────────────────────────────────────────────────────────

/**
 * Change an existing user's role.
 * Blocked on protected users and on regular-admin managing another admin.
 */
export async function updateUserRole(
  userId: string,
  role: 'admin' | 'staff',
): Promise<{ success: true } | { error: string }> {
  // 1. Auth guard
  const { session, actor } = await getActorOrThrow()

  // 2. Fetch target
  const targetRow = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  if (!targetRow) {
    return { error: 'User not found' }
  }

  const target: AccessUser = {
    id: targetRow.id,
    username: targetRow.username,
    role: targetRow.role,
    isProtected: targetRow.isProtected,
  }

  // 3. Access guard
  try {
    assertCanManageUser(actor, target)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }

  const fromRole = targetRow.role

  // 4. Update + audit in a transaction
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ role, updatedAt: new Date() })
        .where(eq(users.id, userId))

      await tx.insert(auditLog).values({
        actorId: session.user.id as string,
        action: AUDIT_ACTIONS.USER_ROLE_CHANGE,
        targetId: userId,
        detail: buildAuditDetail(AUDIT_ACTIONS.USER_ROLE_CHANGE, {
          username: targetRow.username,
          fromRole,
          toRole: role,
        }),
      })
    })

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}

// ── deleteUser ────────────────────────────────────────────────────────────────

/**
 * Hard-delete a user. Cascades grants.
 * Captures username + role BEFORE deletion for the audit row.
 */
export async function deleteUser(
  userId: string,
): Promise<{ success: true } | { error: string }> {
  // 1. Auth guard
  const { session, actor } = await getActorOrThrow()

  // 2. Fetch target BEFORE deletion
  const targetRow = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  if (!targetRow) {
    return { error: 'User not found' }
  }

  const target: AccessUser = {
    id: targetRow.id,
    username: targetRow.username,
    role: targetRow.role,
    isProtected: targetRow.isProtected,
  }

  // Capture these before the row is gone
  const { username, role } = targetRow

  // 3. Access guard
  try {
    assertCanManageUser(actor, target)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }

  // 4. Delete + audit in a transaction
  try {
    await db.transaction(async (tx) => {
      // Delete cascades userModuleAccess via FK
      await tx.delete(users).where(eq(users.id, userId))

      // username captured above is still in scope
      await tx.insert(auditLog).values({
        actorId: session.user.id as string,
        action: AUDIT_ACTIONS.USER_DELETE,
        targetId: userId,
        detail: buildAuditDetail(AUDIT_ACTIONS.USER_DELETE, { username, role }),
      })
    })

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}

// ── setModuleAccess ───────────────────────────────────────────────────────────

/**
 * Grant or revoke a module access for a user.
 * Refuses to alter adminOnly modules (those are role-driven, not granted).
 */
export async function setModuleAccess(
  userId: string,
  moduleId: string,
  grant: boolean,
): Promise<{ success: true } | { error: string }> {
  // 1. Auth guard
  const { session, actor } = await getActorOrThrow()

  // 2. Fetch target user
  const targetRow = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  if (!targetRow) {
    return { error: 'User not found' }
  }

  const target: AccessUser = {
    id: targetRow.id,
    username: targetRow.username,
    role: targetRow.role,
    isProtected: targetRow.isProtected,
  }

  // 3. Access guard — must come before any mutation
  try {
    assertCanManageUser(actor, target)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }

  // 4. Fetch module
  const moduleRow = await db.query.modules.findFirst({
    where: eq(modules.id, moduleId),
  })

  if (!moduleRow) {
    return { error: 'Module not found' }
  }

  // 5. Refuse adminOnly modules
  if (moduleRow.adminOnly) {
    return { error: 'Cannot alter access for admin-only modules — access is role-driven' }
  }

  // 6. Perform grant or revoke in a transaction
  try {
    if (grant) {
      await db.transaction(async (tx) => {
        await tx
          .insert(userModuleAccess)
          .values({
            userId,
            moduleId,
            grantedBy: session.user.id as string,
          })
          .onConflictDoNothing()

        await tx.insert(auditLog).values({
          actorId: session.user.id as string,
          action: AUDIT_ACTIONS.ACCESS_GRANT,
          targetId: userId,
          detail: buildAuditDetail(AUDIT_ACTIONS.ACCESS_GRANT, {
            username: targetRow.username,
            moduleSlug: moduleRow.slug,
          }),
        })
      })
    } else {
      // Check if a grant row actually exists before deleting
      const existingGrant = await db.query.userModuleAccess.findFirst({
        where: and(eq(userModuleAccess.userId, userId), eq(userModuleAccess.moduleId, moduleId)),
      })

      if (!existingGrant) {
        return { success: true } // nothing to revoke, no audit needed
      }

      await db.transaction(async (tx) => {
        await tx
          .delete(userModuleAccess)
          .where(
            and(
              eq(userModuleAccess.userId, userId),
              eq(userModuleAccess.moduleId, moduleId),
            ),
          )

        await tx.insert(auditLog).values({
          actorId: session.user.id as string,
          action: AUDIT_ACTIONS.ACCESS_REVOKE,
          targetId: userId,
          detail: buildAuditDetail(AUDIT_ACTIONS.ACCESS_REVOKE, {
            username: targetRow.username,
            moduleSlug: moduleRow.slug,
          }),
        })
      })
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}
