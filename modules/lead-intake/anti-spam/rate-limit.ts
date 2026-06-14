import { and, count, eq, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { leadSubmitAttempts } from '@/drizzle/schema-leads'

export type LeadSubmitAttemptStore = {
  prune(ip: string, cutoff: Date): Promise<void>
  count(ip: string): Promise<number>
  insert(ip: string, now: Date): Promise<void>
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number }

const LIMIT = 10
const WINDOW_MS = 60 * 60 * 1000

export async function checkLeadSubmitRateLimit(
  ip: string,
  {
    store = createDbLeadSubmitAttemptStore(),
    now = new Date(),
  }: {
    store?: LeadSubmitAttemptStore
    now?: Date
  } = {},
): Promise<RateLimitResult> {
  const cutoff = new Date(now.getTime() - WINDOW_MS)
  await store.prune(ip, cutoff)

  const attempts = await store.count(ip)
  if (attempts >= LIMIT) {
    return { ok: false, retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) }
  }

  await store.insert(ip, now)
  return { ok: true, remaining: LIMIT - attempts - 1 }
}

export function createDbLeadSubmitAttemptStore(): LeadSubmitAttemptStore {
  return {
    async prune(ip, cutoff) {
      await db
        .delete(leadSubmitAttempts)
        .where(and(eq(leadSubmitAttempts.ip, ip), lt(leadSubmitAttempts.createdAt, cutoff)))
    },
    async count(ip) {
      const [row] = await db
        .select({ value: count() })
        .from(leadSubmitAttempts)
        .where(eq(leadSubmitAttempts.ip, ip))

      return row?.value ?? 0
    },
    async insert(ip, now) {
      await db.insert(leadSubmitAttempts).values({ ip, createdAt: now })
    },
  }
}

export function createMemoryLeadSubmitAttemptStore(): LeadSubmitAttemptStore {
  const attempts = new Map<string, Date[]>()

  return {
    async prune(ip, cutoff) {
      attempts.set(ip, (attempts.get(ip) ?? []).filter((createdAt) => createdAt >= cutoff))
    },
    async count(ip) {
      return attempts.get(ip)?.length ?? 0
    },
    async insert(ip, now) {
      attempts.set(ip, [...(attempts.get(ip) ?? []), now])
    },
  }
}
