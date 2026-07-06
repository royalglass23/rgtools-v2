// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.fn()
const userCanAccessSlug = vi.fn()
const transaction = vi.fn()
const revalidatePath = vi.fn()
const logAudit = vi.fn()
const mergeClients = vi.fn()

vi.mock('@/lib/auth', () => ({ auth: () => auth() }))
vi.mock('@/lib/access-db', () => ({
  userCanAccessSlug: (userId: string, slug: string) => userCanAccessSlug(userId, slug),
}))
vi.mock('@/lib/db', () => ({
  db: {
    transaction: (...args: unknown[]) => transaction(...args),
  },
}))
vi.mock('@/lib/audit-db', () => ({
  logAudit: (...args: unknown[]) => logAudit(...args),
}))
vi.mock('../client-resolver', () => ({
  mergeClients: (...args: unknown[]) => mergeClients(...args),
}))
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}))

import { confirmClientMergeReviewGroup } from '../review-actions'

const adminId = '11111111-1111-4111-8111-111111111111'

function mergeFormData() {
  const data = new FormData()
  data.set('survivorId', '22222222-2222-4222-8222-222222222222')
  data.append('loserIds', '33333333-3333-4333-8333-333333333333')
  return data
}

describe('confirmClientMergeReviewGroup', () => {
  beforeEach(() => {
    auth.mockReset()
    userCanAccessSlug.mockReset()
    transaction.mockReset()
    revalidatePath.mockReset()
    logAudit.mockReset()
    mergeClients.mockReset()

    auth.mockResolvedValue({ user: { id: adminId, role: 'admin' } })
    userCanAccessSlug.mockResolvedValue(true)
  })

  it('denies the merge action when the Clients module is unavailable to the admin', async () => {
    userCanAccessSlug.mockResolvedValue(false)

    await expect(confirmClientMergeReviewGroup(mergeFormData())).rejects.toThrow('Forbidden')

    expect(userCanAccessSlug).toHaveBeenCalledWith(adminId, 'clients')
    expect(transaction).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('allows an admin with Clients availability to confirm a review merge', async () => {
    const survivorId = '22222222-2222-4222-8222-222222222222'
    const loserId = '33333333-3333-4333-8333-333333333333'
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ id: survivorId }]),
          })),
        })),
      })),
    }
    transaction.mockImplementation(async (callback) => callback(tx))

    await confirmClientMergeReviewGroup(mergeFormData())

    expect(userCanAccessSlug).toHaveBeenCalledWith(adminId, 'clients')
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(mergeClients).toHaveBeenCalledWith(tx, survivorId, [loserId])
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: adminId,
      action: 'client.review_merge.confirmed',
      targetId: survivorId,
    }), tx)
    expect(revalidatePath).toHaveBeenCalledWith('/admin/client-merge-review')
  })
})
