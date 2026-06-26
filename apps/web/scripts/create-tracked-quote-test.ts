import { config } from 'dotenv'
config({ path: '.env.local' })

import { eq } from 'drizzle-orm'

import { quotes } from '@rgtools/db/schema'
import { db } from '@/lib/db'
import { getStorage } from '@/lib/storage'
import { createTrackedQuote } from '@/modules/quote-tracker/create-tracked-quote'
import type { ExpiryPreset } from '@/modules/quote-tracker/expiry'

const EXPIRY_PRESETS = new Set(['1h', '3h', '12h', '1d', '7d', '30d'])

function getFlag(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}

async function main() {
  const args = process.argv.slice(2)
  const jobNumber = getFlag(args, '--job')
  const jobUuid = getFlag(args, '--uuid')
  const latest = args.includes('--latest')
  const expiryArg = getFlag(args, '--expiry') ?? '1h'

  if ((!jobNumber && !jobUuid && !latest) || (jobNumber && jobUuid)) {
    console.error('Provide one of: --job <number> | --uuid <jobUuid> | --latest')
    process.exit(1)
  }

  if (!EXPIRY_PRESETS.has(expiryArg)) {
    console.error('Invalid --expiry. Use one of: 1h, 3h, 12h, 1d, 7d, 30d')
    process.exit(1)
  }

  let resolvedJobUuid = jobUuid
  if (latest) {
    const { createServiceM8RequestFromEnv, resolveJobUuid } = await import('../lib/servicem8/client')
    resolvedJobUuid = await resolveJobUuid({ latestQuote: true }, createServiceM8RequestFromEnv()) ?? undefined
  }

  const result = await createTrackedQuote({
    jobUuid: resolvedJobUuid,
    jobNumber,
    expiry: expiryArg as ExpiryPreset,
  })

  if (!result.ok) {
    console.error(`${result.reason}: ${result.message}`)
    process.exit(1)
  }

  const [row] = await db
    .select({
      id: quotes.id,
      shortCode: quotes.shortCode,
      pdfStorageKey: quotes.pdfStorageKey,
    })
    .from(quotes)
    .where(eq(quotes.id, result.quoteId))
    .limit(1)

  if (!row?.pdfStorageKey || row.shortCode !== result.shortCode) {
    console.error('DB row: FAILED')
    process.exit(1)
  }

  const storedObjectOk = await getStorage().head(row.pdfStorageKey)
  if (!storedObjectOk) {
    console.error('Stored object: FAILED')
    process.exit(1)
  }

  console.log(`storageDriver: ${result.storageDriver}`)
  console.log(`quoteId: ${result.quoteId}`)
  console.log(`shortCode: ${result.shortCode}`)
  console.log(`link: ${result.link}`)
  console.log(`expiresAt: ${result.expiresAt.toISOString()}`)
  console.log(`clientName: ${result.clientName}`)
  console.log(`quoteValue: ${result.quoteValue}`)
  console.log('DB row: OK')
  console.log('Stored object: OK')
}

main().catch((err) => {
  console.error('Create tracked quote failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
