'use server'

import { eq, notInArray, or, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createServiceM8RequestFromEnv, type ServiceM8FetchRequest } from '@/lib/servicem8/client'
import { quotes, settings } from '@rgtools/db/schema'
import {
  workOrderHardwareStatusOptions,
  workOrderInstallers,
  workOrderEvents,
  workOrderRefreshRuns,
  workOrders,
  workOrderStageOptions,
} from '@rgtools/db/schema-workorders'
import { normalizeConfigName, WORK_ORDER_AI_SUGGESTION_COOLDOWN_MS, type WorkOrderLevel } from './domain'
import {
  assertCurrentUserCanConfigureWorkOrders,
  assertCurrentUserCanManageWorkOrders,
} from './permissions'
import { findLinkedLeadAndClient } from './queries'
import { mapServiceM8JobsToWorkOrderInputs, type ServiceM8WorkOrderJob } from './servicem8-sync'
import { serializeSummaryConfig, WORK_ORDER_SUMMARY_FIELD_CATALOG, WORK_ORDER_SUMMARY_CONFIG_KEY } from './summary-config'

type ServiceM8Company = {
  uuid?: string | null
  name?: string | null
  active?: number | string | boolean | null
}

const WORK_ORDER_FILTER = "active eq 1 and status eq 'Work Order'"

export async function refreshWorkOrdersAction() {
  await assertCurrentUserCanManageWorkOrders()

  try {
    await refreshWorkOrdersFromServiceM8()
  } catch (error) {
    redirect(`/work-orders?refreshError=${encodeURIComponent(errorMessage(error))}`)
  }

  revalidatePath('/work-orders')
}

export async function refreshWorkOrdersFromServiceM8(
  request: ServiceM8FetchRequest = createServiceM8RequestFromEnv(),
) {
  let jobRows: ServiceM8WorkOrderJob[]
  let companyRows: ServiceM8Company[]

  try {
    [jobRows, companyRows] = await Promise.all([
      readServiceM8Array<ServiceM8WorkOrderJob>(request, `/job.json${odataFilter(WORK_ORDER_FILTER)}`),
      readServiceM8Array<ServiceM8Company>(request, '/company.json'),
    ])
  } catch (error) {
    await recordRefreshFailure(error)
    throw error
  }

  const companiesByUuid = new Map(
    companyRows
      .filter((company) => company.uuid)
      .map((company) => [company.uuid as string, company]),
  )

  const inputs = mapServiceM8JobsToWorkOrderInputs(jobRows)
  const now = new Date()
  const seenIdentityKeys = inputs.map((input) => `${input.identityKind}:${input.identityValue}`)

  await db.transaction(async (tx) => {
    for (const input of inputs) {
      const [linked, quote] = await Promise.all([
        findLinkedLeadAndClient({
          servicem8JobUuid: input.servicem8JobUuid,
          jobNumber: input.jobNumber,
        }),
        findLinkedQuote({
          servicem8JobUuid: input.servicem8JobUuid,
          jobNumber: input.jobNumber,
        }),
      ])

      const company = input.servicem8CompanyUuid ? companiesByUuid.get(input.servicem8CompanyUuid) : null
      const clientName = linked?.clientName ?? quote?.clientName ?? company?.name?.trim() ?? input.jobNumber ?? 'Unknown client'

      await tx
        .insert(workOrders)
        .values({
          identityKind: input.identityKind,
          identityValue: input.identityValue,
          servicem8CompanyUuid: input.servicem8CompanyUuid,
          servicem8JobUuid: input.servicem8JobUuid,
          servicem8Status: input.servicem8Status,
          servicem8Active: input.servicem8Active,
          isCurrent: true,
          jobNumber: input.jobNumber,
          jobAddress: input.jobAddress,
          jobDescription: input.jobDescription,
          approximateDescription: input.approximateDescription,
          systemName: input.systemName,
          length: input.length,
          color: input.color,
          itemsServices: input.itemsServices,
          glassStatus: input.glassStatus,
          designStatus: input.designStatus,
          siteCondition: input.siteCondition,
          remarks: input.remarks,
          rawServiceM8Snapshot: input.rawServiceM8Snapshot,
          clientId: linked?.clientId ?? quote?.clientId ?? null,
          leadId: linked?.leadId ?? null,
          quoteId: quote?.id ?? null,
          clientName,
          companyName: linked?.companyName ?? quote?.companyName ?? null,
          leadScore: linked?.leadScore ?? null,
          lastServiceM8SyncedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [workOrders.identityKind, workOrders.identityValue],
          set: {
            servicem8CompanyUuid: input.servicem8CompanyUuid,
            servicem8JobUuid: input.servicem8JobUuid,
            servicem8Status: input.servicem8Status,
            servicem8Active: input.servicem8Active,
            isCurrent: true,
            jobNumber: input.jobNumber,
            jobAddress: input.jobAddress,
            jobDescription: input.jobDescription,
            approximateDescription: input.approximateDescription,
            systemName: input.systemName,
            length: input.length,
            color: input.color,
            itemsServices: input.itemsServices,
            glassStatus: input.glassStatus,
            designStatus: input.designStatus,
            siteCondition: input.siteCondition,
            remarks: input.remarks,
            rawServiceM8Snapshot: input.rawServiceM8Snapshot,
            clientId: linked?.clientId ?? quote?.clientId ?? null,
            leadId: linked?.leadId ?? null,
            quoteId: quote?.id ?? null,
            clientName,
            companyName: linked?.companyName ?? quote?.companyName ?? null,
            leadScore: linked?.leadScore ?? null,
            lastServiceM8SyncedAt: now,
            updatedAt: now,
          },
        })
    }

    await tx
      .update(workOrders)
      .set({
        servicem8Active: false,
        isCurrent: false,
        updatedAt: now,
      })
      .where(
        seenIdentityKeys.length > 0
          ? notInArray(sql<string>`${workOrders.identityKind} || ':' || ${workOrders.identityValue}`, seenIdentityKeys)
          : undefined,
      )

    await tx.insert(workOrderRefreshRuns).values({
      status: 'success',
      syncedCount: inputs.length,
    })
  })

  return { synced: inputs.length }
}

export async function createWorkOrderInstallerAction(formData: FormData) {
  await createConfigOption({
    formData,
    table: workOrderInstallers,
    label: 'installer',
  })
}

export async function createWorkOrderStageAction(formData: FormData) {
  await createConfigOption({
    formData,
    table: workOrderStageOptions,
    label: 'stage',
  })
}

export async function createWorkOrderHardwareStatusAction(formData: FormData) {
  await createConfigOption({
    formData,
    table: workOrderHardwareStatusOptions,
    label: 'hardware status',
  })
}

export async function deactivateWorkOrderInstallerAction(optionId: string) {
  await deactivateConfigOption(optionId, workOrderInstallers)
}

export async function deactivateWorkOrderStageAction(optionId: string) {
  await deactivateConfigOption(optionId, workOrderStageOptions)
}

export async function deactivateWorkOrderHardwareStatusAction(optionId: string) {
  await deactivateConfigOption(optionId, workOrderHardwareStatusOptions)
}

export async function saveWorkOrderSummaryConfigAction(formData: FormData) {
  await assertCurrentUserCanConfigureWorkOrders()
  const session = await auth()

  const fields = WORK_ORDER_SUMMARY_FIELD_CATALOG.map((field) => ({
    ...field,
    visible: formData.get(`visible:${field.id}`) === 'on',
    filterable: formData.get(`filterable:${field.id}`) === 'on',
    order: Number(formData.get(`order:${field.id}`) ?? field.order) || field.order,
  })).sort((a, b) => a.order - b.order)

  await db
    .insert(settings)
    .values({
      key: WORK_ORDER_SUMMARY_CONFIG_KEY,
      value: serializeSummaryConfig(fields),
      updatedBy: session?.user?.id ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: serializeSummaryConfig(fields),
        updatedBy: session?.user?.id ?? null,
        updatedAt: new Date(),
      },
    })

  revalidatePath('/admin/work-orders')
  revalidatePath('/work-orders')
}

export async function updateWorkOrderOperationalFieldsAction(workOrderId: string, formData: FormData) {
  await assertCurrentUserCanManageWorkOrders()
  const session = await auth()

  const [current] = await db
    .select({
      installerId: workOrders.installerId,
      stageOptionId: workOrders.stageOptionId,
      hardwareStatusOptionId: workOrders.hardwareStatusOptionId,
      maintenanceProgram: workOrders.maintenanceProgram,
      installDate: workOrders.installDate,
      dateCompleted: workOrders.dateCompleted,
      riskLevelOverride: workOrders.riskLevelOverride,
      importanceOverride: workOrders.importanceOverride,
    })
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId))
    .limit(1)

  if (!current) throw new Error('Work Order not found.')

  const now = new Date()
  const next = {
    installerId: nullableString(formData.get('installerId')),
    stageOptionId: nullableString(formData.get('stageOptionId')),
    hardwareStatusOptionId: nullableString(formData.get('hardwareStatusOptionId')),
    maintenanceProgram: maintenanceProgramValue(formData.get('maintenanceProgram')),
    installDate: nullableString(formData.get('installDate')),
    dateCompleted: nullableString(formData.get('dateCompleted')),
    riskLevelOverride: workOrderLevelValue(formData.get('riskLevel')),
    importanceOverride: workOrderLevelValue(formData.get('importance')),
  }

  await db
    .update(workOrders)
    .set({
      ...next,
      updatedAt: now,
    })
    .where(eq(workOrders.id, workOrderId))

  const events = operationalEvents({
    workOrderId,
    actorId: session?.user?.id ?? null,
    previous: current,
    next,
  })
  if (events.length > 0) {
    await db.insert(workOrderEvents).values(events)
  }

  revalidatePath('/work-orders')
  revalidatePath(`/work-orders/${workOrderId}`)
}

export async function markWorkOrderEventClientVisibleCandidateAction(eventId: string, formData: FormData) {
  await assertCurrentUserCanManageWorkOrders()

  const portalTitle = nullableString(formData.get('portalTitle'))
  const portalMessage = nullableString(formData.get('portalMessage'))
  if (!portalTitle || !portalMessage) {
    throw new Error('Client-visible timeline updates need a customer-safe title and message.')
  }

  const session = await auth()
  await db
    .update(workOrderEvents)
    .set({
      isClientVisibleCandidate: true,
      portalTitle,
      portalMessage,
      portalMarkedBy: session?.user?.id ?? null,
      portalMarkedAt: new Date(),
    })
    .where(eq(workOrderEvents.id, eventId))

  revalidatePath('/work-orders')
}

export async function addWorkOrderTimelineNoteAction(workOrderId: string, formData: FormData) {
  await assertCurrentUserCanManageWorkOrders()
  const note = nullableString(formData.get('note'))
  if (!note) throw new Error('Timeline note is required.')

  const session = await auth()
  await db.insert(workOrderEvents).values({
    workOrderId,
    actorId: session?.user?.id ?? null,
    fieldName: 'timeline_note_added',
    previousValue: null,
    newValue: note,
    note,
    isClientVisibleCandidate: false,
  })

  revalidatePath('/work-orders')
  revalidatePath(`/work-orders/${workOrderId}`)
}

export async function generateWorkOrderAiSuggestionAction(workOrderId: string) {
  await assertCurrentUserCanManageWorkOrders()

  const [detail] = await db
    .select({
      clientName: workOrders.clientName,
      jobNumber: workOrders.jobNumber,
      stageName: workOrderStageOptions.displayName,
      hardwareStatusName: workOrderHardwareStatusOptions.displayName,
      riskLevel: sql<WorkOrderLevel | null>`coalesce(${workOrders.riskLevelOverride}, ${workOrders.aiRiskLevel})`,
      importance: sql<WorkOrderLevel | null>`coalesce(${workOrders.importanceOverride}, ${workOrders.aiImportance})`,
      clientContextSummary: workOrders.clientContextSummary,
      aiSuggestionAt: workOrders.aiSuggestionAt,
    })
    .from(workOrders)
    .leftJoin(workOrderStageOptions, eq(workOrders.stageOptionId, workOrderStageOptions.id))
    .leftJoin(workOrderHardwareStatusOptions, eq(workOrders.hardwareStatusOptionId, workOrderHardwareStatusOptions.id))
    .where(eq(workOrders.id, workOrderId))
    .limit(1)

  if (!detail) throw new Error('Work Order not found.')
  const now = new Date()
  const cooldownUntil = detail.aiSuggestionAt
    ? new Date(detail.aiSuggestionAt.getTime() + WORK_ORDER_AI_SUGGESTION_COOLDOWN_MS)
    : null

  if (cooldownUntil && cooldownUntil > now) {
    return redirect(`/work-orders/${workOrderId}?aiRefreshCooldownUntil=${encodeURIComponent(cooldownUntil.toISOString())}`)
  }

  await db
    .update(workOrders)
    .set({
      aiSuggestion: buildWorkOrderAiSuggestion(detail),
      aiSuggestionAt: now,
      updatedAt: now,
    })
    .where(eq(workOrders.id, workOrderId))

  revalidatePath(`/work-orders/${workOrderId}`)
}

async function createConfigOption({
  formData,
  table,
  label,
}: {
  formData: FormData
  table: typeof workOrderInstallers | typeof workOrderStageOptions | typeof workOrderHardwareStatusOptions
  label: string
}) {
  await assertCurrentUserCanConfigureWorkOrders()
  const session = await auth()

  const displayName = String(formData.get('displayName') ?? '').trim()
  if (!displayName) throw new Error(`Missing ${label} name`)

  const now = new Date()
  await db
    .insert(table)
    .values({
      displayName,
      normalizedName: normalizeConfigName(displayName),
      isActive: true,
      createdBy: session?.user?.id ?? null,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: table.normalizedName,
    })

  revalidatePath('/admin/work-orders')
  revalidatePath('/work-orders')
}

async function deactivateConfigOption(
  optionId: string,
  table: typeof workOrderInstallers | typeof workOrderStageOptions | typeof workOrderHardwareStatusOptions,
) {
  await assertCurrentUserCanConfigureWorkOrders()
  const now = new Date()

  await db
    .update(table)
    .set({
      isActive: false,
      archivedAt: now,
      updatedAt: now,
    })
    .where(eq(table.id, optionId))

  revalidatePath('/admin/work-orders')
  revalidatePath('/work-orders')
}

function operationalEvents({
  workOrderId,
  actorId,
  previous,
  next,
}: {
  workOrderId: string
  actorId: string | null
  previous: {
    installerId: string | null
    stageOptionId: string | null
    hardwareStatusOptionId: string | null
    maintenanceProgram: boolean
    installDate: string | null
    dateCompleted: string | null
    riskLevelOverride: string | null
    importanceOverride: string | null
  }
  next: {
    installerId: string | null
    stageOptionId: string | null
    hardwareStatusOptionId: string | null
    maintenanceProgram: boolean
    installDate: string | null
    dateCompleted: string | null
    riskLevelOverride: string | null
    importanceOverride: string | null
  }
}) {
  return [
    eventFor('installer_changed', previous.installerId, next.installerId),
    eventFor('stage_changed', previous.stageOptionId, next.stageOptionId),
    eventFor('hardware_status_changed', previous.hardwareStatusOptionId, next.hardwareStatusOptionId),
    eventFor('maintenance_program_changed', previous.maintenanceProgram, next.maintenanceProgram),
    eventFor('install_date_changed', previous.installDate, next.installDate),
    eventFor('date_completed_changed', previous.dateCompleted, next.dateCompleted),
    eventFor('risk_changed', previous.riskLevelOverride, next.riskLevelOverride),
    eventFor('importance_changed', previous.importanceOverride, next.importanceOverride),
  ].filter((event): event is NonNullable<typeof event> => Boolean(event))

  function eventFor(fieldName: string, previousValue: string | boolean | null, newValue: string | boolean | null) {
    if (previousValue === newValue) return null
    return {
      workOrderId,
      actorId,
      fieldName,
      previousValue,
      newValue,
      isClientVisibleCandidate: false,
    }
  }
}

function nullableString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

function workOrderLevelValue(value: FormDataEntryValue | null): WorkOrderLevel | null {
  const normalized = nullableString(value)
  return normalized === 'low' || normalized === 'medium' || normalized === 'high'
    ? normalized
    : null
}

function maintenanceProgramValue(value: FormDataEntryValue | null): boolean {
  return nullableString(value) === 'yes'
}

function buildWorkOrderAiSuggestion(input: {
  clientName: string
  jobNumber: string | null
  stageName: string | null
  hardwareStatusName: string | null
  riskLevel: WorkOrderLevel | null
  importance: WorkOrderLevel | null
  clientContextSummary: string | null
}) {
  const attention = [
    input.riskLevel ? `${input.riskLevel} risk` : null,
    input.importance ? `${input.importance} importance` : null,
    input.stageName ? `stage: ${input.stageName}` : null,
    input.hardwareStatusName ? `hardware: ${input.hardwareStatusName}` : null,
  ].filter(Boolean).join(', ')

  const context = input.clientContextSummary?.trim()
  return [
    `Next action for ${input.clientName}${input.jobNumber ? ` (${input.jobNumber})` : ''}: review the current work order state and confirm the next delivery step with the responsible staff member.`,
    attention ? `Attention signals: ${attention}.` : null,
    context ? `Context: ${context}` : null,
  ].filter(Boolean).join('\n')
}

async function findLinkedQuote(input: {
  servicem8JobUuid: string | null
  jobNumber: string | null
}) {
  const conditions = []
  if (input.servicem8JobUuid) conditions.push(eq(quotes.servicem8Uuid, input.servicem8JobUuid))
  if (input.jobNumber) conditions.push(eq(quotes.workOrderId, input.jobNumber))
  if (conditions.length === 0) return null

  const [quote] = await db
    .select({
      id: quotes.id,
      clientId: quotes.clientId,
      clientName: quotes.clientName,
      companyName: quotes.companyName,
    })
    .from(quotes)
    .where(conditions.length === 1 ? conditions[0] : or(...conditions))
    .limit(1)

  return quote ?? null
}

async function recordRefreshFailure(error: unknown) {
  await db.insert(workOrderRefreshRuns).values({
    status: 'failed',
    errorMessage: errorMessage(error),
  })
}

async function readServiceM8Array<T>(request: ServiceM8FetchRequest, path: string): Promise<T[]> {
  const res = await request(path)
  if (!res.ok) throw new Error(`ServiceM8 request failed with HTTP ${res.status}`)
  const rows = await res.json()
  return Array.isArray(rows) ? rows as T[] : []
}

function odataFilter(expr: string): string {
  return `?%24filter=${encodeURIComponent(expr)}`
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'ServiceM8 refresh failed'
}
