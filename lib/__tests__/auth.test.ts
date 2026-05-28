import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'

// vi.hoisted ensures mockWhere is available inside vi.mock's factory (which is hoisted before imports)
const mockWhere = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: mockWhere })),
    })),
  },
}))

import { authorizeUser } from '../auth-helpers'

describe('authorizeUser', () => {
  const hash = bcrypt.hashSync('*royalglass23', 10)
  const mockUser = {
    id: 'test-uuid',
    username: 'rgadmin',
    passwordHash: hash,
    role: 'admin' as const,
  }

  beforeEach(() => {
    mockWhere.mockResolvedValue([mockUser])
  })

  it('returns null when username is empty', async () => {
    expect(await authorizeUser({ username: '', password: '*royalglass23' })).toBeNull()
  })

  it('returns null when user is not found', async () => {
    mockWhere.mockResolvedValue([])
    expect(await authorizeUser({ username: 'nobody', password: 'x' })).toBeNull()
  })

  it('returns null when password is wrong', async () => {
    expect(await authorizeUser({ username: 'rgadmin', password: 'wrong' })).toBeNull()
  })

  it('returns user object when credentials are correct', async () => {
    const result = await authorizeUser({ username: 'rgadmin', password: '*royalglass23' })
    expect(result).toMatchObject({ id: 'test-uuid', name: 'rgadmin', role: 'admin' })
  })
})
