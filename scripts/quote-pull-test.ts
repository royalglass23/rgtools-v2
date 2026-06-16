// Stage 1 test harness — pull a ServiceM8 quote (metadata + PDF) without
// touching the database. Lets us confirm a *newly created* quote is pullable.
//
// Usage (PowerShell):
//   pnpm tsx scripts/quote-pull-test.ts --job 123        # by job number
//   pnpm tsx scripts/quote-pull-test.ts --uuid <jobUuid> # by job UUID
//   pnpm tsx scripts/quote-pull-test.ts --latest         # most recent Quote-status job
//
// On success it prints the metadata and writes the PDF to ./tmp/quote-<n>.pdf

import { config } from 'dotenv'
config({ path: '.env.local' })

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

async function main() {
  const {
    createServiceM8RequestFromEnv,
    resolveJobUuid,
    getJobQuoteMeta,
    getQuoteAttachmentPdf,
  } = await import('../lib/servicem8/client')

  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  const jobNumber = get('--job')
  const uuid = get('--uuid')
  const latest = args.includes('--latest')

  if (!jobNumber && !uuid && !latest) {
    console.error('Provide one of: --job <number> | --uuid <jobUuid> | --latest')
    process.exit(1)
  }

  const request = createServiceM8RequestFromEnv()

  console.log('Resolving job...')
  const jobUuid = await resolveJobUuid({ uuid, jobNumber, latestQuote: latest }, request)
  if (!jobUuid) {
    console.error('No matching job found.')
    process.exit(1)
  }

  const meta = await getJobQuoteMeta(jobUuid, request)
  console.log('\n=== Job metadata ===')
  console.log(`uuid:        ${meta.jobUuid}`)
  console.log(`job number:  ${meta.jobNumber}`)
  console.log(`status:      ${meta.status}`)
  console.log(`client:      ${meta.clientName}`)
  console.log(`value:       ${meta.quoteValue}`)
  console.log(`description: ${(meta.jobDescription ?? '').trim()}`)
  console.log(`address:     ${(meta.jobAddress ?? '').replace(/\n/g, ', ')}`)

  console.log('\nPulling quote PDF...')
  const pdf = await getQuoteAttachmentPdf(jobUuid, request)
  if (!pdf) {
    console.error(
      '\nNo QUOTE PDF attachment found on this job yet.\n' +
        'In ServiceM8, finalise/send the quote so it generates the Quote PDF, then re-run.',
    )
    process.exit(2)
  }

  const head = new Uint8Array(pdf.bytes.slice(0, 5))
  const magic = String.fromCharCode(...head)
  const sizeKb = (pdf.bytes.byteLength / 1024).toFixed(1)

  await mkdir(join(process.cwd(), 'tmp'), { recursive: true })
  const outPath = join('tmp', `quote-${meta.jobNumber ?? 'job'}.pdf`)
  await writeFile(outPath, Buffer.from(pdf.bytes))

  console.log('\n=== Quote PDF ===')
  console.log(`attachment:  ${pdf.name}`)
  console.log(`file type:   ${pdf.fileType}`)
  console.log(`size:        ${sizeKb} KB`)
  console.log(`magic:       ${magic} ${magic === '%PDF-' ? '(valid PDF ✅)' : '(NOT a PDF ❌)'}`)
  console.log(`saved to:    ${outPath}`)

  if (magic !== '%PDF-') process.exit(3)
  console.log('\n✅ Pull succeeded.')
}

main().catch((err) => {
  console.error('\n❌ Pull failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
