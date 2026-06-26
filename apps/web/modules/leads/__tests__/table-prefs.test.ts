// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TablePrefs } from '../table-prefs-shared'

const mockAuth = vi.hoisted(() => vi.fn())
const mockRevalidatePath = vi.hoisted(() => vi.fn())
const prefRows = vi.hoisted(() => new Map<string, unknown>())
const mockOnConflictDoUpdate = vi.hoisted(() => vi.fn(async () => []))
const mockInsertValues = vi.hoisted(() =>
  vi.fn((value: { userId: string; tableKey: string; prefs: unknown }) => {
    prefRows.set(`${value.userId}:${value.tableKey}`, value.prefs)
    return { onConflictDoUpdate: mockOnConflictDoUpdate }
  }),
)

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            const prefs = prefRows.get('user-1:leads')
            return prefs ? [{ prefs }] : []
          }),
        })),
      })),
    })),
    insert: vi.fn(() => ({ values: mockInsertValues })),
  },
}))

import { saveTablePrefs } from '../table-prefs-actions'
import { loadTablePrefs } from '../table-prefs'
import { DEFAULT_LEADS_PREFS } from '../table-prefs-shared'

beforeEach(() => {
  vi.clearAllMocks()
  prefRows.clear()
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
})

describe('table prefs', () => {
  it('returns default leads prefs when no saved row exists', async () => {
    await expect(loadTablePrefs('user-1', 'leads')).resolves.toEqual(DEFAULT_LEADS_PREFS)
  })

  it('returns sanitized saved prefs after saveTablePrefs persists them', async () => {
    const prefs: TablePrefs = {
      columns: [
        { key: 'client', visible: true },
        { key: 'date', visible: false },
        { key: 'not-real', visible: true },
      ],
      sortColumn: 'clientName',
      sortDir: 'asc',
    }

    await saveTablePrefs('leads', prefs)

    const saved = await loadTablePrefs('user-1', 'leads')
    expect(saved.columns.slice(0, 2)).toEqual([
      { key: 'client', visible: true },
      { key: 'date', visible: false },
    ])
    expect(saved.columns.some((column) => column.key === 'not-real')).toBe(false)
    expect(saved.sortColumn).toBe('clientName')
    expect(saved.sortDir).toBe('asc')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/leads')
  })
})
