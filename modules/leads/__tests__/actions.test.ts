// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuth = vi.hoisted(() => vi.fn())
const mockUpdateWhere = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const mockUpdateSet = vi.hoisted(() => vi.fn(() => ({ where: mockUpdateWhere })))
const mockUpdate = vi.hoisted(() => vi.fn(() => ({ set: mockUpdateSet })))
const mockInsertValues = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const mockInsert = vi.hoisted(() => vi.fn(() => ({ values: mockInsertValues })))
const mockTransaction = vi.hoisted(() =>
  vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
    update: mockUpdate,
    insert: mockInsert,
  })),
)
const mockRevalidatePath = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/db', () => ({
  db: {
    transaction: mockTransaction,
  },
}))
vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

import { batchDeleteLeadsAction } from '../actions'

function formData(ids: string[]) {
  const data = new FormData()
  for (const id of ids) data.append('leadId', id)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'admin-id', role: 'admin' } })
})

describe('batchDeleteLeadsAction', () => {
  it('soft-deletes selected leads and writes one audit row per lead for admins', async () => {
    const result = await batchDeleteLeadsAction(formData(['lead-1', 'lead-2']))

    expect(result).toEqual({ success: true, count: 2 })
    expect(mockUpdate).toHaveBeenCalled()
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
      archivedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    }))
    expect(mockInsertValues).toHaveBeenCalledWith([
      {
        actorId: 'admin-id',
        action: 'lead.deleted',
        targetId: 'lead-1',
        detail: { softDelete: true, batch: true },
      },
      {
        actorId: 'admin-id',
        action: 'lead.deleted',
        targetId: 'lead-2',
        detail: { softDelete: true, batch: true },
      },
    ])
    expect(mockRevalidatePath).toHaveBeenCalledWith('/leads')
  })

  it('blocks staff users without mutating leads', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'staff-id', role: 'staff' } })

    const result = await batchDeleteLeadsAction(formData(['lead-1']))

    expect(result).toEqual({ error: 'Forbidden' })
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})
