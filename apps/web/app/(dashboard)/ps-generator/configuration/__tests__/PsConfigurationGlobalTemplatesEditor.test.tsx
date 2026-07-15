import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const refreshMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

import { PsConfigurationGlobalTemplatesEditor } from '../PsConfigurationGlobalTemplatesEditor'

describe('PsConfigurationGlobalTemplatesEditor', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    refreshMock.mockReset()
  })

  it('uploads the shared PS3 template directly before saving the draft', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({
        objectKey: 'drafts/ps-generator/templates/config-1/global/ps3/PS3-Template.pdf',
        originalFilename: 'PS3 Template.pdf',
        uploadUrl: 'https://account.r2.cloudflarestorage.com/bucket/ps3.pdf?X-Amz-Signature=sig',
        headers: {
          'content-type': 'application/pdf',
          'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
        },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const updateAction = vi.fn(async (_formData: FormData) => undefined)

    render(
      <PsConfigurationGlobalTemplatesEditor
        configVersionId="config-1"
        isDraft
        ps3Template={{
          id: 'template-ps3',
          label: 'Shared PS3',
          originalFilename: null,
          r2ObjectKey: 'templates/ps-generator/wordpress/double-disc/ps3.pdf',
        }}
        updateAction={updateAction}
      />,
    )

    const templateInput = screen.getByLabelText(/PS3 template/) as HTMLInputElement
    Object.defineProperty(templateInput, 'files', {
      value: [new File([new Uint8Array(8 * 1024 * 1024)], 'PS3 Template.pdf', { type: 'application/pdf' })],
      configurable: true,
    })
    fireEvent.change(templateInput)
    fireEvent.submit(templateInput.closest('form')!)

    await waitFor(() => expect(updateAction).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/ps-generator/template-upload', expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    }))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      configVersionId: 'config-1',
      systemPart: 'global',
      variantKind: 'ps3',
      filename: 'PS3 Template.pdf',
      contentType: 'application/pdf',
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://account.r2.cloudflarestorage.com/bucket/ps3.pdf?X-Amz-Signature=sig', expect.objectContaining({
      method: 'PUT',
      headers: {
        'content-type': 'application/pdf',
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      },
    }))

    const formData = updateAction.mock.calls[0][0] as FormData
    expect(formData.get('ps3Template')).toBeNull()
    expect(formData.get('templateVariantId')).toBe('template-ps3')
    expect(formData.get('ps3TemplateObjectKey')).toBe('drafts/ps-generator/templates/config-1/global/ps3/PS3-Template.pdf')
    expect(formData.get('ps3TemplateOriginalFilename')).toBe('PS3 Template.pdf')
    expect(refreshMock).toHaveBeenCalled()
  })
})
