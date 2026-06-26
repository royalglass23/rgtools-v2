import { beforeEach, describe, expect, it, vi } from 'vitest'

// Build a mock db whose chainable methods are individually capturable.
// Drizzle ORM chains: .update(table).set({}).where(cond)
//                     .delete(table).where(cond)
// We need to inspect what was passed to .set() and that .where() was called.

const mocks = vi.hoisted(() => {
  const updateSet = vi.fn()
  const updateWhere = vi.fn(() => Promise.resolve())
  const deleteWhere = vi.fn(() => Promise.resolve())

  const db = {
    update: vi.fn(() => ({
      set: updateSet.mockImplementation(() => ({
        where: updateWhere,
      })),
    })),
    delete: vi.fn(() => ({
      where: deleteWhere,
    })),
  }

  return { db, updateSet, updateWhere, deleteWhere }
})

vi.mock('@/lib/db', () => ({ db: mocks.db }))

import { resetNotificationState } from '../reset-notification-state'

describe('resetNotificationState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateWhere.mockResolvedValue(undefined)
    mocks.deleteWhere.mockResolvedValue(undefined)
  })

  it('sets openedNotifiedAt to null on the quote row', async () => {
    await resetNotificationState('quote-1')

    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ openedNotifiedAt: null }),
    )
  })

  it('sets highIntentNotifiedAt to null on the quote row', async () => {
    await resetNotificationState('quote-1')

    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ highIntentNotifiedAt: null }),
    )
  })

  it('sets archivedAt to null on the quote row (re-activates an archived quote)', async () => {
    await resetNotificationState('quote-1')

    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ archivedAt: null }),
    )
  })

  it('hard-deletes all quote_notified_viewers rows for the given quote ID', async () => {
    await resetNotificationState('quote-2')

    expect(mocks.db.delete).toHaveBeenCalledTimes(1)
    expect(mocks.deleteWhere).toHaveBeenCalledTimes(1)
  })

  it('runs the update before the delete', async () => {
    const callOrder: string[] = []
    mocks.updateWhere.mockImplementation(() => {
      callOrder.push('update')
      return Promise.resolve()
    })
    mocks.deleteWhere.mockImplementation(() => {
      callOrder.push('delete')
      return Promise.resolve()
    })

    await resetNotificationState('quote-1')

    expect(callOrder).toEqual(['update', 'delete'])
  })
})
