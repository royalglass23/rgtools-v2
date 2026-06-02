/**
 * Pure audit-log helpers — no DB imports, no side effects.
 */

// ── Action constants ──────────────────────────────────────────────────────────

export const AUDIT_ACTIONS = {
  USER_CREATE:      'user.create',
  USER_ROLE_CHANGE: 'user.role_change',
  USER_DELETE:      'user.delete',
  ACCESS_GRANT:     'access.grant',
  ACCESS_REVOKE:    'access.revoke',
} as const

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS]

// ── Per-action detail shapes ──────────────────────────────────────────────────

interface UserCreateDetail      { username: string; role: string }
interface UserRoleChangeDetail  { username: string; fromRole: string; toRole: string }
interface UserDeleteDetail      { username: string; role: string }
interface AccessGrantDetail     { username: string; moduleSlug: string }
interface AccessRevokeDetail    { username: string; moduleSlug: string }

// Map action → expected data shape for overloads
type ActionDetailMap = {
  [AUDIT_ACTIONS.USER_CREATE]:      UserCreateDetail
  [AUDIT_ACTIONS.USER_ROLE_CHANGE]: UserRoleChangeDetail
  [AUDIT_ACTIONS.USER_DELETE]:      UserDeleteDetail
  [AUDIT_ACTIONS.ACCESS_GRANT]:     AccessGrantDetail
  [AUDIT_ACTIONS.ACCESS_REVOKE]:    AccessRevokeDetail
}

// ── buildAuditDetail ──────────────────────────────────────────────────────────

/**
 * Shape a jsonb-ready detail payload for an audit log entry.
 *
 * For known actions the function is typed via overloads so callers get
 * proper type inference. Unknown actions fall back to returning `data` as-is
 * (useful for forward-compatibility without a compile-time error).
 */

// Overloads for known actions
export function buildAuditDetail<A extends AuditAction>(
  action: A,
  data: ActionDetailMap[A],
): ActionDetailMap[A]

// Fallback for unknown / arbitrary actions
export function buildAuditDetail(
  action: string,
  data: Record<string, unknown>,
): Record<string, unknown>

// Implementation
export function buildAuditDetail(
  action: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  switch (action) {
    case AUDIT_ACTIONS.USER_CREATE: {
      const { username, role } = data as unknown as UserCreateDetail
      return { username, role }
    }
    case AUDIT_ACTIONS.USER_ROLE_CHANGE: {
      const { username, fromRole, toRole } = data as unknown as UserRoleChangeDetail
      return { username, fromRole, toRole }
    }
    case AUDIT_ACTIONS.USER_DELETE: {
      const { username, role } = data as unknown as UserDeleteDetail
      return { username, role }
    }
    case AUDIT_ACTIONS.ACCESS_GRANT: {
      const { username, moduleSlug } = data as unknown as AccessGrantDetail
      return { username, moduleSlug }
    }
    case AUDIT_ACTIONS.ACCESS_REVOKE: {
      const { username, moduleSlug } = data as unknown as AccessRevokeDetail
      return { username, moduleSlug }
    }
    default:
      return { ...data }
  }
}
