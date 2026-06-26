import { db } from '@/lib/db'
import { leadSubmitFailures } from '@rgtools/db/schema-leads'

export type LeadSubmitFailureInput = {
  correlationId: string
  ip: string
  stage: string
  error: string
  payload: unknown
}

export async function saveLeadSubmitFailure(input: LeadSubmitFailureInput): Promise<void> {
  await db.insert(leadSubmitFailures).values({
    correlationId: input.correlationId,
    ip: input.ip,
    stage: input.stage,
    error: input.error,
    payload: input.payload,
  })
}
