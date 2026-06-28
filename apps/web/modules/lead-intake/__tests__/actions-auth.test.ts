// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuth = vi.hoisted(() => vi.fn())
const mockUserCanAccessSlug = vi.hoisted(() => vi.fn())
const mockSelect = vi.hoisted(() => vi.fn())
const mockComputeDistanceBand = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/access-db', () => ({ userCanAccessSlug: mockUserCanAccessSlug }))
vi.mock('@/lib/db', () => ({ db: { select: mockSelect } }))
vi.mock('@/modules/lead-intake/distance', () => ({ computeDistanceBand: mockComputeDistanceBand }))

import { getLeadIntakeForEdit, computeLeadDistance } from '../actions'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MT-68: getLeadIntakeForEdit authorization', () => {
  it('returns null for unauthenticated callers', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await getLeadIntakeForEdit('lead-id')
    expect(result).toBeNull()
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('returns null for authenticated users without lead-intake access', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockUserCanAccessSlug.mockResolvedValue(false)
    const result = await getLeadIntakeForEdit('lead-id')
    expect(result).toBeNull()
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('proceeds to DB for authorized users', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockUserCanAccessSlug.mockResolvedValue(true)
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    })
    const result = await getLeadIntakeForEdit('lead-id')
    expect(mockUserCanAccessSlug).toHaveBeenCalledWith('user-1', 'lead-intake')
    expect(mockSelect).toHaveBeenCalled()
    expect(result).toBeNull()
  })
})

describe('MT-69: computeLeadDistance authorization', () => {
  it('returns null for unauthenticated callers', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await computeLeadDistance('Albany, Auckland')
    expect(result).toBeNull()
    expect(mockComputeDistanceBand).not.toHaveBeenCalled()
  })

  it('invokes distance lookup for authenticated callers', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockComputeDistanceBand.mockResolvedValue('near')
    const result = await computeLeadDistance('Albany, Auckland')
    expect(result).toBe('near')
    expect(mockComputeDistanceBand).toHaveBeenCalledWith('Albany, Auckland')
  })
})
