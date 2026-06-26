import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import type { QuoteStorage } from './types'

function localRoot(): string {
  return resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR ?? 'tmp/quotes')
}

function pathForKey(key: string): string {
  const root = localRoot()
  const target = resolve(root, key)

  if (target !== root && !target.startsWith(`${root}\\`) && !target.startsWith(`${root}/`)) {
    throw new Error(`Storage key escapes local storage root: ${key}`)
  }

  return target
}

export class LocalQuoteStorage implements QuoteStorage {
  async put(key: string, bytes: Buffer): Promise<void> {
    const target = pathForKey(key)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, bytes)
  }

  async head(key: string): Promise<boolean> {
    try {
      await stat(pathForKey(key))
      return true
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw err
    }
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(pathForKey(key))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  async delete(key: string): Promise<void> {
    await rm(pathForKey(key), { force: true })
  }
}
