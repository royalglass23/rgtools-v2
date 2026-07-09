import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const refreshMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

import { PsConfigurationSystemsEditor } from '../PsConfigurationSystemsEditor'

describe('PsConfigurationSystemsEditor', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    refreshMock.mockReset()
  })

  it('uploads selected template PDFs directly before saving a new system', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({
        objectKey: 'drafts/ps-generator/templates/config-1/face-fixed/standard_ps1/Face-Fixed.pdf',
        originalFilename: 'Face Fixed.pdf',
        uploadUrl: 'https://account.r2.cloudflarestorage.com/bucket/template.pdf?X-Amz-Signature=sig',
        headers: {
          'content-type': 'application/pdf',
          'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
        },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const createAction = vi.fn(async () => undefined)

    render(
      <PsConfigurationSystemsEditor
        configVersionId="config-1"
        systems={[]}
        isDraft
        createAction={createAction}
        updateAction={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add system' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Face Fixed' } })
    const templateInput = screen.getByLabelText('Template') as HTMLInputElement
    Object.defineProperty(templateInput, 'files', {
      value: [new File([new Uint8Array(8 * 1024 * 1024)], 'Face Fixed.pdf', { type: 'application/pdf' })],
      configurable: true,
    })
    fireEvent.change(templateInput)
    fireEvent.submit(templateInput.closest('form')!)

    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/ps-generator/template-upload', expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    }))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      configVersionId: 'config-1',
      systemPart: 'face-fixed',
      variantKind: 'standard_ps1',
      filename: 'Face Fixed.pdf',
      contentType: 'application/pdf',
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://account.r2.cloudflarestorage.com/bucket/template.pdf?X-Amz-Signature=sig', expect.objectContaining({
      method: 'PUT',
      headers: {
        'content-type': 'application/pdf',
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      },
    }))

    const formData = createAction.mock.calls[0][0] as FormData
    expect(formData.get('standardPs1Template')).toBeNull()
    expect(formData.get('standardPs1TemplateObjectKey')).toBe('drafts/ps-generator/templates/config-1/face-fixed/standard_ps1/Face-Fixed.pdf')
    expect(formData.get('standardPs1TemplateOriginalFilename')).toBe('Face Fixed.pdf')
    expect(refreshMock).toHaveBeenCalled()
  })
})
