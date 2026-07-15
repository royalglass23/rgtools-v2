import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PsConfigurationVersionActions } from '../PsConfigurationVersionActions'

describe('PsConfigurationVersionActions', () => {
  it('offers Edit for a published configuration', () => {
    render(
      <PsConfigurationVersionActions
        isDraft={false}
        createDraftAction={vi.fn()}
        saveDraftAction={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /create draft/i })).not.toBeInTheDocument()
  })

  it('offers one Save action for a draft and submits the option edits with it', async () => {
    const saveDraftAction = vi.fn(async (_formData: FormData) => undefined)
    render(
      <>
        <PsConfigurationVersionActions
          isDraft
          createDraftAction={vi.fn()}
          saveDraftAction={saveDraftAction}
        />
        <form id="ps-configuration-options-form">
          <input type="hidden" name="configVersionId" value="draft-1" />
          <input name="label:option-1" defaultValue="Edited label" />
        </form>
      </>,
    )

    const saveButton = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement
    expect(saveButton.form?.id).toBe('ps-configuration-options-form')
    expect(screen.queryByRole('button', { name: /publish draft/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument()

    fireEvent.click(saveButton)
    await waitFor(() => expect(saveDraftAction).toHaveBeenCalledTimes(1))
    const formData = saveDraftAction.mock.calls[0][0] as FormData
    expect(formData.get('configVersionId')).toBe('draft-1')
    expect(formData.get('label:option-1')).toBe('Edited label')
  })
})
