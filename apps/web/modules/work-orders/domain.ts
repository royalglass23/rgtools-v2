export type WorkOrderLevel = 'low' | 'medium' | 'high'

export const WORK_ORDER_AI_SUGGESTION_COOLDOWN_MS = 5 * 60 * 1000

export type WorkOrderIdentityInput = {
  servicem8JobUuid: string | null
  jobNumber: string | null
  jobAddress: string | null
}

export type WorkOrderMatchKey =
  | { kind: 'servicem8_uuid'; value: string }
  | { kind: 'job_number'; value: string }
  | { kind: 'none'; value: null }

export function normalizeConfigName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function normalizeAddress(value: string): string {
  return normalizeConfigName(value)
}

export function matchKeyForWorkOrder(input: WorkOrderIdentityInput): WorkOrderMatchKey {
  const servicem8JobUuid = input.servicem8JobUuid?.trim()
  if (servicem8JobUuid) return { kind: 'servicem8_uuid', value: servicem8JobUuid }

  const jobNumber = input.jobNumber?.trim()
  if (!jobNumber) return { kind: 'none', value: null }

  return { kind: 'job_number', value: jobNumber }
}

export function effectiveRiskLevel(input: {
  aiRiskLevel: WorkOrderLevel | null
  riskLevelOverride: WorkOrderLevel | null
}): WorkOrderLevel | null {
  return input.riskLevelOverride ?? input.aiRiskLevel
}

export function effectiveImportance(input: {
  aiImportance: WorkOrderLevel | null
  importanceOverride: WorkOrderLevel | null
}): WorkOrderLevel | null {
  return input.importanceOverride ?? input.aiImportance
}
