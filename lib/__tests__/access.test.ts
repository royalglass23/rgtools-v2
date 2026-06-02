import { describe, it, expect } from 'vitest'
import { canAccessModule, assertCanManageUser } from '../access'
import { buildAuditDetail, AUDIT_ACTIONS } from '../audit'

// ── Shared fixtures ────────────────────────────────────────────────────────────

const admin = { id: 'u1', username: 'alice', role: 'admin' as const, isProtected: false }
const staff = { id: 'u2', username: 'bob',   role: 'staff' as const, isProtected: false }
const superAdmin = { id: 'u0', username: 'super', role: 'admin' as const, isProtected: true }
const protectedStaff = { id: 'u3', username: 'pstaff', role: 'staff' as const, isProtected: true }

const adminOnlyModule = { id: 'm1', slug: 'admin-panel', adminOnly: true,  isActive: true }
const normalModule    = { id: 'm2', slug: 'quotes',      adminOnly: false, isActive: true }

// ── canAccessModule ────────────────────────────────────────────────────────────

describe('canAccessModule', () => {
  it('admin + adminOnly module → true', () => {
    expect(canAccessModule(admin, adminOnlyModule, new Set())).toBe(true)
  })

  it('staff + adminOnly module → false', () => {
    expect(canAccessModule(staff, adminOnlyModule, new Set())).toBe(false)
  })

  it('admin + normal module → true (no grant needed)', () => {
    expect(canAccessModule(admin, normalModule, new Set())).toBe(true)
  })

  it('staff + normal module WITH grant → true', () => {
    const grantSet = new Set([normalModule.id])
    expect(canAccessModule(staff, normalModule, grantSet)).toBe(true)
  })

  it('staff + normal module WITHOUT grant → false', () => {
    expect(canAccessModule(staff, normalModule, new Set())).toBe(false)
  })
})

// ── assertCanManageUser ────────────────────────────────────────────────────────

describe('assertCanManageUser', () => {
  it('admin managing staff → ok (no throw)', () => {
    expect(() => assertCanManageUser(admin, staff)).not.toThrow()
  })

  it('admin managing another admin → throws', () => {
    const otherAdmin = { id: 'u9', username: 'carol', role: 'admin' as const, isProtected: false }
    expect(() => assertCanManageUser(admin, otherAdmin)).toThrow()
  })

  it('protected super-user managing an admin → ok', () => {
    expect(() => assertCanManageUser(superAdmin, admin)).not.toThrow()
  })

  it('anyone demoting/deleting a protected user → throws', () => {
    expect(() => assertCanManageUser(admin, superAdmin)).toThrow()
    expect(() => assertCanManageUser(superAdmin, protectedStaff)).toThrow()
  })
})

// ── buildAuditDetail ───────────────────────────────────────────────────────────

describe('buildAuditDetail', () => {
  it('USER_CREATE shape', () => {
    const detail = buildAuditDetail(AUDIT_ACTIONS.USER_CREATE, { username: 'bob', role: 'staff' })
    expect(detail).toEqual({ username: 'bob', role: 'staff' })
  })

  it('USER_ROLE_CHANGE shape', () => {
    const detail = buildAuditDetail(AUDIT_ACTIONS.USER_ROLE_CHANGE, {
      username: 'bob', fromRole: 'staff', toRole: 'admin',
    })
    expect(detail).toEqual({ username: 'bob', fromRole: 'staff', toRole: 'admin' })
  })

  it('USER_DELETE shape', () => {
    const detail = buildAuditDetail(AUDIT_ACTIONS.USER_DELETE, { username: 'bob', role: 'staff' })
    expect(detail).toEqual({ username: 'bob', role: 'staff' })
  })

  it('ACCESS_GRANT shape', () => {
    const detail = buildAuditDetail(AUDIT_ACTIONS.ACCESS_GRANT, { username: 'bob', moduleSlug: 'quotes' })
    expect(detail).toEqual({ username: 'bob', moduleSlug: 'quotes' })
  })

  it('ACCESS_REVOKE shape', () => {
    const detail = buildAuditDetail(AUDIT_ACTIONS.ACCESS_REVOKE, { username: 'bob', moduleSlug: 'quotes' })
    expect(detail).toEqual({ username: 'bob', moduleSlug: 'quotes' })
  })

  it('unknown action → returns data as-is', () => {
    const detail = buildAuditDetail('some.unknown.action', { foo: 'bar' })
    expect(detail).toEqual({ foo: 'bar' })
  })
})
