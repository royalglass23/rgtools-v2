import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiSuggestionButton } from '../AiSuggestionButton'

describe('AiSuggestionButton', () => {
  it('disables lead-intake AI actions while keeping historical suggestion text visible', () => {
    const action = vi.fn()

    render(
      <AiSuggestionButton
        leadId="lead-1"
        initialSuggestion="Follow up with the client history."
        initialGeneratedAt="2026-06-30T00:00:00.000Z"
        action={action}
        disabledReason="AI suggestions are paused while this ServiceM8 job is no longer Quote."
      />,
    )

    expect(screen.getByText('Follow up with the client history.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled()
    expect(screen.getByText('AI suggestions are paused while this ServiceM8 job is no longer Quote.')).toBeInTheDocument()
  })

  it('keeps Quote and unlinked leads actionable', () => {
    render(
      <AiSuggestionButton
        leadId="lead-1"
        initialSuggestion={null}
        initialGeneratedAt={null}
        action={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Get suggestion' })).toBeEnabled()
  })
})
