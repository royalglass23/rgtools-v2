import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { config } from 'dotenv'
import * as schema from '@/drizzle/schema'

if (!process.env.DATABASE_URL) {
  config({ path: '.env.local', override: true })
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })

export const db = drizzle(pool, { schema })
