'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createServiceM8RequestFromEnv, type ServiceM8FetchRequest } from '@/lib/servicem8/client'
import { quotes } from '@rgtools/db/schema'
import {
  workOrderHardwareStatusOptions,
  workOrderInstallers,
  workOrders,
  workOrderStageOptions,
} from '@rgtools/db/schema-workorders'
import { normalizeConfigName } from './domain'
import { findLinkedLeadAndClient } from './queries'
import { mapServiceM8JobsToWorkOrderInputs, type ServiceM8WorkOrderJob } from './servicem8-sync'

type ServiceM8Company = {
  uuid?: string | null
  name?: string | null
  active?: number | string | boolean | null
}

const WORK_ORDER_FILTER = "active eq 1 and status eq 'Work Order'"

export async function refreshWorkOrdersAction() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Forbidden')

  await refreshWorkOrdersFromServiceM8()
  revalidatePath('/work-orders')
}

export async function refreshWorkOrdersFromServiceM8(
  request: ServiceM8FetchRequest = createServiceM8RequestFromEnv(),
) {
  const [jobRows, companyRows] = await Promise.all([
    readServiceM8Array<ServiceM8WorkOrderJob>(request, `/job.json${odataFilter(WORK_ORDER_FILTER)}`),
    readServiceM8Array<ServiceM8Company>(request, '/company.json'),
  ])
  const companiesByUuid = new Map(
    companyRows
      .filter((company) => company.uuid)
      .map((company) => [company.uuid as string, company]),
  )

  const inputs = mapServiceM8JobsToWorkOrderInputs(jobRows)
  const now = new Date()

  for (const input of inputs) {
    const [linked, quote] = await Promise.all([
      findLinkedLeadAndClient({
        servicem8JobUuid: input.servicem8JobUuid,
        jobNumber: input.jobNumber,
      }),
      findLinkedQuote(input.servicem8JobUuid),
    ])

    const company = input.servicem8CompanyUuid ? companiesByUuid.get(input.servicem8CompanyUuid) : null
    const clientName = linked?.clientName ?? quote?.clientName ?? company?.name?.trim() ?? input.jobNumber ?? 'Unknown client'

    await db
      .insert(workOrders)
      .values({
        servicem8JobUuid: input.servicem8JobUuid,
        servicem8CompanyUuid: input.servicem8CompanyUuid,
        servicem8Status: input.servicem8Status,
        servicem8Active: input.servicem8Active,
        jobNumber: input.jobNumber,
        jobAddress: input.jobAddress,
        jobDescription: input.jobDescription,
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
        target: workOrders.servicem8JobUuid,
        set: {
          servicem8CompanyUuid: input.servicem8CompanyUuid,
          servicem8Status: input.servicem8Status,
          servicem8Active: input.servicem8Active,
          jobNumber: input.jobNumber,
          jobAddress: input.jobAddress,
          jobDescription: input.jobDescription,
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

async function createConfigOption({
  formData,
  table,
  label,
}: {
  formData: FormData
  table: typeof workOrderInstallers | typeof workOrderStageOptions | typeof workOrderHardwareStatusOptions
  label: string
}) {
  const session = await auth()
  if (session?.user?.role !== 'admin' || !session.user.id) throw new Error('Forbidden')

  const displayName = String(formData.get('displayName') ?? '').trim()
  if (!displayName) throw new Error(`Missing ${label} name`)

  const now = new Date()
  await db
    .insert(table)
    .values({
      displayName,
      normalizedName: normalizeConfigName(displayName),
      isActive: true,
      createdBy: session.user.id,
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

async function findLinkedQuote(servicem8JobUuid: string) {
  const [quote] = await db
    .select({
      id: quotes.id,
      clientId: quotes.clientId,
      clientName: quotes.clientName,
      companyName: quotes.companyName,
    })
    .from(quotes)
    .where(eq(quotes.servicem8Uuid, servicem8JobUuid))
    .limit(1)

  return quote ?? null
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
