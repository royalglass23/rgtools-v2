import { LocalQuoteStorage } from './local'
import { R2QuoteStorage } from './r2'
import type { QuoteStorage } from './types'

export type StorageDriver = 'local' | 'r2'

let storage: QuoteStorage | null = null
let activeDriver: StorageDriver | null = null
let loggedDriver = false

export function getStorageDriver(): StorageDriver {
  const configured = process.env.STORAGE_DRIVER
  if (configured === 'local' || configured === 'r2') return configured
  if (configured) throw new Error(`Unsupported STORAGE_DRIVER "${configured}". Expected "local" or "r2".`)

  return process.env.R2_ACCOUNT_ID ? 'r2' : 'local'
}

export function getStorage(): QuoteStorage {
  const driver = getStorageDriver()

  if (!storage || activeDriver !== driver) {
    activeDriver = driver
    storage = driver === 'r2' ? new R2QuoteStorage() : new LocalQuoteStorage()
  }

  if (!loggedDriver) {
    console.log(`storageDriver: ${driver}`)
    loggedDriver = true
  }

  return storage
}
