'use server'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { leads, clients } from '@rgtools/db/schema-leads'
import { workOrders } from '@rgtools/db/schema-workorders'

export async function lookupPsGeneratorJob(jobNumber: string) {
  const normalized = jobNumber.trim().toUpperCase()
  if (!normalized) return { found: false as const, message: 'Enter a job number.' }

  const [workOrder] = await db
    .select({
      clientName: workOrders.clientName,
      jobAddress: workOrders.jobAddress,
    })
    .from(workOrders)
    .where(eq(workOrders.jobNumber, normalized))
    .limit(1)

  if (workOrder?.clientName && workOrder.jobAddress) {
    return {
      found: true as const,
      clientName: workOrder.clientName,
      jobAddress: workOrder.jobAddress,
    }
  }

  const [lead] = await db
    .select({
      clientName: clients.name,
      jobAddress: leads.location,
    })
    .from(leads)
    .innerJoin(clients, eq(leads.clientId, clients.id))
    .where(eq(leads.servicem8JobNumber, normalized))
    .limit(1)

  if (lead?.clientName && lead.jobAddress) {
    return {
      found: true as const,
      clientName: lead.clientName,
      jobAddress: lead.jobAddress,
    }
  }

  return { found: false as const, message: `No job found for ${normalized}. You can keep entering details manually.` }
}
