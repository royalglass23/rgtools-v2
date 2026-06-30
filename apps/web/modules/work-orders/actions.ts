'use server'

import { eq, notInArray, or, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createServiceM8RequestFromEnv, type ServiceM8FetchRequest } from '@/lib/servicem8/client'
import { quotes } from '@rgtools/db/schema'
import {
  workOrderHardwareStatusOptions,
  workOrderInstallers,
  workOrderRefreshRuns,
  workOrders,
  workOrderStageOptions,
} from '@rgtools/db/schema-workorders'
import { normalizeConfigName } from './domain'
import {
  assertCurrentUserCanConfigureWorkOrders,
  assertCurrentUserCanManageWorkOrders,
} from './permissions'
import { findLinkedLeadAndClient } from './queries'
import { mapServiceM8JobsToWorkOrderInputs, type ServiceM8WorkOrderJob } from './servicem8-sync'

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

export async function updateWorkOrderOperationalFieldsAction(workOrderId: string, formData: FormData) {
  await assertCurrentUserCanManageWorkOrders()

  const now = new Date()
  await db
    .update(workOrders)
    .set({
      installerId: nullableString(formData.get('installerId')),
      stageOptionId: nullableString(formData.get('stageOptionId')),
      hardwareStatusOptionId: nullableString(formData.get('hardwareStatusOptionId')),
      installDate: nullableString(formData.get('installDate')),
      dateCompleted: nullableString(formData.get('dateCompleted')),
      riskLevelOverride: workOrderLevelValue(formData.get('riskLevel')),
      importanceOverride: workOrderLevelValue(formData.get('importance')),
      clientApproachNote: nullableString(formData.get('notes')),
      updatedAt: now,
    })
    .where(eq(workOrders.id, workOrderId))

  revalidatePath('/work-orders')
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
    .onConflictDoUpdate({
      target: table.normalizedName,
      set: {
        displayName,
        isActive: true,
        archivedAt: null,
        updatedAt: now,
      },
    })

  revalidatePath('/admin/work-orders')
}

function nullableString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

function workOrderLevelValue(value: FormDataEntryValue | null) {
  const normalized = nullableString(value)
  return normalized === 'low' || normalized === 'medium' || normalized === 'high'
    ? normalized
    : null
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
