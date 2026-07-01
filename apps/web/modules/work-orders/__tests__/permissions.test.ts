import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuth = vi.hoisted(() => vi.fn())
const mockUserCanAccessSlug = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/access-db', () => ({ userCanAccessSlug: mockUserCanAccessSlug }))

import {
  assertCurrentUserCanConfigureWorkOrders,
  assertCurrentUserCanManageWorkOrders,
  getCurrentWorkOrderPermissions,
} from '../permissions'

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'user-1', role: 'staff' } })
  mockUserCanAccessSlug.mockResolvedValue(false)
})

describe('Work Order permissions', () => {
  it('allows users with Work Orders view access to read but not manage or configure by default', async () => {
    mockUserCanAccessSlug.mockImplementation(async (_userId: string, slug: string) => slug === 'work-orders')

    await expect(getCurrentWorkOrderPermissions()).resolves.toEqual({
      canView: true,
      canManage: false,
      canConfigure: false,
    })
  })

  it('reports no access for users without Work Orders view access', async () => {
    await expect(getCurrentWorkOrderPermissions()).resolves.toEqual({
      canView: false,
      canManage: false,
      canConfigure: false,
    })
  })

  it('allows operational changes only with manage access', async () => {
    mockUserCanAccessSlug.mockImplementation(async (_userId: string, slug: string) => (
      slug === 'work-orders' || slug === 'work-orders/manage'
    ))

    await expect(assertCurrentUserCanManageWorkOrders()).resolves.toBeUndefined()
    await expect(getCurrentWorkOrderPermissions()).resolves.toMatchObject({
      canView: true,
      canManage: true,
      canConfigure: false,
    })
  })

  it('blocks operational changes with a clear action-level error for view-only users', async () => {
    mockUserCanAccessSlug.mockImplementation(async (_userId: string, slug: string) => slug === 'work-orders')

    await expect(assertCurrentUserCanManageWorkOrders()).rejects.toThrow(
      'Forbidden: Work Orders manage access is required.',
    )
  })

  it('allows configuration changes only with config access', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    mockUserCanAccessSlug.mockResolvedValue(true)

    await expect(assertCurrentUserCanConfigureWorkOrders()).resolves.toBeUndefined()
    await expect(getCurrentWorkOrderPermissions()).resolves.toMatchObject({
      canView: true,
      canManage: true,
      canConfigure: true,
    })
  })

  it('blocks manage users from configuration changes when they are not admins', async () => {
    mockUserCanAccessSlug.mockImplementation(async (_userId: string, slug: string) => (
      slug === 'work-orders' || slug === 'work-orders/manage'
    ))

    await expect(assertCurrentUserCanConfigureWorkOrders()).rejects.toThrow(
      'Forbidden: Work Orders configuration access is required.',
    )
  })
})
