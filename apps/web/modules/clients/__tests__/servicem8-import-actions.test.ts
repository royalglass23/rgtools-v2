// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.fn()
const userCanAccessSlug = vi.fn()
const refreshServiceM8Clients = vi.fn()
const revalidatePath = vi.fn()
const logAudit = vi.fn()
const logError = vi.fn()

vi.mock('@/lib/auth', () => ({ auth: () => auth() }))
vi.mock('@/lib/access-db', () => ({
  userCanAccessSlug: (userId: string, slug: string) => userCanAccessSlug(userId, slug),
}))
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}))
vi.mock('@/lib/audit-db', () => ({
  logAudit: (...args: unknown[]) => logAudit(...args),
}))
vi.mock('@/lib/logger', () => ({
  logError: (...args: unknown[]) => logError(...args),
}))
vi.mock('../servicem8-import', () => ({
  refreshServiceM8Clients: () => refreshServiceM8Clients(),
}))

import { refreshServiceM8ClientsAction } from '../servicem8-import-actions'

const adminSession = { user: { id: 'admin-1', role: 'admin' } }

describe('refreshServiceM8ClientsAction', () => {
  beforeEach(() => {
    auth.mockReset()
    userCanAccessSlug.mockReset()
    refreshServiceM8Clients.mockReset()
    revalidatePath.mockReset()
    logAudit.mockReset()
    logError.mockReset()

    auth.mockResolvedValue(adminSession)
    userCanAccessSlug.mockResolvedValue(true)
    logError.mockResolvedValue('error-1')
    refreshServiceM8Clients.mockResolvedValue({
      batchLimit: 20,
      scanned: 2,
      created: 1,
      sourceUpdated: 1,
      needsReview: 2,
      contactsFound: 2,
      contactsMissing: 0,
      skipped: 0,
      errors: 0,
      errorMessages: [],
    })
  })

  it('lets an admin refresh ServiceM8 Clients and revalidates the Clients page', async () => {
    const result = await refreshServiceM8ClientsAction(null, new FormData())

    expect(result).toEqual({
      success: true,
      summary: {
        batchLimit: 20,
        scanned: 2,
        created: 1,
        sourceUpdated: 1,
        needsReview: 2,
        contactsFound: 2,
        contactsMissing: 0,
        skipped: 0,
        errors: 0,
        errorMessages: [],
      },
    })
    expect(userCanAccessSlug).toHaveBeenCalledWith('admin-1', 'clients')
    expect(refreshServiceM8Clients).toHaveBeenCalledTimes(1)
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'admin-1',
      action: 'client.servicem8_import.completed',
    }))
    expect(logError).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/clients')
  })

  it('logs row-level import errors as warnings while returning the summary', async () => {
    refreshServiceM8Clients.mockResolvedValue({
      batchLimit: 20,
      scanned: 2,
      created: 1,
      sourceUpdated: 0,
      needsReview: 1,
      contactsFound: 1,
      contactsMissing: 1,
      skipped: 0,
      errors: 1,
      errorMessages: ['company-1: duplicate key'],
    })

    const result = await refreshServiceM8ClientsAction(null, new FormData())

    expect(result).toMatchObject({ success: true })
    expect(logError).toHaveBeenCalledWith(
      'clients.servicem8Import.rowErrors',
      expect.any(Error),
      expect.objectContaining({
        level: 'warn',
        userId: 'admin-1',
      }),
    )
  })

  it('logs failed imports and returns the error reference', async () => {
    refreshServiceM8Clients.mockRejectedValue(new Error('ServiceM8 unavailable'))

    const result = await refreshServiceM8ClientsAction(null, new FormData())

    expect(result).toEqual({ error: 'ServiceM8 unavailable Ref: error-1' })
    expect(logError).toHaveBeenCalledWith(
      'clients.servicem8Import.failed',
      expect.any(Error),
      expect.objectContaining({ userId: 'admin-1' }),
    )
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('denies staff before calling ServiceM8', async () => {
    auth.mockResolvedValue({ user: { id: 'staff-1', role: 'staff' } })

    const result = await refreshServiceM8ClientsAction(null, new FormData())

    expect(result).toEqual({ error: 'Forbidden' })
    expect(refreshServiceM8Clients).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('denies admins when Clients availability is off', async () => {
    userCanAccessSlug.mockResolvedValue(false)

    const result = await refreshServiceM8ClientsAction(null, new FormData())

    expect(result).toEqual({ error: 'Forbidden' })
    expect(refreshServiceM8Clients).not.toHaveBeenCalled()
  })
})
