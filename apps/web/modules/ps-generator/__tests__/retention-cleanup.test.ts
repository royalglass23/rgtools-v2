import { describe, expect, it, vi } from 'vitest'

import { cleanupGeneratedPdfRetention } from '../retention-cleanup'
import type { QuoteStorage } from '@/lib/storage/types'

describe('PS generated PDF retention cleanup', () => {
  it('deletes only expired generated PDF objects and marks their rows expired', async () => {
    const deletedKeys: string[] = []
    const storage: QuoteStorage = {
      put: vi.fn(),
      head: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(async (key: string) => {
        deletedKeys.push(key)
      }),
    }
    const updatedRows: unknown[] = []
    const database = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => [
            {
              id: 'generated-1',
              r2ObjectKey: 'ps-generator/generated/operation-1/PS1-Jane.pdf',
              retainedUntil: new Date('2026-06-01T00:00:00.000Z'),
              deletedAt: null,
            },
          ]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((values) => {
          updatedRows.push(values)
          return { where: vi.fn(async () => undefined) }
        }),
      })),
    }

    const result = await cleanupGeneratedPdfRetention({
      database,
      storage,
      now: new Date('2026-07-01T00:00:00.000Z'),
    })

    expect(result).toEqual({
      scanned: 1,
      deleted: [{
        id: 'generated-1',
        r2ObjectKey: 'ps-generator/generated/operation-1/PS1-Jane.pdf',
      }],
      failed: [],
    })
    expect(deletedKeys).toEqual(['ps-generator/generated/operation-1/PS1-Jane.pdf'])
    expect(updatedRows).toEqual([{ deletedAt: new Date('2026-07-01T00:00:00.000Z') }])
  })
})
