'use server'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { getJobLookupByNumber } from '@/lib/servicem8/client'
import { leads, clients } from '@rgtools/db/schema-leads'
import { workOrders } from '@rgtools/db/schema-workorders'

export async function lookupPsGeneratorJob(jobNumber: string) {
  return lookupPsGeneratorJobWithDeps(jobNumber, {
    findWorkOrder: findWorkOrderJob,
    findLead: findLeadJob,
    findServiceM8: findServiceM8Job,
  })
}

type LookupJobRecord = {
  clientName: string | null
  jobAddress: string | null
}

export async function lookupPsGeneratorJobWithDeps(
  jobNumber: string,
  deps: {
    findWorkOrder: (jobNumber: string) => Promise<LookupJobRecord | null>
    findLead: (jobNumber: string) => Promise<LookupJobRecord | null>
    findServiceM8: (jobNumber: string) => Promise<LookupJobRecord | null>
  },
) {
  const normalized = jobNumber.trim().toUpperCase()
  if (!normalized) return { found: false as const, message: 'Enter a job number.' }

  const workOrder = await deps.findWorkOrder(normalized)
  if (hasLookupDetails(workOrder)) {
    return {
      found: true as const,
      clientName: workOrder.clientName,
      jobAddress: workOrder.jobAddress,
    }
  }

  const lead = await deps.findLead(normalized)
  if (hasLookupDetails(lead)) {
    return {
      found: true as const,
      clientName: lead.clientName,
      jobAddress: lead.jobAddress,
    }
  }

  try {
    const serviceM8Job = await deps.findServiceM8(normalized)
    if (hasLookupDetails(serviceM8Job)) {
      return {
        found: true as const,
        clientName: serviceM8Job.clientName,
        jobAddress: serviceM8Job.jobAddress,
      }
    }
  } catch (error) {
    console.warn('ps-generator.lookup-job.servicem8-failed', {
      jobNumber: normalized,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return { found: false as const, message: `No job found for ${normalized}. You can keep entering details manually.` }
}

async function findWorkOrderJob(jobNumber: string): Promise<LookupJobRecord | null> {
  const [workOrder] = await db
    .select({
      clientName: workOrders.clientName,
      jobAddress: workOrders.jobAddress,
    })
    .from(workOrders)
    .where(eq(workOrders.jobNumber, jobNumber))
    .limit(1)

  return workOrder ?? null
}

async function findLeadJob(jobNumber: string): Promise<LookupJobRecord | null> {
  const [lead] = await db
    .select({
      clientName: clients.name,
      jobAddress: leads.location,
    })
    .from(leads)
    .innerJoin(clients, eq(leads.clientId, clients.id))
    .where(eq(leads.servicem8JobNumber, jobNumber))
    .limit(1)

  return lead ?? null
}

async function findServiceM8Job(jobNumber: string): Promise<LookupJobRecord | null> {
  const job = await getJobLookupByNumber(jobNumber)
  return job ? { clientName: job.clientName, jobAddress: job.jobAddress } : null
}

function hasLookupDetails(record: LookupJobRecord | null): record is { clientName: string; jobAddress: string } {
  return Boolean(record?.clientName?.trim() && record.jobAddress?.trim())
}
