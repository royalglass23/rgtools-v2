import { defineConfig } from 'drizzle-kit'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

export default defineConfig({
  schema: ['./packages/db/src/schema.ts', './packages/db/src/schema-leads.ts', './packages/db/src/schema-ps-generator.ts'],
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
