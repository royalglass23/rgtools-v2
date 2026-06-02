/**
 * Tests for admin user-management server actions.
 * Written FIRST (TDD) — all tests should be red before implementation exists.
 *
 * Strategy:
 *  - Mock @/lib/db so no real DB is touched.
 *  - Mock @/lib/auth to control session state.
 *  - For each action: verify success path (mutation + audit) and guard-blocked
 *    path (no mutation, no audit).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks (must be defined before any import) ─────────────────────────

/**
 * Builds a fresh "Drizzle insert chain" mock each time it is called:
 *   db.insert(table).values(data)                 → awaitable (returns [])
 *   db.insert(table).values(data).returning()     → resolves to rowData
 *   db.insert(table).values(data).onConflictDoNothing() → resolves to []
 *
 * All three methods are tracked on the shared mock functions so callers can
 * assert which tables were touched.
 */
const mockReturning = vi.hoisted(() => vi.fn())
const mockOnConflict = vi.hoisted(() => vi.fn())
const mockInsertValues = vi.hoisted(() => vi.fn())
const mockInsert = vi.hoisted(() => vi.fn())

// update chain: update(table).set(data).where(...)
const mockUpdateWhere = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const mockUpdateSet = vi.hoisted(() => vi.fn(() => ({ where: mockUpdateWhere })))
const mockUpdate = vi.hoisted(() => vi.fn(() => ({ set: mockUpdateSet })))

// delete chain: delete(table).where(...)
const mockDeleteWhere = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const mockDelete = vi.hoisted(() => vi.fn(() => ({ where: mockDeleteWhere })))

// db.query.users.findFirst
const mockFindFirstUsers = vi.hoisted(() => vi.fn())

// db.query.modules.findFirst
const mockFindFirstModules = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  db: {
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    query: {
      users: { findFirst: mockFindFirstUsers },
      modules: { findFirst: mockFindFirstModules },
    },
  },
}))

// Mock bcryptjs so hashing is instantaneous in tests
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn().mockResolvedValue(true),
  },
}))

// ── Session mock ───────────────────────────────────────────────────────────────

const mockAuth = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth', () => ({ auth: mockAuth }))

// ── Import actions under test (after mocks are registered) ────────────────────

import { users, modules, userModuleAccess, auditLog } from '@/drizzle/schema'
import {
  createUser,
  updateUserRole,
  deleteUser,
  setModuleAccess,
} from '../../app/(dashboard)/admin/actions'

// ── Fixtures ───────────────────────────────────────────────────────────────────

const adminSession = { user: { id: 'actor-id', name: 'superadmin', role: 'admin' } }
const staffSession = { user: { id: 'staff-id', name: 'staffuser', role: 'staff' } }

const adminActor = { id: 'actor-id', username: 'superadmin', role: 'admin' as const, isProtected: false }
const protectedActor = { id: 'actor-id', username: 'superadmin', role: 'admin' as const, isProtected: true }

const staffTarget = {
  id: 'target-id', username: 'bobstaff', role: 'staff' as const, isProtected: false,
  passwordHash: 'hash', createdAt: new Date(), updatedAt: new Date(),
}
const adminTarget = {
  id: 'target-id', username: 'adminuser', role: 'admin' as const, isProtected: false,
  passwordHash: 'hash', createdAt: new Date(), updatedAt: new Date(),
}
const protectedTarget = {
  id: 'protected-id', username: 'superadmin', role: 'admin' as const, isProtected: true,
  passwordHash: 'hash', createdAt: new Date(), updatedAt: new Date(),
}

const normalModule = {
  id: 'module-id', slug: 'quotes', name: 'Quotes', adminOnly: false,
  isActive: true, description: null, sortOrder: 0, createdAt: new Date(), updatedAt: new Date(),
}
const adminOnlyModule = {
  id: 'mod-admin-id', slug: 'admin-panel', name: 'Admin Panel', adminOnly: true,
  isActive: true, description: null, sortOrder: 1, createdAt: new Date(), updatedAt: new Date(),
}

// ── Mock setup helper ─────────────────────────────────────────────────────────

/**
 * Build the insert chain for a given `newUserRow` (used by createUser).
 * The chain returned by `values()` is a thenable (for `await insert(...).values(...)`)
 * and also has `.returning()` and `.onConflictDoNothing()`.
 */
function buildInsertChain(newUserRow = [{ id: 'new-user-id', username: 'newuser', role: 'staff' }]) {
  mockReturning.mockResolvedValue(newUserRow)
  mockOnConflict.mockResolvedValue([])

  // values() returns a thenable that also has the chained methods
  mockInsertValues.mockImplementation(() => {
    const chain = {
      returning: mockReturning,
      onConflictDoNothing: mockOnConflict,
      // Make it thenable so `await db.insert(auditLog).values({...})` resolves
      then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
        Promise.resolve([]).then(resolve, reject),
    }
    return chain
  })

  mockInsert.mockImplementation(() => ({ values: mockInsertValues }))
}

// ── createUser ─────────────────────────────────────────────────────────────────

describe('createUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(adminSession)
    mockFindFirstUsers.mockResolvedValue(adminActor)
    buildInsertChain()
  })

  it('succeeds: inserts user AND writes audit row', async () => {
    const result = await createUser({ username: 'newuser', password: 'pass123', role: 'staff' })

    expect(result).toEqual({ success: true })

    // user insert was called
    expect(mockInsert).toHaveBeenCalledWith(users)

    // audit row was inserted
    const auditCall = mockInsert.mock.calls.find((call) => call[0] === auditLog)
    expect(auditCall).toBeDefined()
  })

  it('blocked when session role is not admin → no mutation, no audit', async () => {
    mockAuth.mockResolvedValue(staffSession)

    await expect(
      createUser({ username: 'newuser', password: 'pass123', role: 'staff' }),
    ).rejects.toThrow('Forbidden')

    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('blocked when session is null → no mutation, no audit', async () => {
    mockAuth.mockResolvedValue(null)

    await expect(
      createUser({ username: 'newuser', password: 'pass123', role: 'staff' }),
    ).rejects.toThrow('Forbidden')

    expect(mockInsert).not.toHaveBeenCalled()
  })
})

// ── updateUserRole ─────────────────────────────────────────────────────────────

describe('updateUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(adminSession)
    buildInsertChain()
    mockUpdate.mockReturnValue({ set: mockUpdateSet })
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere })
    mockUpdateWhere.mockResolvedValue([])
  })

  it('succeeds: updates role AND writes audit row', async () => {
    mockFindFirstUsers
      .mockResolvedValueOnce(adminActor)
      .mockResolvedValueOnce(staffTarget)

    const result = await updateUserRole('target-id', 'admin')

    expect(result).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledWith(users)
    const auditCall = mockInsert.mock.calls.find((call) => call[0] === auditLog)
    expect(auditCall).toBeDefined()
  })

  it('blocked when target is protected → no update, no audit', async () => {
    mockFindFirstUsers
      .mockResolvedValueOnce(adminActor)
      .mockResolvedValueOnce(protectedTarget)

    const result = await updateUserRole('protected-id', 'staff')

    expect(result).toEqual({ error: expect.stringContaining('protected') })
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalledWith(auditLog)
  })

  it('regular admin blocked from managing another admin → no update, no audit', async () => {
    mockFindFirstUsers
      .mockResolvedValueOnce(adminActor)
      .mockResolvedValueOnce(adminTarget)

    const result = await updateUserRole('target-id', 'staff')

    expect(result).toEqual({ error: expect.any(String) })
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalledWith(auditLog)
  })

  it('protected actor CAN manage another admin → succeeds', async () => {
    mockFindFirstUsers
      .mockResolvedValueOnce(protectedActor)
      .mockResolvedValueOnce(adminTarget)

    const result = await updateUserRole('target-id', 'staff')

    expect(result).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledWith(users)
    const auditCall = mockInsert.mock.calls.find((call) => call[0] === auditLog)
    expect(auditCall).toBeDefined()
  })

  it('blocked when session is not admin', async () => {
    mockAuth.mockResolvedValue(staffSession)

    await expect(updateUserRole('target-id', 'admin')).rejects.toThrow('Forbidden')

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

// ── deleteUser ─────────────────────────────────────────────────────────────────

describe('deleteUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(adminSession)
    buildInsertChain()
    mockDelete.mockReturnValue({ where: mockDeleteWhere })
    mockDeleteWhere.mockResolvedValue([])
  })

  it('succeeds: deletes user AND writes audit row with captured username', async () => {
    mockFindFirstUsers
      .mockResolvedValueOnce(adminActor)
      .mockResolvedValueOnce(staffTarget)

    const result = await deleteUser('target-id')

    expect(result).toEqual({ success: true })
    expect(mockDelete).toHaveBeenCalledWith(users)

    // audit was written
    const auditCallIndex = mockInsert.mock.calls.findIndex((call) => call[0] === auditLog)
    expect(auditCallIndex).toBeGreaterThanOrEqual(0)

    // audit detail captures username captured BEFORE deletion
    const auditValuesArg = mockInsertValues.mock.calls[auditCallIndex]?.[0]
    expect(auditValuesArg).toMatchObject({
      action: 'user.delete',
      detail: expect.objectContaining({ username: 'bobstaff' }),
    })
  })

  it('blocked when target is protected → no delete, no audit', async () => {
    mockFindFirstUsers
      .mockResolvedValueOnce(adminActor)
      .mockResolvedValueOnce(protectedTarget)

    const result = await deleteUser('protected-id')

    expect(result).toEqual({ error: expect.stringContaining('protected') })
    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalledWith(auditLog)
  })

  it('blocked when target not found → returns error', async () => {
    mockFindFirstUsers
      .mockResolvedValueOnce(adminActor)
      .mockResolvedValueOnce(undefined)

    const result = await deleteUser('unknown-id')

    expect(result).toEqual({ error: expect.any(String) })
    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('blocked when session is not admin', async () => {
    mockAuth.mockResolvedValue(staffSession)

    await expect(deleteUser('target-id')).rejects.toThrow('Forbidden')

    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

// ── setModuleAccess ────────────────────────────────────────────────────────────

describe('setModuleAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(adminSession)
    buildInsertChain()
    mockDelete.mockReturnValue({ where: mockDeleteWhere })
    mockDeleteWhere.mockResolvedValue([])
    mockFindFirstModules.mockResolvedValue(normalModule)
  })

  it('grants access: inserts grant row AND writes ACCESS_GRANT audit', async () => {
    mockFindFirstUsers
      .mockResolvedValueOnce(adminActor)
      .mockResolvedValueOnce(staffTarget)

    const result = await setModuleAccess('target-id', 'module-id', true)

    expect(result).toEqual({ success: true })

    // grant insert happened
    const grantCall = mockInsert.mock.calls.find((call) => call[0] === userModuleAccess)
    expect(grantCall).toBeDefined()

    // audit happened with access.grant
    const auditCallIndex = mockInsert.mock.calls.findIndex((call) => call[0] === auditLog)
    expect(auditCallIndex).toBeGreaterThanOrEqual(0)
    const auditArg = mockInsertValues.mock.calls[auditCallIndex]?.[0]
    expect(auditArg).toMatchObject({ action: 'access.grant' })
  })

  it('revokes access: deletes grant row AND writes ACCESS_REVOKE audit', async () => {
    mockFindFirstUsers
      .mockResolvedValueOnce(adminActor)
      .mockResolvedValueOnce(staffTarget)

    const result = await setModuleAccess('target-id', 'module-id', false)

    expect(result).toEqual({ success: true })
    expect(mockDelete).toHaveBeenCalledWith(userModuleAccess)

    const auditCallIndex = mockInsert.mock.calls.findIndex((call) => call[0] === auditLog)
    expect(auditCallIndex).toBeGreaterThanOrEqual(0)
    const auditArg = mockInsertValues.mock.calls[auditCallIndex]?.[0]
    expect(auditArg).toMatchObject({ action: 'access.revoke' })
  })

  it('blocked on adminOnly module → no mutation, no audit', async () => {
    mockFindFirstUsers
      .mockResolvedValueOnce(adminActor)
      .mockResolvedValueOnce(staffTarget)
    mockFindFirstModules.mockResolvedValue(adminOnlyModule)

    const result = await setModuleAccess('target-id', 'mod-admin-id', true)

    expect(result).toEqual({ error: expect.stringContaining('admin') })
    expect(mockInsert).not.toHaveBeenCalledWith(userModuleAccess)
    expect(mockInsert).not.toHaveBeenCalledWith(auditLog)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('blocked when module not found → returns error', async () => {
    mockFindFirstUsers
      .mockResolvedValueOnce(adminActor)
      .mockResolvedValueOnce(staffTarget)
    mockFindFirstModules.mockResolvedValue(undefined)

    const result = await setModuleAccess('target-id', 'bad-module-id', true)

    expect(result).toEqual({ error: expect.any(String) })
    expect(mockInsert).not.toHaveBeenCalledWith(userModuleAccess)
    expect(mockInsert).not.toHaveBeenCalledWith(auditLog)
  })

  it('blocked when target user not found → returns error', async () => {
    mockFindFirstUsers
      .mockResolvedValueOnce(adminActor)
      .mockResolvedValueOnce(undefined)

    const result = await setModuleAccess('unknown-id', 'module-id', true)

    expect(result).toEqual({ error: expect.any(String) })
    expect(mockInsert).not.toHaveBeenCalledWith(userModuleAccess)
    expect(mockInsert).not.toHaveBeenCalledWith(auditLog)
  })

  it('blocked when session is not admin', async () => {
    mockAuth.mockResolvedValue(staffSession)

    await expect(setModuleAccess('target-id', 'module-id', true)).rejects.toThrow('Forbidden')

    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
