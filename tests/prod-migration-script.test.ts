import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const root = path.resolve(__dirname, '..')

function readText(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('production migration command', () => {
  it('keeps production migration behind an explicit DB_URL_PROD command', () => {
    const packageJson = JSON.parse(readText('package.json')) as {
      scripts: Record<string, string>
    }
    const script = readText('scripts/migrate-prod.mjs')

    expect(packageJson.scripts['db:migrate']).toBe('drizzle-kit migrate')
    expect(packageJson.scripts['db:migrate:prod']).toBe('node scripts/migrate-prod.mjs')
    expect(script).toContain("process.env.DB_URL_PROD ?? readGitignoredProdUrl()")
    expect(script).toContain("for (const envFile of ['.env.local', '.env'])")
    expect(script).toContain('DATABASE_URL: prodUrl')
    expect(script).toContain("shell: process.platform === 'win32'")
    expect(script).toContain('DB_URL_PROD is required')
  })
})
