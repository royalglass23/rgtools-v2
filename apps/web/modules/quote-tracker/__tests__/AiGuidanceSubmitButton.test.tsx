import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const formStatus = vi.hoisted(() => ({ pending: false }))

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>()
  return {
    ...actual,
    useFormStatus: () => formStatus,
  }
})

import { AiGuidanceSubmitButton } from '../AiGuidanceSubmitButton'

describe('AiGuidanceSubmitButton', () => {
  it('uses the idle action label when generation is not pending', () => {
    formStatus.pending = false

    render(<AiGuidanceSubmitButton label="Regenerate" />)

    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeEnabled()
  })

  it('disables duplicate clicks and shows staged loading text while pending', () => {
    formStatus.pending = true

    render(<AiGuidanceSubmitButton label="Retry and regenerate" />)

    expect(screen.getByRole('button', { name: 'Generating' })).toBeDisabled()
    expect(screen.getByText('Reading ServiceM8 history')).toBeInTheDocument()
  })
})
