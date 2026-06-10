// @vitest-environment node
// (jsdom breaks @neondatabase/serverless WebSockets: undici dispatches Events
// across realms and the connection's 'open' event never fires.)

import { describe, it, expect } from 'vitest'
import { sql } from 'drizzle-orm'

// Live-Neon integration test — opt in with RUN_DB_TESTS=1 so the default
// suite stays hermetic (sandboxes/CI without DB access must not fail).
// PowerShell: $env:RUN_DB_TESTS='1'; npx vitest run lib/__tests__/db.test.ts
describe.skipIf(!process.env.RUN_DB_TESTS)('database connection', () => {
  it('connects to Neon and executes a query', { timeout: 15_000 }, async () => {
    const { db } = await import('../db')
    const result = await db.execute(sql`SELECT 1 AS value`)
    expect(result.rows[0].value).toBe(1)
  })
})
