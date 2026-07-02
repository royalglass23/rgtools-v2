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

  it('disables duplicate clicks and shows a short loading modal while pending', () => {
    formStatus.pending = true

    render(<AiGuidanceSubmitButton label="Retry and regenerate" />)

    expect(screen.getByRole('button', { name: 'Retry and regenerate' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Generating information')
    expect(screen.queryByText('AI Guidance is working in the background.')).not.toBeInTheDocument()
    expect(screen.queryByText(/Reading ServiceM8 history/i)).not.toBeInTheDocument()
  })

  it('disables regeneration while the 5-minute cooldown is active', () => {
    formStatus.pending = false

    render(<AiGuidanceSubmitButton label="Regenerate" disabledUntil={new Date(Date.now() + 5 * 60_000)} />)

    expect(screen.getByRole('button', { name: 'Regenerate in 5 min' })).toBeDisabled()
  })
})
