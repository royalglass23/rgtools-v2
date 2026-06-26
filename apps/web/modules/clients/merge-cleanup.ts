import { inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clients, leads } from '@rgtools/db/schema-leads'
import { createServiceM8RequestFromEnv, type ServiceM8FetchRequest } from '@/lib/servicem8/client'
import { mergeClients } from './client-resolver'
import { planClientMerges, type ClientMergePlanRow, type MergePlan } from './merge-planner'

type RunOptions = {
  apply: boolean
}

export type ClientMergeCleanupDeps = {
  loadRows: () => Promise<ClientMergePlanRow[]>
  mergeGroup: (survivorId: string, loserIds: string[]) => Promise<void>
  print: (message: string) => void
}

export type ClientMergeCleanupResult = {
  plan: MergePlan
  appliedGroups: number
}

export async function runClientMergeCleanup(
  options: RunOptions,
  deps: ClientMergeCleanupDeps = createClientMergeCleanupDeps(),
): Promise<ClientMergeCleanupResult> {
  const rows = await deps.loadRows()
  const plan = planClientMerges(rows)

  deps.print(formatMergePlan(plan, options.apply))

  let appliedGroups = 0
  if (options.apply) {
    for (const group of plan.autoMergeGroups) {
      await deps.mergeGroup(group.survivorId, group.loserIds)
      appliedGroups += 1
    }
  }

  return { plan, appliedGroups }
}

export function createClientMergeCleanupDeps(options: {
  request?: ServiceM8FetchRequest
} = {}): ClientMergeCleanupDeps {
  const request = options.request ?? createServiceM8RequestFromEnv()

  return {
    loadRows: () => loadClientMergeRows(request),
    mergeGroup: async (survivorId, loserIds) => {
      await db.transaction((tx) => mergeClients(tx, survivorId, loserIds))
    },
    print: console.log,
  }
}

export async function loadClientMergeRows(request: ServiceM8FetchRequest): Promise<ClientMergePlanRow[]> {
  const clientRows = await db.select().from(clients)
  const clientIds = clientRows.map((row) => row.id)
  const leadRows = clientIds.length === 0
    ? []
    : await db
      .select({
        clientId: leads.clientId,
        servicem8JobUuid: leads.servicem8JobUuid,
      })
      .from(leads)
      .where(inArray(leads.clientId, clientIds))

  const jobCompanyUuidByJob = new Map<string, string | null>()

  async function resolveFromJobs(clientId: string): Promise<string | null> {
    const jobUuids = leadRows
      .filter((lead) => lead.clientId === clientId && lead.servicem8JobUuid)
      .map((lead) => lead.servicem8JobUuid!)

    for (const jobUuid of jobUuids) {
      if (!jobCompanyUuidByJob.has(jobUuid)) {
        jobCompanyUuidByJob.set(jobUuid, await fetchJobCompanyUuid(request, jobUuid))
      }
      const companyUuid = jobCompanyUuidByJob.get(jobUuid)
      if (companyUuid) return companyUuid
    }

    return null
  }

  return Promise.all(clientRows.map(async (client) => ({
    id: client.id,
    name: client.name,
    companyName: client.companyName,
    email: client.email,
    phoneNormalized: client.phoneNormalized,
    servicem8CompanyUuid: client.servicem8CompanyUuid,
    resolvedServiceM8CompanyUuid: client.servicem8CompanyUuid ?? await resolveFromJobs(client.id),
    createdAt: client.createdAt,
  })))
}

async function fetchJobCompanyUuid(request: ServiceM8FetchRequest, jobUuid: string): Promise<string | null> {
  const response = await request(`/job/${jobUuid}.json`)
  if (!response.ok) return null
  const payload = await response.json()
  if (!payload || typeof payload !== 'object') return null
  const companyUuid = (payload as { company_uuid?: unknown }).company_uuid
  return typeof companyUuid === 'string' && companyUuid.trim() ? companyUuid.trim() : null
}

export function formatMergePlan(plan: MergePlan, apply: boolean): string {
  const lines = [
    apply ? 'APPLY client merge cleanup' : 'DRY RUN client merge cleanup',
    `Auto-merge groups: ${plan.autoMergeGroups.length}`,
  ]

  for (const group of plan.autoMergeGroups) {
    lines.push(`- ${group.reason} ${group.key}: survivor=${group.survivorId} losers=${group.loserIds.join(', ')}`)
  }

  lines.push(`Review groups: ${plan.reviewGroups.length}`)
  for (const group of plan.reviewGroups) {
    lines.push(`- ${group.reason} ${group.key}: rows=${group.rows.map((row) => row.id).join(', ')}`)
  }

  return lines.join('\n')
}
