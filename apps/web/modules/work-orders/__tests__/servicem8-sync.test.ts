import { describe, expect, it } from 'vitest'

import { mapServiceM8JobsToWorkOrderInputs } from '../servicem8-sync'

describe('mapServiceM8JobsToWorkOrderInputs', () => {
  it('keeps active ServiceM8 Work Order jobs', () => {
    const rows = mapServiceM8JobsToWorkOrderInputs([
      {
        uuid: 'job-1',
        active: 1,
        status: 'Work Order',
        generated_job_id: 'R260210',
        job_address: '1 Queen Street',
        company_uuid: 'company-1',
        job_description: 'Install shower',
      },
      {
        uuid: 'job-2',
        active: 1,
        status: 'Quote',
        generated_job_id: 'Q123',
        job_address: '2 King Street',
      },
      {
        uuid: 'job-3',
        active: 0,
        status: 'Work Order',
        generated_job_id: 'R260211',
        job_address: '3 Shortland Street',
      },
    ])

    expect(rows).toEqual([
      {
        servicem8JobUuid: 'job-1',
        servicem8CompanyUuid: 'company-1',
        servicem8Status: 'Work Order',
        servicem8Active: true,
        jobNumber: 'R260210',
        jobAddress: '1 Queen Street',
        jobDescription: 'Install shower',
      },
    ])
  })
})
