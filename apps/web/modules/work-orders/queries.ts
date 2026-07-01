import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clientContacts, clients, leads } from '@rgtools/db/schema-leads'
import {
  workOrderHardwareStatusOptions,
  workOrderEvents,
  workOrderInstallers,
  workOrders,
  workOrderStageOptions,
} from '@rgtools/db/schema-workorders'
import type { WorkOrderLevel } from './domain'
import type { WorkOrderListFilters, WorkOrderSort, WorkOrderSortDirection } from './list-filters'

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
  maintenanceProgram: boolean
  installDate: string | null
  dateCompleted: string | null
  riskLevel: WorkOrderLevel | null
  importance: WorkOrderLevel | null
  aiSuggestion: string | null
  aiSuggestionAt: Date | null
  clientContextSummary: string | null
  clientApproachNote: string | null
  updatedAt: Date
}

export type WorkOrderDetail = WorkOrderRow & {
  servicem8JobUuid: string | null
  servicem8Active: boolean
  clientId: string | null
  clientNotes: string | null
  leadId: string | null
  quoteId: string | null
  rawServiceM8Snapshot: unknown
  riskSource: 'manual' | 'ai' | null
  importanceSource: 'manual' | 'ai' | null
  contacts: Array<{
    id: string
    name: string | null
    phone: string | null
    email: string | null
    isJobContact: boolean
  }>
  timeline: Array<{
    id: string
    fieldName: string
    previousValue: unknown
    newValue: unknown
    note: string | null
    isClientVisibleCandidate: boolean
    portalTitle: string | null
    portalMessage: string | null
    createdAt: Date
  }>
}

const workOrderRowSelection = {
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
  maintenanceProgram: workOrders.maintenanceProgram,
  installDate: workOrders.installDate,
  dateCompleted: workOrders.dateCompleted,
  riskLevel: sql<WorkOrderLevel | null>`coalesce(${workOrders.riskLevelOverride}, ${workOrders.aiRiskLevel})`,
  importance: sql<WorkOrderLevel | null>`coalesce(${workOrders.importanceOverride}, ${workOrders.aiImportance})`,
  aiSuggestion: workOrders.aiSuggestion,
  aiSuggestionAt: workOrders.aiSuggestionAt,
  clientContextSummary: workOrders.clientContextSummary,
  clientApproachNote: workOrders.clientApproachNote,
  updatedAt: workOrders.updatedAt,
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
    .select(workOrderRowSelection)
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

export async function listWorkOrdersForExport(filters: WorkOrderListFilters) {
  return db
    .select(workOrderRowSelection)
    .from(workOrders)
    .leftJoin(workOrderInstallers, eq(workOrders.installerId, workOrderInstallers.id))
    .leftJoin(workOrderStageOptions, eq(workOrders.stageOptionId, workOrderStageOptions.id))
    .leftJoin(workOrderHardwareStatusOptions, eq(workOrders.hardwareStatusOptionId, workOrderHardwareStatusOptions.id))
    .where(listWhere(filters))
    .orderBy(...listOrderBy(filters.sort))
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

export async function getWorkOrderDetail(workOrderId: string): Promise<WorkOrderDetail | null> {
  const [row] = await db
    .select({
      id: workOrders.id,
      servicem8Status: workOrders.servicem8Status,
      servicem8Active: workOrders.servicem8Active,
      servicem8JobUuid: workOrders.servicem8JobUuid,
      isCurrent: workOrders.isCurrent,
      jobNumber: workOrders.jobNumber,
      jobAddress: workOrders.jobAddress,
      jobDescription: workOrders.jobDescription,
      clientName: workOrders.clientName,
      companyName: workOrders.companyName,
      clientId: workOrders.clientId,
      clientNotes: clients.notes,
      leadId: workOrders.leadId,
      quoteId: workOrders.quoteId,
      leadScore: workOrders.leadScore,
      installerName: workOrderInstallers.displayName,
      stageName: workOrderStageOptions.displayName,
      hardwareStatusName: workOrderHardwareStatusOptions.displayName,
      maintenanceProgram: workOrders.maintenanceProgram,
      installDate: workOrders.installDate,
      dateCompleted: workOrders.dateCompleted,
      riskLevel: sql<WorkOrderLevel | null>`coalesce(${workOrders.riskLevelOverride}, ${workOrders.aiRiskLevel})`,
      importance: sql<WorkOrderLevel | null>`coalesce(${workOrders.importanceOverride}, ${workOrders.aiImportance})`,
      riskSource: sql<'manual' | 'ai' | null>`case when ${workOrders.riskLevelOverride} is not null then 'manual' when ${workOrders.aiRiskLevel} is not null then 'ai' else null end`,
      importanceSource: sql<'manual' | 'ai' | null>`case when ${workOrders.importanceOverride} is not null then 'manual' when ${workOrders.aiImportance} is not null then 'ai' else null end`,
      aiSuggestion: workOrders.aiSuggestion,
      aiSuggestionAt: workOrders.aiSuggestionAt,
      clientContextSummary: workOrders.clientContextSummary,
      clientApproachNote: workOrders.clientApproachNote,
      rawServiceM8Snapshot: workOrders.rawServiceM8Snapshot,
      updatedAt: workOrders.updatedAt,
    })
    .from(workOrders)
    .leftJoin(clients, eq(workOrders.clientId, clients.id))
    .leftJoin(workOrderInstallers, eq(workOrders.installerId, workOrderInstallers.id))
    .leftJoin(workOrderStageOptions, eq(workOrders.stageOptionId, workOrderStageOptions.id))
    .leftJoin(workOrderHardwareStatusOptions, eq(workOrders.hardwareStatusOptionId, workOrderHardwareStatusOptions.id))
    .where(eq(workOrders.id, workOrderId))
    .limit(1)

  if (!row) return null

  const [contacts, timeline] = await Promise.all([
    row.clientId
      ? db
        .select({
          id: clientContacts.id,
          name: clientContacts.name,
          phone: clientContacts.phone,
          email: clientContacts.email,
          isJobContact: sql<boolean>`${clientContacts.id} = ${leads.contactId}`,
        })
        .from(clientContacts)
        .leftJoin(leads, eq(leads.id, row.leadId ?? ''))
        .where(eq(clientContacts.clientId, row.clientId))
        .orderBy(asc(clientContacts.name), asc(clientContacts.email))
      : Promise.resolve([]),
    db
      .select({
        id: workOrderEvents.id,
        fieldName: workOrderEvents.fieldName,
        previousValue: workOrderEvents.previousValue,
        newValue: workOrderEvents.newValue,
        note: workOrderEvents.note,
        isClientVisibleCandidate: workOrderEvents.isClientVisibleCandidate,
        portalTitle: workOrderEvents.portalTitle,
        portalMessage: workOrderEvents.portalMessage,
        createdAt: workOrderEvents.createdAt,
      })
      .from(workOrderEvents)
      .where(eq(workOrderEvents.workOrderId, workOrderId))
      .orderBy(desc(workOrderEvents.createdAt)),
  ])

  return { ...row, contacts, timeline }
}

function listWhere(filters: WorkOrderListFilters) {
  const conditions = []

  if (filters.current === 'current') conditions.push(eq(workOrders.isCurrent, true))
  if (filters.current === 'non_current') conditions.push(eq(workOrders.isCurrent, false))
  if (filters.stage !== 'all') conditions.push(eq(workOrders.stageOptionId, filters.stage))
  if (filters.hardware !== 'all') conditions.push(eq(workOrders.hardwareStatusOptionId, filters.hardware))
  if (filters.maintenanceProgram !== 'all') {
    conditions.push(eq(workOrders.maintenanceProgram, filters.maintenanceProgram === 'yes'))
  }
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
  if (sort === 'lead_score_desc') {
    return [
      sql`${workOrders.leadScore} desc nulls last`,
      desc(levelRank(workOrders.importanceOverride, workOrders.aiImportance)),
      desc(levelRank(workOrders.riskLevelOverride, workOrders.aiRiskLevel)),
      sql`${workOrders.installDate} asc nulls last`,
      asc(workOrders.updatedAt),
    ]
  }
  if (sort === 'lead_score_asc') {
    return [
      sql`${workOrders.leadScore} asc nulls last`,
      asc(workOrders.clientName),
      asc(workOrders.updatedAt),
    ]
  }

  const [key, direction] = splitSort(sort)

  if (key === 'importance') return [sortLevel(levelRank(workOrders.importanceOverride, workOrders.aiImportance), direction), desc(workOrders.leadScore)]
  if (key === 'risk') return [sortLevel(levelRank(workOrders.riskLevelOverride, workOrders.aiRiskLevel), direction), desc(workOrders.leadScore)]
  if (key === 'install_date') return [sortNullable(workOrders.installDate, direction), desc(workOrders.leadScore)]
  if (key === 'date_completed') return [sortNullable(workOrders.dateCompleted, direction), desc(workOrders.leadScore)]
  if (key === 'client') return [sortText(workOrders.clientName, direction), desc(workOrders.leadScore)]
  if (key === 'job_number') return [sortText(workOrders.jobNumber, direction), desc(workOrders.leadScore)]
  if (key === 'job_address') return [sortText(workOrders.jobAddress, direction), desc(workOrders.leadScore)]
  if (key === 'job_description') return [sortText(workOrders.jobDescription, direction), desc(workOrders.leadScore)]
  if (key === 'installer') return [sortText(workOrderInstallers.displayName, direction), desc(workOrders.leadScore)]
  if (key === 'stage') return [sortText(workOrderStageOptions.displayName, direction), desc(workOrders.leadScore)]
  if (key === 'hardware') return [sortText(workOrderHardwareStatusOptions.displayName, direction), desc(workOrders.leadScore)]
  if (key === 'maintenance_program') return [sortNullable(workOrders.maintenanceProgram, direction), desc(workOrders.leadScore)]
  if (key === 'servicem8_status') return [sortText(workOrders.servicem8Status, direction), desc(workOrders.leadScore)]

  return [
    sql`${workOrders.leadScore} desc nulls last`,
    desc(levelRank(workOrders.importanceOverride, workOrders.aiImportance)),
    desc(levelRank(workOrders.riskLevelOverride, workOrders.aiRiskLevel)),
    sql`${workOrders.installDate} asc nulls last`,
    asc(workOrders.updatedAt),
  ]
}

function splitSort(sort: WorkOrderSort): [string, WorkOrderSortDirection] {
  const direction = sort.endsWith('_asc') ? 'asc' : 'desc'
  return [sort.slice(0, -`_${direction}`.length), direction]
}

function sortNullable(column: unknown, direction: WorkOrderSortDirection) {
  return direction === 'asc' ? sql`${column} asc nulls last` : sql`${column} desc nulls last`
}

function sortText(column: unknown, direction: WorkOrderSortDirection) {
  return direction === 'asc' ? sql`lower(${column}) asc nulls last` : sql`lower(${column}) desc nulls last`
}

function sortLevel(column: unknown, direction: WorkOrderSortDirection) {
  return direction === 'asc' ? sql`${column} asc` : sql`${column} desc`
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
