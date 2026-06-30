import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAssertCanManage = vi.hoisted(() => vi.fn())
const mockAssertCanConfigure = vi.hoisted(() => vi.fn())
const mockRevalidatePath = vi.hoisted(() => vi.fn())
const mockRedirect = vi.hoisted(() => vi.fn())
const mockInsert = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())

vi.mock('../permissions', () => ({
  assertCurrentUserCanConfigureWorkOrders: mockAssertCanConfigure,
  assertCurrentUserCanManageWorkOrders: mockAssertCanManage,
}))

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    insert: mockInsert,
    update: mockUpdate,
  },
}))
vi.mock('@/lib/servicem8/client', () => ({
  createServiceM8RequestFromEnv: vi.fn(),
}))

import {
  createWorkOrderInstallerAction,
  refreshWorkOrdersAction,
  updateWorkOrderOperationalFieldsAction,
} from '../actions'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('work order action permissions', () => {
  it('requires manage access before refreshing Work Orders from ServiceM8', async () => {
    mockAssertCanManage.mockRejectedValue(new Error('Forbidden: Work Orders manage access is required.'))

    await expect(refreshWorkOrdersAction()).rejects.toThrow('Forbidden: Work Orders manage access is required.')
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('requires manage access before updating operational Work Order fields', async () => {
    mockAssertCanManage.mockRejectedValue(new Error('Forbidden: Work Orders manage access is required.'))

    await expect(updateWorkOrderOperationalFieldsAction('work-order-1', new FormData())).rejects.toThrow(
      'Forbidden: Work Orders manage access is required.',
    )
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('requires configuration access before changing Work Order option lists', async () => {
    mockAssertCanConfigure.mockRejectedValue(new Error('Forbidden: Work Orders configuration access is required.'))
    const formData = new FormData()
    formData.set('displayName', 'Install team')

    await expect(createWorkOrderInstallerAction(formData)).rejects.toThrow(
      'Forbidden: Work Orders configuration access is required.',
    )
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})
