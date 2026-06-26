import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.fn()
const findFirst = vi.fn()
const transaction = vi.fn()
const logAudit = vi.fn()
const logError = vi.fn()
const redirect = vi.fn((url: string) => {
  throw Object.assign(new Error('NEXT_REDIRECT'), { url })
})
const revalidatePath = vi.fn()

vi.mock('@/lib/auth', () => ({ auth: () => auth() }))
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      users: {
        findFirst: (...args: unknown[]) => findFirst(...args),
      },
    },
    transaction: (...args: unknown[]) => transaction(...args),
  },
}))
vi.mock('@/lib/audit-db', () => ({
  logAudit: (...args: unknown[]) => logAudit(...args),
}))
vi.mock('@/lib/logger', () => ({
  logError: (...args: unknown[]) => logError(...args),
}))
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidatePath(path) }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }))

import { saveTrackingSettings } from '../admin-settings-actions'

function formData() {
  const data = new FormData()
  data.set('track.ip', 'on')
  data.set('track.geo', 'on')
  data.set('viewer.print', 'on')
  data.set('notifications.enabled', 'on')
  data.set('notifications.to', 'support@royalglass.co.nz')
  data.set('expiry.default', '7d')
  return data
}

function txMock() {
  return {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(),
      })),
    })),
  }
}

describe('saveTrackingSettings', () => {
  beforeEach(() => {
    auth.mockReset()
    findFirst.mockReset()
    transaction.mockReset()
    logAudit.mockReset()
    logError.mockReset()
    redirect.mockClear()
    revalidatePath.mockReset()

    auth.mockResolvedValue({ user: { id: 'actor-id', role: 'admin' } })
    findFirst.mockResolvedValue({ id: 'actor-id', role: 'admin' })
    transaction.mockImplementation(async (callback) => callback(txMock()))
    logError.mockResolvedValue('error-1')
  })

  it('redirects stale sessions to login before writing settings', async () => {
    findFirst.mockResolvedValue(null)

    await expect(saveTrackingSettings(formData())).rejects.toMatchObject({ url: '/login?expired=1' })

    expect(transaction).not.toHaveBeenCalled()
    expect(logAudit).not.toHaveBeenCalled()
  })

  it('logs unexpected save failures and redirects back with a reference', async () => {
    transaction.mockRejectedValue(new Error('insert failed'))

    await expect(saveTrackingSettings(formData())).rejects.toMatchObject({ url: '/admin/tracking?error=error-1' })

    expect(logError).toHaveBeenCalledWith(
      'quote-tracker.saveTrackingSettings',
      expect.any(Error),
      expect.objectContaining({ userId: 'actor-id' }),
    )
  })

  it('saves settings, writes audit, revalidates, and redirects with a success flag', async () => {
    await expect(saveTrackingSettings(formData())).rejects.toMatchObject({ url: '/admin/tracking?saved=1' })

    expect(transaction).toHaveBeenCalledOnce()
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-id',
        action: 'quote.settings_updated',
      }),
      expect.any(Object),
    )
    expect(revalidatePath).toHaveBeenCalledWith('/admin/tracking')
  })
})
