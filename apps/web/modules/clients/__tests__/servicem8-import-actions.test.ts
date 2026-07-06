// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.fn()
const userCanAccessSlug = vi.fn()
const refreshServiceM8Clients = vi.fn()
const revalidatePath = vi.fn()

vi.mock('@/lib/auth', () => ({ auth: () => auth() }))
vi.mock('@/lib/access-db', () => ({
  userCanAccessSlug: (userId: string, slug: string) => userCanAccessSlug(userId, slug),
}))
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePath(path),
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

    auth.mockResolvedValue(adminSession)
    userCanAccessSlug.mockResolvedValue(true)
    refreshServiceM8Clients.mockResolvedValue({
      scanned: 2,
      created: 1,
      sourceUpdated: 1,
      needsReview: 2,
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
        scanned: 2,
        created: 1,
        sourceUpdated: 1,
        needsReview: 2,
        skipped: 0,
        errors: 0,
        errorMessages: [],
      },
    })
    expect(userCanAccessSlug).toHaveBeenCalledWith('admin-1', 'clients')
    expect(refreshServiceM8Clients).toHaveBeenCalledTimes(1)
    expect(revalidatePath).toHaveBeenCalledWith('/clients')
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
