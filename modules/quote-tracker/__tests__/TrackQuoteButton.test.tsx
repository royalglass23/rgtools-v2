import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TrackQuoteButton } from '../TrackQuoteButton'

function openModal() {
  fireEvent.click(screen.getByRole('button', { name: 'Track Quote' }))
}

describe('TrackQuoteButton', () => {
  it('opens the modal with a job id field when clicked', () => {
    render(<TrackQuoteButton action={vi.fn()} />)

    expect(screen.queryByLabelText('Job ID')).not.toBeInTheDocument()
    openModal()
    expect(screen.getByLabelText('Job ID')).toBeInTheDocument()
  })

  it('shows the link, client name and address on success', async () => {
    const action = vi.fn().mockResolvedValue({
      ok: true,
      link: 'https://quotes-worker.example/q/AB12CD34',
      clientName: 'Acme Ltd',
      jobAddress: '12 Glass St',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    render(<TrackQuoteButton action={action} />)

    openModal()
    fireEvent.change(screen.getByLabelText('Job ID'), { target: { value: 'R260210' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(screen.getByText('Quote found')).toBeInTheDocument())
    expect(action).toHaveBeenCalledWith('R260210')
    expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    expect(screen.getByText('12 Glass St')).toBeInTheDocument()
    expect(screen.getByText('https://quotes-worker.example/q/AB12CD34')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('shows the backend error message and keeps the field editable', async () => {
    const action = vi.fn().mockResolvedValue({
      ok: false,
      message: 'No matching ServiceM8 job found.',
    })
    render(<TrackQuoteButton action={action} />)

    openModal()
    fireEvent.change(screen.getByLabelText('Job ID'), { target: { value: 'R999999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(screen.getByText('No matching ServiceM8 job found.')).toBeInTheDocument(),
    )
    expect(screen.getByLabelText('Job ID')).toHaveValue('R999999')
  })

  it('closes the modal when Done is clicked', async () => {
    const action = vi.fn().mockResolvedValue({
      ok: true,
      link: 'https://quotes-worker.example/q/AB12CD34',
      clientName: 'Acme Ltd',
      jobAddress: '12 Glass St',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    render(<TrackQuoteButton action={action} />)

    openModal()
    fireEvent.change(screen.getByLabelText('Job ID'), { target: { value: 'R260210' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByLabelText('Job ID')).not.toBeInTheDocument()
  })
})
