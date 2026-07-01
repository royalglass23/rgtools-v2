import { and, eq, isNull, lte } from 'drizzle-orm'

import type { QuoteStorage } from '@/lib/storage/types'
import { getStorage } from '@/lib/storage'
import { psGeneratedPdfObjects } from '@rgtools/db/schema-ps-generator'

export interface PsGeneratedPdfObjectForCleanup {
  id: string
  r2ObjectKey: string
  retainedUntil: Date
  deletedAt: Date | null
}

export interface PsRetentionCleanupDatabase {
  select: () => {
    from: (table: unknown) => {
      where: (condition: unknown) => Promise<PsGeneratedPdfObjectForCleanup[]>
    }
  }
  update: (table: unknown) => {
    set: (values: unknown) => {
      where: (condition: unknown) => Promise<unknown>
    }
  }
}

export interface CleanupGeneratedPdfRetentionDependencies {
  database?: PsRetentionCleanupDatabase
  storage?: QuoteStorage
  now?: Date
}

export interface CleanupGeneratedPdfRetentionResult {
  scanned: number
  deleted: Array<{ id: string; r2ObjectKey: string }>
  failed: Array<{ id: string; r2ObjectKey: string; error: string }>
}

export async function cleanupGeneratedPdfRetention(
  dependencies: CleanupGeneratedPdfRetentionDependencies = {},
): Promise<CleanupGeneratedPdfRetentionResult> {
  const database = dependencies.database ?? await loadDefaultDb()
  const storage = dependencies.storage ?? getStorage()
  const now = dependencies.now ?? new Date()

  const expired = await database
    .select()
    .from(psGeneratedPdfObjects)
    .where(and(
      lte(psGeneratedPdfObjects.retainedUntil, now),
      isNull(psGeneratedPdfObjects.deletedAt),
    ))

  const result: CleanupGeneratedPdfRetentionResult = {
    scanned: expired.length,
    deleted: [],
    failed: [],
  }

  for (const object of expired) {
    try {
      await storage.delete(object.r2ObjectKey)
      await database
        .update(psGeneratedPdfObjects)
        .set({ deletedAt: now })
        .where(eq(psGeneratedPdfObjects.id, object.id))
      result.deleted.push({ id: object.id, r2ObjectKey: object.r2ObjectKey })
    } catch (error) {
      result.failed.push({
        id: object.id,
        r2ObjectKey: object.r2ObjectKey,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return result
}

async function loadDefaultDb(): Promise<PsRetentionCleanupDatabase> {
  const { db } = await import('@/lib/db')
  return db as unknown as PsRetentionCleanupDatabase
}
