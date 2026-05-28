import { describe, it, expect } from 'vitest'
import { sql } from 'drizzle-orm'

describe('database connection', () => {
  it('connects to Neon and executes a query', async () => {
    const { db } = await import('../db')
    const result = await db.execute(sql`SELECT 1 AS value`)
    expect(result.rows[0].value).toBe(1)
  })
})
