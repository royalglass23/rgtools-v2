import { describe, expect, it } from 'vitest'

import { mapServiceM8JobsToWorkOrderInputs } from '../servicem8-sync'

describe('mapServiceM8JobsToWorkOrderInputs', () => {
  it('keeps active ServiceM8 Work Order jobs after normalized status matching', () => {
    const rows = mapServiceM8JobsToWorkOrderInputs([
      {
        uuid: 'job-1',
        active: 1,
        status: ' work order ',
        generated_job_id: 'R260210',
        job_address: '1 Queen Street',
        company_uuid: 'company-1',
        job_description: 'Install shower',
        approximate_description: 'Frameless shower',
        system_name: 'Metro',
        length: '1200',
        color: 'Matte black',
        items_services: 'Glass, hinges',
        glass_status: 'Ready',
        design_status: 'Approved',
        site_condition: 'Clear',
        remarks: 'Mind the driveway',
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
      {
        uuid: 'job-4',
        active: true,
        status: 'Completed',
        generated_job_id: 'R260212',
      },
    ])

    expect(rows).toEqual([
      {
        servicem8JobUuid: 'job-1',
        servicem8CompanyUuid: 'company-1',
        servicem8Status: 'work order',
        servicem8Active: true,
        jobNumber: 'R260210',
        jobAddress: '1 Queen Street',
        jobDescription: 'Install shower',
        identityKind: 'servicem8_uuid',
        identityValue: 'job-1',
        approximateDescription: 'Frameless shower',
        systemName: 'Metro',
        length: '1200',
        color: 'Matte black',
        itemsServices: 'Glass, hinges',
        glassStatus: 'Ready',
        designStatus: 'Approved',
        siteCondition: 'Clear',
        remarks: 'Mind the driveway',
        rawServiceM8Snapshot: expect.objectContaining({ uuid: 'job-1' }),
      },
    ])
  })

  it('uses the trusted Royal Glass job number when ServiceM8 UUID is missing', () => {
    const rows = mapServiceM8JobsToWorkOrderInputs([
      {
        uuid: null,
        active: '1',
        status: 'WORK ORDER',
        generated_job_id: ' R260210 ',
      },
    ])

    expect(rows).toEqual([
      expect.objectContaining({
        servicem8JobUuid: null,
        identityKind: 'job_number',
        identityValue: 'R260210',
        jobNumber: 'R260210',
      }),
    ])
  })
})
