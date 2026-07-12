import { describe, expect, it, vi } from 'vitest'

import { lookupPsGeneratorJobWithDeps } from '../actions'

describe('lookupPsGeneratorJobWithDeps', () => {
  it('uses local work orders before falling back to ServiceM8', async () => {
    const deps = {
      findWorkOrder: vi.fn(async () => ({ clientName: 'Local Customer', jobAddress: '1 Local Lane' })),
      findLead: vi.fn(async () => null),
      findServiceM8: vi.fn(async () => ({ clientName: 'ServiceM8 Customer', jobAddress: '2 ServiceM8 Road' })),
    }

    await expect(lookupPsGeneratorJobWithDeps(' r260210 ', deps)).resolves.toEqual({
      found: true,
      clientName: 'Local Customer',
      jobAddress: '1 Local Lane',
    })
    expect(deps.findWorkOrder).toHaveBeenCalledWith('R260210')
    expect(deps.findLead).not.toHaveBeenCalled()
    expect(deps.findServiceM8).not.toHaveBeenCalled()
  })

  it('falls back to ServiceM8 when the job is not in local RG Tools tables', async () => {
    const deps = {
      findWorkOrder: vi.fn(async () => null),
      findLead: vi.fn(async () => null),
      findServiceM8: vi.fn(async () => ({ clientName: 'ServiceM8 Customer', jobAddress: '2 ServiceM8 Road' })),
    }

    await expect(lookupPsGeneratorJobWithDeps('R260210', deps)).resolves.toEqual({
      found: true,
      clientName: 'ServiceM8 Customer',
      jobAddress: '2 ServiceM8 Road',
    })
    expect(deps.findServiceM8).toHaveBeenCalledWith('R260210')
  })

  it('keeps manual entry available when local and ServiceM8 lookup miss', async () => {
    const deps = {
      findWorkOrder: vi.fn(async () => null),
      findLead: vi.fn(async () => null),
      findServiceM8: vi.fn(async () => null),
    }

    await expect(lookupPsGeneratorJobWithDeps('R260999', deps)).resolves.toEqual({
      found: false,
      message: 'No job found for R260999. You can keep entering details manually.',
    })
  })
})
