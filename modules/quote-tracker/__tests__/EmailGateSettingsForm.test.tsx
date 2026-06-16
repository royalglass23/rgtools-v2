import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { EmailGateSettingsForm } from '../EmailGateSettingsForm'

describe('EmailGateSettingsForm', () => {
  it('hides recipient emails when disabled', () => {
    render(<EmailGateSettingsForm action={vi.fn()} enabled={false} recipientEmails="" />)

    expect(screen.getByLabelText('Email gate')).not.toBeChecked()
    expect(screen.queryByLabelText('Recipient emails')).not.toBeInTheDocument()
  })

  it('shows and requires recipient emails when enabled', () => {
    render(<EmailGateSettingsForm action={vi.fn()} enabled recipientEmails="client@example.co.nz" />)

    expect(screen.getByLabelText('Email gate')).toBeChecked()
    expect(screen.getByLabelText('Recipient emails')).toBeRequired()
    expect(screen.getByLabelText('Recipient emails')).toHaveValue('client@example.co.nz')
  })

  it('clears recipient emails when unticked', () => {
    render(<EmailGateSettingsForm action={vi.fn()} enabled recipientEmails="client@example.co.nz" />)

    fireEvent.click(screen.getByLabelText('Email gate'))
    expect(screen.queryByLabelText('Recipient emails')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Email gate'))
    expect(screen.getByLabelText('Recipient emails')).toHaveValue('')
  })
})
