// Read-only ServiceM8 validation for Clients refresh contact coverage.
//
// Usage from apps/web:
//   pnpm tsx scripts/validate-servicem8-client-contacts.ts
//   pnpm tsx scripts/validate-servicem8-client-contacts.ts --limit 20
//
// Requires SERVICEM8_API_KEY in the environment or apps/web/.env.local.

import { config } from 'dotenv'
config({ path: '.env.local' })

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
}

const DEFAULT_LIMIT = 20

async function main() {
  const args = process.argv.slice(2)
  const limit = parsePositiveInt(getArg(args, '--limit'), DEFAULT_LIMIT)
  const request = createServiceM8RequestFromEnv()

  console.log(`Checking up to ${limit} ServiceM8 clients with active Work Order or Completed jobs...`)

  const jobs = (await Promise.all([
    readServiceM8Array<ServiceM8JobRecord>(
      request,
      `/job.json${odataQuery("active eq 1 and status eq 'Work Order'")}`,
    ),
    readServiceM8Array<ServiceM8JobRecord>(
      request,
      `/job.json${odataQuery("active eq 1 and status eq 'Completed'")}`,
    ),
  ])).flat()
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

    rows.push({
      index: index + 1,
      companyUuid,
      companyName: clean(company.name) ?? '(missing company name)',
      jobStatus: clean(job.status) ?? '(missing status)',
      jobNumber: clean(job.generated_job_id) ?? clean(job.uuid) ?? '(missing job id)',
      contactName: clean(contact?.name) ?? '',
      email,
      phone,
      source: jobContact ? 'jobcontact' : 'companycontact/company',
    })
  }

  printRows(rows)

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
