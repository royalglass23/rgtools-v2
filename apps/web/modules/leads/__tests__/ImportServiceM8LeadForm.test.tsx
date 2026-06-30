import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ImportServiceM8LeadForm } from '../ImportServiceM8LeadForm'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

describe('ImportServiceM8LeadForm', () => {
  beforeEach(() => {
    push.mockClear()
  })

  it('submits a job number only and routes to the imported lead detail', async () => {
    const action = vi.fn().mockResolvedValue({
      ok: true,
      redirectPath: '/leads/lead-1',
      message: 'Imported job Q260004.',
      missingContact: false,
      reusedExisting: false,
    })

    render(<ImportServiceM8LeadForm action={action} />)

    fireEvent.change(screen.getByPlaceholderText('Job number'), { target: { value: ' q260004 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => expect(action).toHaveBeenCalledWith('Q260004'))
    expect(push).toHaveBeenCalledWith('/leads/lead-1')
  })

  it('shows a clear rejection dialog without moving or routing', async () => {
    const action = vi.fn().mockResolvedValue({
      ok: false,
      message: 'ServiceM8 job Q260005 is Work Order, not Quote. Import a Quote job only.',
    })

    render(<ImportServiceM8LeadForm action={action} />)

    fireEvent.change(screen.getByPlaceholderText('Job number'), { target: { value: 'Q260005' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))

    const dialog = await screen.findByRole('dialog', { name: 'Import from ServiceM8' })
    expect(within(dialog).getByText('ServiceM8 job Q260005 is Work Order, not Quote. Import a Quote job only.')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }))

    expect(screen.queryByRole('dialog', { name: 'Import from ServiceM8' })).not.toBeInTheDocument()
  })
})
