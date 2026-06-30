export type ServiceM8WorkOrderJob = {
  uuid?: string | null
  active?: number | string | boolean | null
  status?: string | null
  company_uuid?: string | null
  generated_job_id?: string | null
  job_address?: string | null
  job_description?: string | null
}

export type WorkOrderSyncInput = {
  servicem8JobUuid: string
  servicem8CompanyUuid: string | null
  servicem8Status: string
  servicem8Active: boolean
  jobNumber: string | null
  jobAddress: string | null
  jobDescription: string | null
}

export function mapServiceM8JobsToWorkOrderInputs(jobs: ServiceM8WorkOrderJob[]): WorkOrderSyncInput[] {
  return jobs
    .filter((job) => Boolean(job.uuid))
    .filter((job) => isActive(job.active))
    .filter((job) => job.status === 'Work Order')
    .map((job) => ({
      servicem8JobUuid: job.uuid as string,
      servicem8CompanyUuid: clean(job.company_uuid),
      servicem8Status: job.status as string,
      servicem8Active: true,
      jobNumber: clean(job.generated_job_id),
      jobAddress: clean(job.job_address),
      jobDescription: clean(job.job_description),
    }))
}

function isActive(value: ServiceM8WorkOrderJob['active']): boolean {
  return value === true || value === 1 || value === '1'
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed || null
}
