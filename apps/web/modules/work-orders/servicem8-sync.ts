import { matchKeyForWorkOrder, type WorkOrderMatchKey } from './domain'

export type ServiceM8WorkOrderJob = {
  uuid?: string | null
  active?: number | string | boolean | null
  status?: string | null
  company_uuid?: string | null
  generated_job_id?: string | null
  job_address?: string | null
  job_description?: string | null
  approximate_description?: string | null
  system_name?: string | null
  length?: string | null
  color?: string | null
  items_services?: string | null
  glass_status?: string | null
  design_status?: string | null
  site_condition?: string | null
  remarks?: string | null
  [key: string]: unknown
}

export type WorkOrderSyncInput = {
  servicem8JobUuid: string | null
  servicem8CompanyUuid: string | null
  servicem8Status: string
  servicem8Active: boolean
  jobNumber: string | null
  jobAddress: string | null
  jobDescription: string | null
  identityKind: Exclude<WorkOrderMatchKey['kind'], 'none'>
  identityValue: string
  approximateDescription: string | null
  systemName: string | null
  length: string | null
  color: string | null
  itemsServices: string | null
  glassStatus: string | null
  designStatus: string | null
  siteCondition: string | null
  remarks: string | null
  rawServiceM8Snapshot: ServiceM8WorkOrderJob
}

export function mapServiceM8JobsToWorkOrderInputs(jobs: ServiceM8WorkOrderJob[]): WorkOrderSyncInput[] {
  return jobs
    .filter((job) => isActive(job.active))
    .filter((job) => normalizeStatus(job.status) === 'work order')
    .map(toWorkOrderSyncInput)
    .filter((input): input is WorkOrderSyncInput => input !== null)
}

function isActive(value: ServiceM8WorkOrderJob['active']): boolean {
  return value === true || value === 1 || value === '1'
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed || null
}

function normalizeStatus(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? ''
}

function toWorkOrderSyncInput(job: ServiceM8WorkOrderJob): WorkOrderSyncInput | null {
  const servicem8JobUuid = clean(job.uuid)
  const jobNumber = clean(job.generated_job_id)
  const jobAddress = clean(job.job_address)
  const identity = matchKeyForWorkOrder({ servicem8JobUuid, jobNumber, jobAddress })
  if (identity.kind === 'none') return null

  return {
    servicem8JobUuid,
    servicem8CompanyUuid: clean(job.company_uuid),
    servicem8Status: clean(job.status) ?? 'Work Order',
    servicem8Active: true,
    jobNumber,
    jobAddress,
    jobDescription: clean(job.job_description),
    identityKind: identity.kind,
    identityValue: identity.value,
    approximateDescription: clean(job.approximate_description),
    systemName: clean(job.system_name),
    length: clean(job.length),
    color: clean(job.color),
    itemsServices: clean(job.items_services),
    glassStatus: clean(job.glass_status),
    designStatus: clean(job.design_status),
    siteCondition: clean(job.site_condition),
    remarks: clean(job.remarks),
    rawServiceM8Snapshot: job,
  }
}
