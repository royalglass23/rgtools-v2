/**
 * Pure audit-log helpers - no DB imports, no side effects.
 */

export const AUDIT_ACTIONS = {
  USER_CREATE: 'user.create',
  USER_ROLE_CHANGE: 'user.role_change',
  USER_DELETE: 'user.delete',
  ACCESS_GRANT: 'access.grant',
  ACCESS_REVOKE: 'access.revoke',
  LEAD_CREATE: 'lead.created',
  LEAD_EDIT: 'lead.edited',
  LEAD_DELETE: 'lead.deleted',
  LEAD_SERVICEM8_SYNC: 'lead.servicem8_sync',
  QUOTE_CREATE: 'quote.created',
  QUOTE_EDIT: 'quote.edited',
  SCORING_ACTIVATE: 'scoring.activate',
  SCORING_ARCHIVE: 'scoring.archive',
  PRICING_ACTIVATE: 'pricing.activate',
  PRICING_ARCHIVE: 'pricing.archive',
} as const

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS]
export type AuditEntityType = 'user' | 'access' | 'lead' | 'quote' | 'work_order' | 'scoring' | 'pricing'
export type AuditDiffEntry = { from?: unknown; to?: unknown }
export type AuditDiff = Record<string, AuditDiffEntry>

interface UserCreateDetail { username: string; role: string }
interface UserRoleChangeDetail { username: string; fromRole: string; toRole: string }
interface UserDeleteDetail { username: string; role: string }
interface AccessGrantDetail { username: string; moduleSlug: string }
interface AccessRevokeDetail { username: string; moduleSlug: string }

type ActionDetailMap = {
  [AUDIT_ACTIONS.USER_CREATE]: UserCreateDetail
  [AUDIT_ACTIONS.USER_ROLE_CHANGE]: UserRoleChangeDetail
  [AUDIT_ACTIONS.USER_DELETE]: UserDeleteDetail
  [AUDIT_ACTIONS.ACCESS_GRANT]: AccessGrantDetail
  [AUDIT_ACTIONS.ACCESS_REVOKE]: AccessRevokeDetail
}
type LegacyAuditAction = keyof ActionDetailMap

const ENTITY_TYPES: AuditEntityType[] = ['user', 'access', 'lead', 'quote', 'work_order', 'scoring', 'pricing']

export function buildAuditDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): AuditDiff {
  const diff: AuditDiff = {}
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])

  for (const key of keys) {
    const hadBefore = before != null && Object.prototype.hasOwnProperty.call(before, key)
    const hasAfter = after != null && Object.prototype.hasOwnProperty.call(after, key)
    const from = hadBefore ? before[key] : undefined
    const to = hasAfter ? after[key] : undefined

    if (hadBefore && hasAfter && valuesEqual(from, to)) continue

    const entry: AuditDiffEntry = {}
    if (hadBefore) entry.from = from
    if (hasAfter) entry.to = to
    diff[key] = entry
  }

  return diff
}

export function deriveAuditEntityType(action: string): AuditEntityType | null {
  const prefix = action.split('.')[0]
  return ENTITY_TYPES.includes(prefix as AuditEntityType) ? (prefix as AuditEntityType) : null
}

export function formatAuditDetail(detail: unknown): string {
  if (!isPlainRecord(detail)) return ''

  return Object.entries(detail)
    .map(([key, value]) => {
      if (isDiffEntry(value)) {
        const hasFrom = Object.prototype.hasOwnProperty.call(value, 'from')
        const hasTo = Object.prototype.hasOwnProperty.call(value, 'to')
        if (hasFrom && hasTo) return `${key}: ${formatAuditValue(value.from)} -> ${formatAuditValue(value.to)}`
        if (hasTo) return `${key}: ${formatAuditValue(value.to)}`
        return `${key}: ${formatAuditValue(value.from)} -> empty`
      }
      return `${key}: ${formatAuditValue(value)}`
    })
    .join('; ')
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  return JSON.stringify(normalizeAuditValue(a)) === JSON.stringify(normalizeAuditValue(b))
}

function normalizeAuditValue(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value
}

function formatAuditValue(value: unknown): string {
  if (value == null || value === '') return 'empty'
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(formatAuditValue).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function isDiffEntry(value: unknown): value is AuditDiffEntry {
  if (!isPlainRecord(value)) return false
  const keys = Object.keys(value)
  return keys.length > 0 && keys.every((key) => key === 'from' || key === 'to')
}

// Legacy compatibility helper. New audit writes should use buildAuditDiff().
export function buildAuditDetail<A extends LegacyAuditAction>(
  action: A,
  data: ActionDetailMap[A],
): ActionDetailMap[A]

export function buildAuditDetail(
  action: string,
  data: Record<string, unknown>,
): Record<string, unknown>

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
