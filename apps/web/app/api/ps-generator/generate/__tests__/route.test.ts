// @vitest-environment node

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => vi.fn())
const userCanAccessSlugMock = vi.hoisted(() => vi.fn())
const generateProducerStatementPackageMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/access-db', () => ({ userCanAccessSlug: userCanAccessSlugMock }))
vi.mock('@/modules/ps-generator/generation', () => ({
  humanizePsGenerationMessage: (message: string) => message.replace(/"bc_number"/g, '"BC Number"'),
  humanizePsIdentifier: (value: string | null | undefined) => {
    if (value === 'bc_number') return 'BC Number'
    if (value === 'client_name') return 'Client name'
    return value ?? ''
  },
  PsGenerationError: class PsGenerationError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly details?: Record<string, unknown>,
    ) {
      super(message)
      this.name = 'PsGenerationError'
    }
  },
  generateProducerStatementPackage: generateProducerStatementPackageMock,
}))

import { POST } from '../route'

describe('POST /api/ps-generator/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns generated PDF outputs as base64 for authorized PS Generator users', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1', name: 'Jane Staff', email: 'jane@royalglass.co.nz' } })
    userCanAccessSlugMock.mockResolvedValue(true)
    generateProducerStatementPackageMock.mockResolvedValue({
      operationId: 'operation-1',
      mode: 'both',
      versionLabel: 'wordpress-plugin-v1',
      outputs: [{
        documentKind: 'ps1',
        templateVariantId: 'template-1',
        templateLabel: 'Double Disc PS1',
        sourceObjectKey: 'templates/ps1.pdf',
        filename: 'PS1-Jane-Customer.pdf',
        contentType: 'application/pdf',
        bytes: Buffer.from('filled ps1 pdf'),
      }],
    })

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(generateProducerStatementPackageMock).toHaveBeenCalledWith(
      {
        mode: 'both',
        projectDetails: {
          clientName: 'Jane Customer',
          jobAddress: '12 Glass Lane',
          bcNumber: 'BC-123',
        },
        selections: {
          system: 'double-disc',
          structure_material: 'timber',
        },
      },
      {
        persistGeneratedOutputs: true,
        actor: {
          id: 'user-1',
          label: 'Jane Staff',
        },
      },
    )
    expect(body).toEqual({
      ok: true,
      operationId: 'operation-1',
      mode: 'both',
      versionLabel: 'wordpress-plugin-v1',
      outputs: [{
        documentKind: 'ps1',
        templateVariantId: 'template-1',
        templateLabel: 'Double Disc PS1',
        filename: 'PS1-Jane-Customer.pdf',
        contentType: 'application/pdf',
        base64: Buffer.from('filled ps1 pdf').toString('base64'),
      }],
    })
  })

  it('does not generate PDFs for unauthenticated requests', async () => {
    authMock.mockResolvedValue(null)

    const response = await POST(request())

    expect(response.status).toBe(401)
    expect(generateProducerStatementPackageMock).not.toHaveBeenCalled()
  })

  it('returns human-readable generation errors without raw field names in the message', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1', name: 'Jane Staff' } })
    userCanAccessSlugMock.mockResolvedValue(true)
    const { PsGenerationError } = await import('@/modules/ps-generator/generation')
    generateProducerStatementPackageMock.mockRejectedValue(new PsGenerationError(
      'pdf_text_field_missing',
      'Template "Double Disc PS1" is missing text field "bc_number".',
      { fieldName: 'bc_number', availableFields: ['client_name'] },
    ))

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toMatchObject({
      code: 'pdf_text_field_missing',
      message: 'Template "Double Disc PS1" is missing text field "BC Number".',
      details: {
        fieldName: 'bc_number',
        fieldNameLabel: 'BC Number',
        availableFields: ['client_name'],
        availableFieldLabels: ['Client name'],
      },
    })
  })
})

function request(body: unknown = {
  mode: 'both',
  projectDetails: {
    clientName: 'Jane Customer',
    jobAddress: '12 Glass Lane',
    bcNumber: 'BC-123',
  },
  selections: {
    system: 'double-disc',
    structure_material: 'timber',
  },
}) {
  return new NextRequest('https://rgtools.local/api/ps-generator/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}
