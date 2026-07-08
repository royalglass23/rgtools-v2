import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { loadEnvConfig } from '@next/env'
import { count, eq, inArray, or } from 'drizzle-orm'
import type {
  leadMatrixClientTypeEnum,
  leadBudgetBandEnum,
  leadConsentStatusEnum,
  leadBuildingStageEnum,
  leadProjectTypeEnum,
  leadPriceSensitivityEnum,
} from '@rgtools/db/schema-leads'

type ClientTypeKey = typeof leadMatrixClientTypeEnum.enumValues[number]
type BudgetBandKey = typeof leadBudgetBandEnum.enumValues[number]
type ConsentKey = typeof leadConsentStatusEnum.enumValues[number]
type BuildingStageKey = typeof leadBuildingStageEnum.enumValues[number]
type ProjectTypeKey = typeof leadProjectTypeEnum.enumValues[number]
type PriceSensitivityKey = typeof leadPriceSensitivityEnum.enumValues[number]

type ImportTarget = 'dev' | 'prod'

type ImportRow = {
  jobNumber: string
  clientName: string
  companyName: string | null
  phone: string | null
  email: string | null
  jobAddress: string
  clientTypeKey: string | null
  clientTypeLabel: string | null
  budgetBandKey: string | null
  projectTypeKey: string | null
  projectTypeLabel: string | null
  priceSensitivityKey: string | null
  resourceConsentKey: string | null
  buildingConsentKey: string | null
  buildingStageKey: string | null
  invoiceAmount: number | null
  notes: string | null
}

const DEFAULT_WORKBOOK = path.resolve(
  process.cwd(),
  '..',
  '..',
  'scratch',
  'outputs',
  'lead-import-20260707',
  'combined-lead-import-status-review.xlsx',
)
const DEFAULT_ROWS_JSON = path.resolve(
  process.cwd(),
  '..',
  '..',
  'scratch',
  'outputs',
  'lead-import-20260707',
  'import-ready-rows.json',
)

function argValue(name: string) {
  const prefix = `${name}=`
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

function hasArg(name: string) {
  return process.argv.includes(name)
}

function stripInlineComment(value: string) {
  let quote: string | null = null

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]

    if ((char === '"' || char === "'") && value[index - 1] !== '\\') {
      quote = quote === char ? null : quote ?? char
    }

    if (char === '#' && quote === null) {
      return value.slice(0, index).trim()
    }
  }

  return value.trim()
}

function parseEnvValue(rawValue: string) {
  const value = stripInlineComment(rawValue)
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1)
    }
  }
  return value
}

function readEnvFileValue(filePath: string, key: string) {
  if (!existsSync(filePath)) return undefined
  const contents = readFileSync(filePath, 'utf8')
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`^${escaped}\\s*=\\s*(.*)$`, 'm').exec(contents)
  return match ? parseEnvValue(match[1]) : undefined
}

function readLocalEnvValue(workspaceRoot: string, key: string) {
  for (const envFile of ['.env.local', '.env']) {
    const value = readEnvFileValue(path.join(workspaceRoot, envFile), key)
    if (value) return value
  }
  return undefined
}

function configureDatabaseUrl(target: ImportTarget, workspaceRoot: string) {
  loadEnvConfig(workspaceRoot)

  const devUrl = readLocalEnvValue(workspaceRoot, 'DATABASE_URL') ?? process.env.DATABASE_URL
  const prodUrl = readLocalEnvValue(workspaceRoot, 'DB_URL_PROD') ?? process.env.DB_URL_PROD

  if (target === 'dev') {
    if (!devUrl) throw new Error('DATABASE_URL is required for --target=dev.')
    if (prodUrl && devUrl === prodUrl) {
      throw new Error('Refusing dev import because DATABASE_URL matches DB_URL_PROD.')
    }
    process.env.DATABASE_URL = devUrl
    return
  }

  if (!hasArg('--confirm-production')) {
    throw new Error('Production import requires --confirm-production.')
  }
  if (!prodUrl) {
    throw new Error('DB_URL_PROD is required for --target=prod.')
  }
  if (!/^postgres(?:ql)?:\/\//.test(prodUrl)) {
    throw new Error('DB_URL_PROD must be a PostgreSQL connection string.')
  }
  if (devUrl && devUrl === prodUrl) {
    throw new Error('Refusing production import because DB_URL_PROD matches DATABASE_URL.')
  }

  process.env.DATABASE_URL = prodUrl
}

function describeDatabaseUrl() {
  const url = process.env.DATABASE_URL
  if (!url) return null
  try {
    const parsed = new URL(url)
    return {
      host: parsed.host,
      database: parsed.pathname.replace(/^\//, ''),
      user: parsed.username,
    }
  } catch {
    return { host: 'unparseable', database: 'unparseable', user: 'unparseable' }
  }
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = String(value ?? '').replace(/[$,]/g, '').trim()
  if (!text) return null
  const numeric = Number(text)
  return Number.isFinite(numeric) ? numeric : null
}

function readImportRows(rowsJsonPath: string): ImportRow[] {
  const payload = JSON.parse(readFileSync(rowsJsonPath, 'utf8')) as Array<Record<string, unknown>>
  return payload.map((row) => ({
    jobNumber: String(row['Job Number *'] ?? '').trim().toUpperCase(),
    clientName: String(row['Client Name *'] ?? '').trim(),
    companyName: nullableString(row.Company),
    phone: nullableString(row.Phone),
    email: nullableString(row.Email)?.toLowerCase() ?? null,
    jobAddress: String(row['Job Address *'] ?? '').trim(),
    clientTypeKey: nullableString(row['Client Type Key *']),
    clientTypeLabel: nullableString(row['Client Type Label']),
    budgetBandKey: nullableString(row['Budget Band Key']),
    projectTypeKey: nullableString(row['Project Type Key']),
    projectTypeLabel: nullableString(row['Project Type Label']),
    priceSensitivityKey: nullableString(row['Price Sensitivity Key']),
    resourceConsentKey: nullableString(row['Resource Consent Key']),
    buildingConsentKey: nullableString(row['Building Consent Key']),
    buildingStageKey: nullableString(row['Building Stage Key']),
    invoiceAmount: numericValue(row['Invoice Amount']),
    notes: nullableString(row.Notes),
  })).filter((row) => row.jobNumber || row.clientName || row.jobAddress)
}

function validateRows(rows: ImportRow[], decisionMatrix: typeof import('@/modules/lead-intake/scoring/score-lead').DECISION_MATRIX) {
  const optionKeys = new Map(decisionMatrix.fields.map((field) => [
    field.key,
    new Set(field.options.map((option) => option.key)),
  ]))
  const errors: string[] = []

  rows.forEach((row, index) => {
    const label = `row ${index + 2} (${row.jobNumber || 'missing job number'})`
    if (!row.jobNumber) errors.push(`${label}: missing job number`)
    if (!row.clientName) errors.push(`${label}: missing client name`)
    if (!row.jobAddress) errors.push(`${label}: missing job address`)
    const checks = [
      ['clientType', row.clientTypeKey],
      ['budgetBand', row.budgetBandKey],
      ['projectType', row.projectTypeKey],
      ['priceSensitivity', row.priceSensitivityKey],
      ['resourceConsent', row.resourceConsentKey],
      ['buildingConsent', row.buildingConsentKey],
      ['buildingStage', row.buildingStageKey],
    ] as const

    checks.forEach(([field, value]) => {
      if (value && !optionKeys.get(field)?.has(value)) {
        errors.push(`${label}: invalid ${field} key "${value}"`)
      }
    })
  })

  const seen = new Set<string>()
  for (const row of rows) {
    if (!row.jobNumber) continue
    if (seen.has(row.jobNumber)) errors.push(`duplicate job number in workbook: ${row.jobNumber}`)
    seen.add(row.jobNumber)
  }

  return errors
}

function buildJobDescription(row: ImportRow) {
  const parts = [
    row.notes,
    row.invoiceAmount === null ? null : `Imported source invoice amount: $${row.invoiceAmount.toFixed(2)}`,
    'Imported from combined-lead-import-status-review.xlsx on 2026-07-08.',
  ]
  return parts.filter(Boolean).join('\n')
}

async function main() {
  const target = argValue('--target') as ImportTarget | undefined
  if (target !== 'dev' && target !== 'prod') {
    throw new Error('Usage: tsx scripts/import-lead-status-review.ts --target=dev|prod [--dry-run] [--confirm-production]')
  }

  const dryRun = hasArg('--dry-run')
  const workspaceRoot = path.resolve(process.cwd(), '..', '..')
  const workbookPath = path.resolve(argValue('--workbook') ?? DEFAULT_WORKBOOK)
  const rowsJsonPath = path.resolve(argValue('--rows-json') ?? DEFAULT_ROWS_JSON)
  if (!existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`)
  if (!existsSync(rowsJsonPath)) throw new Error(`Rows JSON not found: ${rowsJsonPath}`)

  configureDatabaseUrl(target, workspaceRoot)

  const { db } = await import('@/lib/db')
  const { logAudit } = await import('@/lib/audit-db')
  const { leads } = await import('@rgtools/db/schema-leads')
  const { resolveClient } = await import('@/modules/clients/client-resolver')
  const { normalizeNzPhone } = await import('@/modules/lead-intake/intake-utils')
  const { persistLeadScore } = await import('@/modules/lead-intake/scoring/persist-score')
  const { DECISION_MATRIX } = await import('@/modules/lead-intake/scoring/score-lead')

  const rows = readImportRows(rowsJsonPath)
  const validationErrors = validateRows(rows, DECISION_MATRIX)
  if (validationErrors.length > 0) {
    console.error(validationErrors.join('\n'))
    process.exit(1)
  }

  const jobNumbers = rows.map((row) => row.jobNumber)
  const duplicateGroups = await db
    .select({
      jobNumber: leads.servicem8JobNumber,
      total: count(),
    })
    .from(leads)
    .where(inArray(leads.servicem8JobNumber, jobNumbers))
    .groupBy(leads.servicem8JobNumber)

  const duplicates = duplicateGroups.filter((row) => row.jobNumber && row.total > 1)
  if (duplicates.length > 0 && !hasArg('--allow-duplicates')) {
    throw new Error(`Refusing import: target already has duplicate workbook job numbers (${duplicates.slice(0, 10).map((row) => `${row.jobNumber}:${row.total}`).join(', ')}${duplicates.length > 10 ? ', ...' : ''}).`)
  }

  let created = 0
  let skipped = 0
  let existingScored = 0
  let existingQuoteStatus = 0
  const existingUnscoredJobNumbers: string[] = []
  const rescoreExisting = hasArg('--rescore-existing')
  const createdLeadIds: string[] = []

  for (const row of rows) {
    const [existing] = await db
      .select({
        id: leads.id,
        seedScore: leads.seedScore,
        tier: leads.tier,
        servicem8Status: leads.servicem8Status,
      })
      .from(leads)
      .where(or(eq(leads.externalRef, row.jobNumber), eq(leads.servicem8JobNumber, row.jobNumber)))
      .limit(1)

    if (existing) {
      skipped += 1
      if (existing.seedScore !== null && existing.tier !== null) {
        existingScored += 1
      } else {
        existingUnscoredJobNumbers.push(row.jobNumber)
        if (rescoreExisting && !dryRun) {
          await persistLeadScore(existing.id, null)
          existingScored += 1
        }
      }
      if ((existing.servicem8Status ?? '').trim().toLowerCase() === 'quote') existingQuoteStatus += 1
      continue
    }

    if (dryRun) {
      created += 1
      continue
    }

    let leadId = ''
    await db.transaction(async (tx) => {
      const resolved = await resolveClient(tx, {
        clientName: row.clientName,
        companyName: row.companyName,
        phone: row.phone,
        phoneNormalized: row.phone ? normalizeNzPhone(row.phone) : null,
        email: row.email,
        servicem8SourceSnapshot: {
          source: 'combined-lead-import-status-review',
          jobNumber: row.jobNumber,
          invoiceAmount: row.invoiceAmount,
          workbook: path.basename(workbookPath),
        },
      })

      const now = new Date()
      const [createdLead] = await tx
        .insert(leads)
        .values({
          clientId: resolved.clientId,
          contactId: resolved.contactId,
          channel: 'other',
          externalRef: row.jobNumber,
          syncStatus: 'synced',
          servicem8JobNumber: row.jobNumber,
          servicem8Status: 'Quote',
          clientTypeAnswer: row.clientTypeKey as ClientTypeKey | null,
          budgetBand: row.budgetBandKey as BudgetBandKey | null,
          resourceConsent: row.resourceConsentKey as ConsentKey | null,
          buildingConsent: row.buildingConsentKey as ConsentKey | null,
          buildingStage: row.buildingStageKey as BuildingStageKey | null,
          projectType: row.projectTypeKey as ProjectTypeKey | null,
          product: row.projectTypeLabel ?? row.projectTypeKey,
          priceSensitivity: row.priceSensitivityKey as PriceSensitivityKey | null,
          location: row.jobAddress,
          jobDescription: buildJobDescription(row),
          freeText: buildJobDescription(row),
          createdBy: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: leads.id })

      leadId = createdLead.id
      await logAudit({
        actorId: null,
        entityType: 'lead',
        action: 'lead.bulk_import_status_review',
        targetId: leadId,
        before: null,
        after: {
          jobNumber: row.jobNumber,
          target,
          workbook: path.basename(workbookPath),
          clientId: resolved.clientId,
          matchedExistingClient: resolved.matchedExistingClient,
          invoiceAmount: row.invoiceAmount,
        },
      }, tx)
    })

    await persistLeadScore(leadId, null)
    createdLeadIds.push(leadId)
    created += 1
  }

  console.log(JSON.stringify({
    target,
    database: describeDatabaseUrl(),
    dryRun,
    workbook: workbookPath,
    rowsJson: rowsJsonPath,
    rows: rows.length,
    toCreateOrCreated: created,
    skippedExisting: skipped,
    existingScored,
    existingQuoteStatus,
    existingUnscoredJobNumbers,
    firstCreatedLeadIds: createdLeadIds.slice(0, 5),
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exit(1)
})
