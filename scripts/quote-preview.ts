// Stage 1+ test harness — pull a ServiceM8 quote, mint a short link, and view
// it locally in the browser. For a public link, use `pnpm quote:share`.
//
// Usage (PowerShell):
//   pnpm quote:preview --job 123
//   pnpm quote:preview --uuid <jobUuid>
//   pnpm quote:preview --latest
//   (optional) --port 4321

import { config } from 'dotenv'
config({ path: '.env.local' })

import { exec } from 'node:child_process'

async function main() {
  const { startQuoteServer } = await import('./lib/quote-server')

  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  const jobNumber = get('--job')
  const uuid = get('--uuid')
  const latest = args.includes('--latest')
  const port = Number(get('--port') ?? 4321)
  const watch = args.includes('--watch')
  const watchTimeoutSec = get('--timeout') ? Number(get('--timeout')) : undefined
  const minValue = get('--min') ? Number(get('--min')) : undefined
  const force = args.includes('--force')

  if (!jobNumber && !uuid && !latest) {
    console.error('Provide one of: --job <number> | --uuid <jobUuid> | --latest')
    process.exit(1)
  }

  const { code, printSummary } = await startQuoteServer({
    jobNumber, uuid, latest, port, watch, watchTimeoutSec, minValue, force,
  })
  const link = `http://localhost:${port}/q/${code}`
  console.log(`\n✅ Quote link ready: ${link}`)
  console.log('Opening in your browser... (Ctrl+C to stop)')
  exec(`start "" "${link}"`, (err) => {
    if (err) console.log(`Could not auto-open. Open this manually: ${link}`)
  })

  const shutdown = () => {
    console.log('\nShutting down...')
    printSummary()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('\n❌ Preview failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
