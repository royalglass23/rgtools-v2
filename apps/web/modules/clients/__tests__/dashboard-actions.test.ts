// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.fn()
const userCanAccessSlug = vi.fn()
const transaction = vi.fn()
const revalidatePath = vi.fn()

vi.mock('@/lib/auth', () => ({ auth: () => auth() }))
vi.mock('@/lib/access-db', () => ({
  userCanAccessSlug: (userId: string, slug: string) => userCanAccessSlug(userId, slug),
}))
vi.mock('@/lib/db', () => ({
  db: {
    transaction: (...args: unknown[]) => transaction(...args),
  },
}))
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}))

import { updateClientDashboardAction } from '../dashboard-actions'

const adminId = '11111111-1111-4111-8111-111111111111'
const clientId = '22222222-2222-4222-8222-222222222222'

function editFormData(overrides: Record<string, string> = {}) {
  const data = new FormData()
  data.set('name', 'Top View RG')
  data.set('companyName', 'Top View RG Ltd')
  data.set('email', 'office@topview.test')
  data.set('phone', '09 111 1111')
  data.set('identityType', 'company')
  data.set('clientType', 'builder')
  data.set('notes', 'Prefers Friday installs.')
  data.set('reviewStatus', 'reviewed')
  data.set('reviewNote', 'Cleaned up after ServiceM8 import.')
  data.set('primaryContactName', 'Vivi Zhang')
  data.set('primaryContactEmail', 'vivi@topview.test')
  data.set('primaryContactPhone', '021 000 000')
  data.set('aliases', 'Topview Builders\nTV Construction')
  for (const [key, value] of Object.entries(overrides)) data.set(key, value)
  return data
}

describe('updateClientDashboardAction', () => {
  beforeEach(() => {
    auth.mockReset()
    userCanAccessSlug.mockReset()
    transaction.mockReset()
    revalidatePath.mockReset()

    auth.mockResolvedValue({ user: { id: adminId, role: 'admin' } })
    userCanAccessSlug.mockResolvedValue(true)
  })

  it('lets admins edit canonical client details, notes, review status, primary contact, and aliases without mutating ServiceM8 source fields', async () => {
    const clientSet = vi.fn(() => ({ where: vi.fn(async () => []) }))
    const contactSet = vi.fn(() => ({ where: vi.fn(async () => []) }))
    const aliasWhere = vi.fn(async () => [])
    const aliasValues = vi.fn(() => ({ onConflictDoNothing: vi.fn(async () => []) }))
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: 'contact-1' }]),
            })),
          })),
        })),
      })),
      update: vi.fn()
        .mockReturnValueOnce({ set: clientSet })
        .mockReturnValueOnce({ set: contactSet }),
      delete: vi.fn(() => ({ where: aliasWhere })),
      insert: vi.fn(() => ({ values: aliasValues })),
    }
    transaction.mockImplementation(async (callback) => callback(tx))

    await updateClientDashboardAction(clientId, editFormData())

    expect(userCanAccessSlug).toHaveBeenCalledWith(adminId, 'clients')
    expect(clientSet).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Top View RG',
      companyName: 'Top View RG Ltd',
      email: 'office@topview.test',
      phone: '09 111 1111',
      identityType: 'company',
      clientType: 'builder',
      notes: 'Prefers Friday installs.',
      reviewStatus: 'reviewed',
      reviewNote: 'Cleaned up after ServiceM8 import.',
      reviewedBy: adminId,
      canonicalSource: 'manual',
      canonicalUpdatedBy: adminId,
    }))
    expect(clientSet).not.toHaveBeenCalledWith(expect.objectContaining({
      servicem8SourceSnapshot: expect.anything(),
      servicem8Name: expect.anything(),
      servicem8CompanyName: expect.anything(),
    }))
    expect(contactSet).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Vivi Zhang',
      email: 'vivi@topview.test',
      phone: '021 000 000',
    }))
    expect(aliasWhere).toHaveBeenCalled()
    expect(aliasValues).toHaveBeenCalledWith([
      expect.objectContaining({ clientId, alias: 'Topview Builders', source: 'manual' }),
      expect.objectContaining({ clientId, alias: 'TV Construction', source: 'manual' }),
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/clients')
    expect(revalidatePath).toHaveBeenCalledWith(`/clients/${clientId}`)
  })

  it('denies non-admin users before mutating client data', async () => {
    auth.mockResolvedValue({ user: { id: 'staff-1', role: 'staff' } })

    await expect(updateClientDashboardAction(clientId, editFormData())).rejects.toThrow('Forbidden')

    expect(userCanAccessSlug).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('creates a primary contact when contact details are added to a client with no contacts', async () => {
    const clientSet = vi.fn(() => ({ where: vi.fn(async () => []) }))
    const aliasWhere = vi.fn(async () => [])
    const aliasValues = vi.fn(() => ({ onConflictDoNothing: vi.fn(async () => []) }))
    const contactValues = vi.fn(async () => [])
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        })),
      })),
      update: vi.fn().mockReturnValue({ set: clientSet }),
      delete: vi.fn(() => ({ where: aliasWhere })),
      insert: vi.fn()
        .mockReturnValueOnce({ values: contactValues })
        .mockReturnValueOnce({ values: aliasValues }),
    }
    transaction.mockImplementation(async (callback) => callback(tx))

    await updateClientDashboardAction(clientId, editFormData())

    expect(contactValues).toHaveBeenCalledWith(expect.objectContaining({
      clientId,
      name: 'Vivi Zhang',
      email: 'vivi@topview.test',
      phone: '021 000 000',
    }))
    expect(revalidatePath).toHaveBeenCalledWith(`/clients/${clientId}`)
  })
})
