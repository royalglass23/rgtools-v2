import { auditLog } from '@rgtools/db/schema'
import { db } from '@/lib/db'
import { buildAuditDiff, deriveAuditEntityType, type AuditEntityType } from '@/lib/audit'
import { resolveAuditIpAddress } from '@/lib/audit-ip'

type AuditDb = {
  insert: typeof db.insert
}

type LogAuditInput = {
  actorId?: string | null
  entityType?: AuditEntityType | null
  targetId?: string | null
  action: string
  detail?: Record<string, unknown> | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  ipAddress?: string | null
}

export async function logAudit(input: LogAuditInput, tx: AuditDb = db) {
  const detail = input.detail ?? buildAuditDiff(input.before, input.after)
  const entityType = input.entityType ?? deriveAuditEntityType(input.action)
  const ipAddress = input.ipAddress ?? await getRequestIpAddress()

  await tx.insert(auditLog).values({
    actorId: input.actorId ?? null,
    entityType,
    action: input.action,
    targetId: input.targetId ?? null,
    detail,
    ipAddress,
  })
}

async function getRequestIpAddress() {
  try {
    const mod = await import('next/headers')
    const requestHeaders = await mod.headers()
    return resolveAuditIpAddress(requestHeaders)
  } catch {
    return null
  }
}
