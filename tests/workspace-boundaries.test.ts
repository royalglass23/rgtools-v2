import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const root = path.resolve(__dirname, '..')

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')) as Record<string, unknown>
}

function readText(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

function listSourceFiles(relativePath: string): string[] {
  const start = path.join(root, relativePath)
  const files: string[] = []

  function walk(directory: string) {
    for (const entry of readdirSync(directory)) {
      const absolutePath = path.join(directory, entry)
      const relative = path.relative(root, absolutePath)

      if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue

      if (statSync(absolutePath).isDirectory()) {
        walk(absolutePath)
        continue
      }

      if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) {
        files.push(relative)
      }
    }
  }

  walk(start)
  return files
}

describe('workspace prefactor boundaries', () => {
  it('declares web, catalog, and database workspace packages', () => {
    const workspace = readText('pnpm-workspace.yaml')

    expect(workspace).toMatch(/-\s*['"]?apps\/\*['"]?/)
    expect(workspace).toMatch(/-\s*['"]?packages\/\*['"]?/)
    expect(workspace).toMatch(/-\s*['"]?workers\/\*['"]?/)
    expect(readJson('apps/web/package.json')).toMatchObject({ name: '@rgtools/web', private: true })
    expect(readJson('apps/catalog/package.json')).toMatchObject({ name: '@rgtools/catalog', private: true })
    expect(readJson('packages/db/package.json')).toMatchObject({ name: '@rgtools/db', private: true })
  })

  it('keeps shared database schema and client behind @rgtools/db', () => {
    const dbPackage = readJson('packages/db/package.json')

    expect(dbPackage).toMatchObject({
      exports: {
        '.': './src/index.ts',
        './schema': './src/schema.ts',
        './schema-leads': './src/schema-leads.ts',
      },
    })

    expect(readText('apps/web/lib/db.ts')).toContain("from '@rgtools/db'")
    expect(readText('drizzle.config.ts')).toContain('packages/db/src/schema.ts')
    expect(readText('drizzle.config.ts')).toContain('packages/db/src/schema-leads.ts')
  })

  it('prevents the public catalog app from importing internal web code', () => {
    const catalogSources = listSourceFiles('apps/catalog')

    for (const source of catalogSources) {
      const contents = readText(source)
      expect(contents, source).not.toMatch(/from ['"](?:@\/|@rgtools\/web|(?:\.\.\/)+web\/)/)
    }
  })
})
