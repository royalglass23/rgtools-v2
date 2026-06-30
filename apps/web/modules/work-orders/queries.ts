import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clients, leads } from '@rgtools/db/schema-leads'
import {
  workOrderHardwareStatusOptions,
  workOrderInstallers,
  workOrders,
  workOrderStageOptions,
} from '@rgtools/db/schema-workorders'
import type { WorkOrderLevel } from './domain'
import type { WorkOrderListFilters, WorkOrderSort } from './list-filters'

export type WorkOrderRow = {
  id: string
  servicem8Status: string
  isCurrent: boolean
  jobNumber: string | null
  jobAddress: string | null
  jobDescription: string | null
  clientName: string
  companyName: string | null
  leadScore: number | null
  installerName: string | null
  stageName: string | null
  hardwareStatusName: string | null
  installDate: string | null
  dateCompleted: string | null
  riskLevel: WorkOrderLevel | null
  importance: WorkOrderLevel | null
  aiSuggestion: string | null
  clientContextSummary: string | null
  clientApproachNote: string | null
  updatedAt: Date
}

export async function listWorkOrders(filters: WorkOrderListFilters) {
  const where = listWhere(filters)
  const offset = (filters.page - 1) * filters.size

  const [totalRow] = await db
    .select({ total: count() })
    .from(workOrders)
    .leftJoin(workOrderInstallers, eq(workOrders.installerId, workOrderInstallers.id))
    .leftJoin(workOrderStageOptions, eq(workOrders.stageOptionId, workOrderStageOptions.id))
    .leftJoin(workOrderHardwareStatusOptions, eq(workOrders.hardwareStatusOptionId, workOrderHardwareStatusOptions.id))
    .where(where)

  const rows = await db
    .select({
      id: workOrders.id,
      servicem8Status: workOrders.servicem8Status,
      isCurrent: workOrders.isCurrent,
      jobNumber: workOrders.jobNumber,
      jobAddress: workOrders.jobAddress,
      jobDescription: workOrders.jobDescription,
      clientName: workOrders.clientName,
      companyName: workOrders.companyName,
      leadScore: workOrders.leadScore,
      installerName: workOrderInstallers.displayName,
      stageName: workOrderStageOptions.displayName,
      hardwareStatusName: workOrderHardwareStatusOptions.displayName,
      installDate: workOrders.installDate,
      dateCompleted: workOrders.dateCompleted,
      riskLevel: sql<WorkOrderLevel | null>`coalesce(${workOrders.riskLevelOverride}, ${workOrders.aiRiskLevel})`,
      importance: sql<WorkOrderLevel | null>`coalesce(${workOrders.importanceOverride}, ${workOrders.aiImportance})`,
      aiSuggestion: workOrders.aiSuggestion,
      clientContextSummary: workOrders.clientContextSummary,
      clientApproachNote: workOrders.clientApproachNote,
      updatedAt: workOrders.updatedAt,
    })
    .from(workOrders)
    .leftJoin(workOrderInstallers, eq(workOrders.installerId, workOrderInstallers.id))
    .leftJoin(workOrderStageOptions, eq(workOrders.stageOptionId, workOrderStageOptions.id))
    .leftJoin(workOrderHardwareStatusOptions, eq(workOrders.hardwareStatusOptionId, workOrderHardwareStatusOptions.id))
    .where(where)
    .orderBy(...listOrderBy(filters.sort))
    .limit(filters.size)
    .offset(offset)

  const total = totalRow?.total ?? 0
  return {
    rows,
    total,
    pageCount: Math.max(1, Math.ceil(total / filters.size)),
  }
}

export async function getWorkOrderFilterOptions() {
  const [installers, stages, hardwareStatuses, statuses] = await Promise.all([
    db
      .select({ id: workOrderInstallers.id, label: workOrderInstallers.displayName })
      .from(workOrderInstallers)
      .where(eq(workOrderInstallers.isActive, true))
      .orderBy(asc(workOrderInstallers.displayName)),
    db
      .select({ id: workOrderStageOptions.id, label: workOrderStageOptions.displayName })
      .from(workOrderStageOptions)
      .where(eq(workOrderStageOptions.isActive, true))
      .orderBy(asc(workOrderStageOptions.sortOrder), asc(workOrderStageOptions.displayName)),
    db
      .select({ id: workOrderHardwareStatusOptions.id, label: workOrderHardwareStatusOptions.displayName })
      .from(workOrderHardwareStatusOptions)
      .where(eq(workOrderHardwareStatusOptions.isActive, true))
      .orderBy(asc(workOrderHardwareStatusOptions.sortOrder), asc(workOrderHardwareStatusOptions.displayName)),
    db
      .select({ status: workOrders.servicem8Status })
      .from(workOrders)
      .groupBy(workOrders.servicem8Status)
      .orderBy(asc(workOrders.servicem8Status)),
  ])

  return {
    installers,
    stages,
    hardwareStatuses,
    statuses: statuses.map((row: { status: string }) => row.status),
  }
}

export async function getWorkOrderConfigLists() {
  const [installers, stages, hardwareStatuses] = await Promise.all([
    db.select().from(workOrderInstallers).orderBy(asc(workOrderInstallers.displayName)),
    db.select().from(workOrderStageOptions).orderBy(asc(workOrderStageOptions.sortOrder), asc(workOrderStageOptions.displayName)),
    db.select().from(workOrderHardwareStatusOptions).orderBy(asc(workOrderHardwareStatusOptions.sortOrder), asc(workOrderHardwareStatusOptions.displayName)),
  ])

  return { installers, stages, hardwareStatuses }
}

function listWhere(filters: WorkOrderListFilters) {
  const conditions = []

  if (filters.current === 'current') conditions.push(eq(workOrders.isCurrent, true))
  if (filters.current === 'non_current') conditions.push(eq(workOrders.isCurrent, false))
  if (filters.stage !== 'all') conditions.push(eq(workOrders.stageOptionId, filters.stage))
  if (filters.hardware !== 'all') conditions.push(eq(workOrders.hardwareStatusOptionId, filters.hardware))
  if (filters.risk !== 'all') {
    conditions.push(eq(sql`coalesce(${workOrders.riskLevelOverride}, ${workOrders.aiRiskLevel})`, filters.risk))
  }
  if (filters.importance !== 'all') {
    conditions.push(eq(sql`coalesce(${workOrders.importanceOverride}, ${workOrders.aiImportance})`, filters.importance))
  }
  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`
    conditions.push(or(
      ilike(workOrders.clientName, pattern),
      ilike(workOrders.companyName, pattern),
      ilike(workOrders.jobNumber, pattern),
      ilike(workOrders.jobAddress, pattern),
      ilike(workOrders.jobDescription, pattern),
    ))
  }

  return conditions.length > 0 ? and(...conditions) : undefined
}

function listOrderBy(sort: WorkOrderSort) {
  if (sort === 'importance') return [desc(levelRank(workOrders.importanceOverride, workOrders.aiImportance)), desc(workOrders.leadScore)]
  if (sort === 'risk') return [desc(levelRank(workOrders.riskLevelOverride, workOrders.aiRiskLevel)), desc(workOrders.leadScore)]
  if (sort === 'install_date') return [sql`${workOrders.installDate} asc nulls last`, desc(workOrders.leadScore)]
  if (sort === 'client_asc') return [asc(workOrders.clientName), desc(workOrders.leadScore)]
  if (sort === 'job_number') return [asc(workOrders.jobNumber), desc(workOrders.leadScore)]

  return [
    sql`${workOrders.leadScore} desc nulls last`,
    desc(levelRank(workOrders.importanceOverride, workOrders.aiImportance)),
    desc(levelRank(workOrders.riskLevelOverride, workOrders.aiRiskLevel)),
    sql`${workOrders.installDate} asc nulls last`,
    asc(workOrders.updatedAt),
  ]
}

function levelRank(overrideColumn: unknown, aiColumn: unknown) {
  return sql<number>`case coalesce(${overrideColumn}, ${aiColumn})
    when 'high' then 3
    when 'medium' then 2
    when 'low' then 1
    else 0
  end`
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

export async function findLinkedLeadAndClient(input: {
  servicem8JobUuid: string | null
  jobNumber: string | null
}) {
  const conditions = []
  if (input.servicem8JobUuid) conditions.push(eq(leads.servicem8JobUuid, input.servicem8JobUuid))
  if (input.jobNumber) conditions.push(eq(leads.servicem8JobNumber, input.jobNumber))
  if (conditions.length === 0) return null

  const [row] = await db
    .select({
      leadId: leads.id,
      clientId: clients.id,
      clientName: clients.name,
      companyName: clients.companyName,
      leadScore: leads.seedScore,
    })
    .from(leads)
    .innerJoin(clients, eq(leads.clientId, clients.id))
    .where(conditions.length === 1 ? conditions[0] : or(...conditions))
    .limit(1)

  return row ?? null
}
