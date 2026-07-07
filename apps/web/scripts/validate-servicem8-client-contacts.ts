// Read-only ServiceM8 export for manual Clients import/contact validation.
//
// Usage from apps/web:
//   pnpm tsx scripts/validate-servicem8-client-contacts.ts
//   pnpm tsx scripts/validate-servicem8-client-contacts.ts --limit 20 --delay-ms 2000
//
// Requires SERVICEM8_API_KEY in the environment or apps/web/.env.local.

import { config } from 'dotenv'
config({ path: '.env.local' })

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  createServiceM8RequestFromEnv,
  getCompanyContact,
  getJobContact,
  type ServiceM8FetchRequest,
  type ServiceM8JobContact,
} from '../lib/servicem8/client'

type ServiceM8JobRecord = {
  uuid?: string | null
  active?: number | string | boolean | null
  status?: string | null
  company_uuid?: string | null
  generated_job_id?: string | null
}

type ServiceM8CompanyRecord = {
  uuid?: string | null
  name?: string | null
  active?: number | string | boolean | null
  email?: string | null
  phone?: string | null
  mobile?: string | null
}

type ValidationRow = {
  index: number
  companyUuid: string
  companyName: string
  jobStatus: string
  jobNumber: string
  contactName: string
  email: string
  phone: string
  source: 'jobcontact' | 'companycontact/company'
  sourceSnapshot: Record<string, unknown>
}

const DEFAULT_LIMIT = 20
const DEFAULT_DELAY_MS = 2000
const DEFAULT_OUT_DIR = 'tmp'

async function main() {
  const args = process.argv.slice(2)
  const limit = parsePositiveInt(getArg(args, '--limit'), DEFAULT_LIMIT)
  const delayMs = parsePositiveInt(getArg(args, '--delay-ms'), DEFAULT_DELAY_MS)
  const outDir = getArg(args, '--out-dir') ?? DEFAULT_OUT_DIR
  const request = throttleRequest(createServiceM8RequestFromEnv(), delayMs)

  console.log(`Checking up to ${limit} ServiceM8 clients with active Work Order or Completed jobs...`)
  console.log(`Using ${delayMs}ms delay between ServiceM8 requests.`)

  const jobs = [
    ...await readServiceM8Array<ServiceM8JobRecord>(
      request,
      `/job.json${odataQuery("active eq 1 and status eq 'Work Order'")}`,
    ),
    ...await readServiceM8Array<ServiceM8JobRecord>(
      request,
      `/job.json${odataQuery("active eq 1 and status eq 'Completed'")}`,
    ),
  ]
  const eligibleJobs = jobs.filter(isEligibleJob)
  const selected = firstJobsByCompany(eligibleJobs, limit)

  if (selected.length === 0) {
    console.log('No eligible ServiceM8 clients found.')
    return
  }

  const rows: ValidationRow[] = []
  for (const [index, job] of selected.entries()) {
    const companyUuid = clean(job.company_uuid)!
    const company = await readServiceM8Object<ServiceM8CompanyRecord>(request, `/company/${companyUuid}.json`)
    const jobContact = await contactFromJob(job.uuid, request)
    const contact = jobContact ?? await getCompanyContact(companyUuid, request)
    const phone = clean(contact?.mobile) ?? clean(contact?.phone) ?? clean(company.mobile) ?? clean(company.phone) ?? ''
    const email = clean(contact?.email) ?? clean(company.email) ?? ''
    const contactName = clean(contact?.name) ?? ''
    const companyName = clean(company.name) ?? '(missing company name)'

    rows.push({
      index: index + 1,
      companyUuid,
      companyName,
      jobStatus: clean(job.status) ?? '(missing status)',
      jobNumber: clean(job.generated_job_id) ?? clean(job.uuid) ?? '(missing job id)',
      contactName,
      email,
      phone,
      source: jobContact ? 'jobcontact' : 'companycontact/company',
      sourceSnapshot: {
        company,
        selectedJob: job,
        contact: contact ?? null,
        contactSource: jobContact ? 'jobcontact' : 'companycontact/company',
      },
    })
  }

  printRows(rows)
  await writeOutputs(rows, outDir)

  const withName = rows.filter((row) => row.contactName).length
  const withEmail = rows.filter((row) => row.email).length
  const withPhone = rows.filter((row) => row.phone).length
  const complete = rows.filter((row) => row.contactName && row.email && row.phone).length

  console.log('\n=== Summary ===')
  console.log(`Eligible jobs fetched: ${eligibleJobs.length}`)
  console.log(`Clients checked:       ${rows.length}`)
  console.log(`Contact person found:  ${withName}/${rows.length}`)
  console.log(`Email found:           ${withEmail}/${rows.length}`)
  console.log(`Phone found:           ${withPhone}/${rows.length}`)
  console.log(`Name + email + phone:  ${complete}/${rows.length}`)
  console.log('\n=== Files written ===')
  console.log(`${join(outDir, 'servicem8-clients-export.csv')}`)
  console.log(`${join(outDir, 'servicem8-clients-export.json')}`)
  console.log(`${join(outDir, 'servicem8-clients-neon.sql')}`)

  if (rows.length < limit) {
    console.log(`\nOnly ${rows.length} unique eligible client companies were available from ServiceM8.`)
  }
}

async function contactFromJob(
  jobUuid: string | null | undefined,
  request: ServiceM8FetchRequest,
): Promise<ServiceM8JobContact | null> {
  const uuid = clean(jobUuid)
  return uuid ? getJobContact(uuid, request) : null
}

function firstJobsByCompany(jobs: ServiceM8JobRecord[], limit: number): ServiceM8JobRecord[] {
  const seen = new Set<string>()
  const selected: ServiceM8JobRecord[] = []

  for (const job of jobs) {
    const companyUuid = clean(job.company_uuid)
    if (!companyUuid || seen.has(companyUuid)) continue
    seen.add(companyUuid)
    selected.push(job)
    if (selected.length >= limit) break
  }

  return selected
}

function isEligibleJob(job: ServiceM8JobRecord): boolean {
  const status = normalizeStatus(job.status)
  return isActive(job.active) && Boolean(clean(job.company_uuid)) && (status === 'work order' || status === 'completed')
}

async function readServiceM8Array<T>(request: ServiceM8FetchRequest, path: string): Promise<T[]> {
  const res = await request(path)
  if (!res.ok) throw new Error(`ServiceM8 request failed with HTTP ${res.status}: ${path}`)
  const rows = await res.json()
  return Array.isArray(rows) ? rows as T[] : []
}

async function readServiceM8Object<T>(request: ServiceM8FetchRequest, path: string): Promise<T> {
  const res = await request(path)
  if (!res.ok) throw new Error(`ServiceM8 request failed with HTTP ${res.status}: ${path}`)
  const row = await res.json()
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error(`ServiceM8 returned an unexpected object response: ${path}`)
  }
  return row as T
}

function printRows(rows: ValidationRow[]) {
  console.log('\n=== Contact validation rows ===')
  for (const row of rows) {
    console.log([
      `${row.index}. ${row.companyName}`,
      `company=${row.companyUuid}`,
      `job=${row.jobNumber}`,
      `status=${row.jobStatus}`,
      `contact=${row.contactName || '(missing)'}`,
      `email=${row.email || '(missing)'}`,
      `phone=${row.phone || '(missing)'}`,
      `source=${row.source}`,
    ].join(' | '))
  }
}

function getArg(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function isActive(value: ServiceM8JobRecord['active']) {
  return value === undefined || value === null || value === true || value === 1 || value === '1'
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeStatus(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? ''
}

function odataQuery(filter: string): string {
  return `?%24filter=${encodeURIComponent(filter)}`
}

main().catch((error) => {
  console.error('\nValidation failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})

function throttleRequest(request: ServiceM8FetchRequest, delayMs: number): ServiceM8FetchRequest {
  let previous = Promise.resolve()

  return async (path, init) => {
    const waitForPrevious = previous
    let release!: () => void
    previous = new Promise((resolve) => {
      release = resolve
    })

    await waitForPrevious
    try {
      return await request(path, init)
    } finally {
      setTimeout(release, delayMs)
    }
  }
}

async function writeOutputs(rows: ValidationRow[], outDir: string) {
  await mkdir(outDir, { recursive: true })
  await Promise.all([
    writeFile(join(outDir, 'servicem8-clients-export.csv'), toCsv(rows)),
    writeFile(join(outDir, 'servicem8-clients-export.json'), `${JSON.stringify(rows, null, 2)}\n`),
    writeFile(join(outDir, 'servicem8-clients-neon.sql'), toNeonSql(rows)),
  ])
}

function toCsv(rows: ValidationRow[]): string {
  const headers = [
    'servicem8_company_uuid',
    'client_name',
    'company_name',
    'email',
    'phone',
    'contact_name',
    'job_number',
    'job_status',
    'contact_source',
  ]

  const lines = rows.map((row) => [
    row.companyUuid,
    row.companyName,
    row.companyName,
    row.email,
    row.phone,
    row.contactName,
    row.jobNumber,
    row.jobStatus,
    row.source,
  ].map(csvCell).join(','))

  return `${headers.join(',')}\n${lines.join('\n')}\n`
}

function toNeonSql(rows: ValidationRow[]): string {
  const statements = rows.map((row) => {
    const hasContact = Boolean(row.contactName || row.email || row.phone)
    const sourceSnapshot = {
      servicem8CompanyUuid: row.companyUuid,
      clientName: row.companyName,
      companyName: row.companyName,
      email: row.email || null,
      phone: row.phone || null,
      contactName: row.contactName || null,
      selectedJobNumber: row.jobNumber,
      selectedJobStatus: row.jobStatus,
      contactSource: row.source,
      raw: row.sourceSnapshot,
    }

    return `-- ${row.index}. ${row.companyName}
WITH existing AS (
  SELECT id
  FROM clients
  WHERE servicem8_company_uuid = ${sqlValue(row.companyUuid)}
    AND is_merged = false
  LIMIT 1
),
updated AS (
  UPDATE clients
  SET
    servicem8_name = ${sqlValue(row.companyName)},
    servicem8_company_name = ${sqlValue(row.companyName)},
    servicem8_email = ${sqlValue(row.email)},
    servicem8_phone = ${sqlValue(row.phone)},
    servicem8_source_snapshot = ${sqlValue(JSON.stringify(sourceSnapshot))}::jsonb,
    servicem8_last_synced_at = now(),
    updated_at = now()
  WHERE id IN (SELECT id FROM existing)
  RETURNING id
),
inserted AS (
  INSERT INTO clients (
    servicem8_company_uuid,
    name,
    company_name,
    email,
    phone,
    canonical_source,
    servicem8_name,
    servicem8_company_name,
    servicem8_email,
    servicem8_phone,
    servicem8_source_snapshot,
    servicem8_last_synced_at,
    review_status
  )
  SELECT
    ${sqlValue(row.companyUuid)},
    ${sqlValue(row.companyName)},
    ${sqlValue(row.companyName)},
    ${sqlValue(row.email)},
    ${sqlValue(row.phone)},
    'import',
    ${sqlValue(row.companyName)},
    ${sqlValue(row.companyName)},
    ${sqlValue(row.email)},
    ${sqlValue(row.phone)},
    ${sqlValue(JSON.stringify(sourceSnapshot))}::jsonb,
    now(),
    'pending_review'
  WHERE NOT EXISTS (SELECT 1 FROM existing)
  RETURNING id
),
target AS (
  SELECT id FROM updated
  UNION ALL
  SELECT id FROM inserted
  UNION ALL
  SELECT id FROM existing
  WHERE NOT EXISTS (SELECT 1 FROM updated)
    AND NOT EXISTS (SELECT 1 FROM inserted)
)
INSERT INTO client_contacts (client_id, name, email, phone)
SELECT id, ${sqlValue(row.contactName)}, ${sqlValue(row.email)}, ${sqlValue(row.phone)}
FROM target
WHERE ${hasContact ? 'true' : 'false'}
  AND NOT EXISTS (
    SELECT 1
    FROM client_contacts cc
    WHERE cc.client_id = target.id
      AND coalesce(cc.email, '') = ${sqlValue(row.email)}
      AND coalesce(cc.phone, '') = ${sqlValue(row.phone)}
      AND coalesce(cc.name, '') = ${sqlValue(row.contactName)}
  );`
  })

  return [
    '-- Generated by scripts/validate-servicem8-client-contacts.ts',
    '-- Review before running in Neon. This updates existing linked Clients or inserts pending-review imported Clients.',
    'BEGIN;',
    ...statements,
    'COMMIT;',
    '',
  ].join('\n\n')
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function sqlValue(value: string): string {
  if (!value) return 'null'
  return `'${value.replace(/'/g, "''")}'`
}
