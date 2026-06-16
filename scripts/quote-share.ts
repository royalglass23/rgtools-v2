// One-command online share — pulls a ServiceM8 quote, serves the tracked
// viewer, opens a Cloudflare quick tunnel, and prints the public link.
//
// Usage (PowerShell):
//   pnpm quote:share --job 123
//   pnpm quote:share --uuid <jobUuid>
//   pnpm quote:share --latest
//   (optional) --port 4321
//
// Ctrl+C to stop (shuts down the tunnel + server). The trycloudflare URL is
// temporary and changes each run. No tracking yet (that's Stage 4).

import { config } from 'dotenv'
config({ path: '.env.local' })

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const CLOUDFLARED_PATH = join(process.cwd(), 'tmp', 'cloudflared.exe')
const CLOUDFLARED_URL =
  'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'

async function ensureCloudflared() {
  if (existsSync(CLOUDFLARED_PATH)) return
  console.log('cloudflared not found — downloading (~50 MB, one-time)...')
  await mkdir(join(process.cwd(), 'tmp'), { recursive: true })
  const res = await fetch(CLOUDFLARED_URL)
  if (!res.ok) throw new Error(`Failed to download cloudflared: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(CLOUDFLARED_PATH, buf)
  console.log(`Saved cloudflared (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB)`)
}

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

  await ensureCloudflared()
  const { code, printSummary } = await startQuoteServer({
    jobNumber, uuid, latest, port, watch, watchTimeoutSec, minValue, force,
  })

  console.log('Starting public tunnel...')
  const tunnel = spawn(CLOUDFLARED_PATH, ['tunnel', '--url', `http://localhost:${port}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let printed = false
  const onData = (chunk: Buffer) => {
    const text = chunk.toString()
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
    if (match && !printed) {
      printed = true
      const publicLink = `${match[0]}/q/${code}`
      console.log('\n========================================================')
      console.log(`🔗 Public quote link:\n   ${publicLink}`)
      console.log('   Open it on any device or share it. (Ctrl+C to stop)')
      console.log('========================================================\n')
    }
  }
  tunnel.stdout.on('data', onData)
  tunnel.stderr.on('data', onData) // cloudflared logs the URL to stderr

  const shutdown = () => {
    console.log('\nShutting down...')
    printSummary()
    tunnel.kill()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  tunnel.on('exit', (codeNum) => {
    if (!printed) console.error(`Tunnel exited early (code ${codeNum}). Is cloudflared blocked?`)
  })
}

main().catch((err) => {
  console.error('\n❌ Share failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
