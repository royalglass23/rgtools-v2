// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.fn()
const userCanAccessSlug = vi.fn()
const transaction = vi.fn()
const revalidatePath = vi.fn()
const logAudit = vi.fn()
const logError = vi.fn()
const mergeClients = vi.fn()
const insert = vi.fn()

vi.mock('@/lib/auth', () => ({ auth: () => auth() }))
vi.mock('@/lib/access-db', () => ({
  userCanAccessSlug: (userId: string, slug: string) => userCanAccessSlug(userId, slug),
}))
vi.mock('@/lib/db', () => ({
  db: {
    transaction: (...args: unknown[]) => transaction(...args),
    insert: (...args: unknown[]) => insert(...args),
  },
}))
vi.mock('@/lib/audit-db', () => ({
  logAudit: (...args: unknown[]) => logAudit(...args),
}))
vi.mock('@/lib/logger', () => ({
  logError: (...args: unknown[]) => logError(...args),
}))
vi.mock('../client-resolver', () => ({
  mergeClients: (...args: unknown[]) => mergeClients(...args),
}))
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}))

import { confirmClientMergeReviewGroup, dismissClientDuplicateSuggestion } from '../review-actions'

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
    logError.mockReset()
    mergeClients.mockReset()
    insert.mockReset()

    auth.mockResolvedValue({ user: { id: adminId, role: 'admin' } })
    userCanAccessSlug.mockResolvedValue(true)
    logError.mockResolvedValue('error-1')
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

  it('records duplicate dismissal metadata for admins and revalidates merge review', async () => {
    const onConflictDoNothing = vi.fn(async () => [])
    const values = vi.fn(() => ({ onConflictDoNothing }))
    insert.mockReturnValue({ values })
    const data = new FormData()
    data.set('suggestionKey', 'contact:+64210000001')
    data.set('reason', 'same_contact')

    await dismissClientDuplicateSuggestion(data)

    expect(userCanAccessSlug).toHaveBeenCalledWith(adminId, 'clients')
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      suggestionKey: 'contact:+64210000001',
      reason: 'same_contact',
      dismissedBy: adminId,
      dismissedAt: expect.any(Date),
    }))
    expect(onConflictDoNothing).toHaveBeenCalled()
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: adminId,
      action: 'client.duplicate.dismissed',
      targetId: null,
    }))
    expect(revalidatePath).toHaveBeenCalledWith('/admin/client-merge-review')
  })

  it('logs merge failures and returns a safe error reference', async () => {
    transaction.mockRejectedValue(new Error('merge failed'))

    await expect(confirmClientMergeReviewGroup(mergeFormData())).rejects.toThrow('Failed to merge clients. Ref: error-1')

    expect(logError).toHaveBeenCalledWith(
      'clients.mergeReview.failed',
      expect.any(Error),
      expect.objectContaining({
        userId: adminId,
        metadata: expect.objectContaining({ loserCount: 1 }),
      }),
    )
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('denies duplicate dismissal for non-admin users', async () => {
    auth.mockResolvedValue({ user: { id: 'staff-1', role: 'staff' } })
    const data = new FormData()
    data.set('suggestionKey', 'contact:+64210000001')

    await expect(dismissClientDuplicateSuggestion(data)).rejects.toThrow('Forbidden')

    expect(insert).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
