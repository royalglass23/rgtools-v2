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

    // 3. Insert user
    const [newUser] = await db
      .insert(users)
      .values({ username, passwordHash, role })
      .returning()

    // 4. Audit
    await db.insert(auditLog).values({
      actorId: session.user.id as string,
      action: AUDIT_ACTIONS.USER_CREATE,
      targetId: newUser.id,
      detail: buildAuditDetail(AUDIT_ACTIONS.USER_CREATE, { username, role }),
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

  // 4. Update
  await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId))

  // 5. Audit
  await db.insert(auditLog).values({
    actorId: session.user.id as string,
    action: AUDIT_ACTIONS.USER_ROLE_CHANGE,
    targetId: userId,
    detail: buildAuditDetail(AUDIT_ACTIONS.USER_ROLE_CHANGE, {
      username: targetRow.username,
      fromRole,
      toRole: role,
    }),
  })

  return { success: true }
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

  // 4. Delete (cascades userModuleAccess via FK)
  await db.delete(users).where(eq(users.id, userId))

  // 5. Audit (username captured above is still in scope)
  await db.insert(auditLog).values({
    actorId: session.user.id as string,
    action: AUDIT_ACTIONS.USER_DELETE,
    targetId: userId,
    detail: buildAuditDetail(AUDIT_ACTIONS.USER_DELETE, { username, role }),
  })

  return { success: true }
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

  // 3. Fetch module
  const moduleRow = await db.query.modules.findFirst({
    where: eq(modules.id, moduleId),
  })

  if (!moduleRow) {
    return { error: 'Module not found' }
  }

  // 4. Refuse adminOnly modules
  if (moduleRow.adminOnly) {
    return { error: 'Cannot alter access for admin-only modules — access is role-driven' }
  }

  // 5. Perform grant or revoke
  if (grant) {
    await db
      .insert(userModuleAccess)
      .values({
        userId,
        moduleId,
        grantedBy: session.user.id as string,
      })
      .onConflictDoNothing()

    await db.insert(auditLog).values({
      actorId: session.user.id as string,
      action: AUDIT_ACTIONS.ACCESS_GRANT,
      targetId: userId,
      detail: buildAuditDetail(AUDIT_ACTIONS.ACCESS_GRANT, {
        username: targetRow.username,
        moduleSlug: moduleRow.slug,
      }),
    })
  } else {
    await db
      .delete(userModuleAccess)
      .where(
        and(
          eq(userModuleAccess.userId, userId),
          eq(userModuleAccess.moduleId, moduleId),
        ),
      )

    await db.insert(auditLog).values({
      actorId: session.user.id as string,
      action: AUDIT_ACTIONS.ACCESS_REVOKE,
      targetId: userId,
      detail: buildAuditDetail(AUDIT_ACTIONS.ACCESS_REVOKE, {
        username: targetRow.username,
        moduleSlug: moduleRow.slug,
      }),
    })
  }

  return { success: true }
}
