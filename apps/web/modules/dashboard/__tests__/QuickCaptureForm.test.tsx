import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const submitQuickCaptureLeadMock = vi.hoisted(() => vi.fn())

vi.mock('../quick-capture-actions', () => ({
  submitQuickCaptureLead: submitQuickCaptureLeadMock,
}))

import { QuickCaptureForm } from '../QuickCaptureForm'

const buildingStageOptions = [
  { key: 'ready_for_glazing', label: 'Ready for Glazing' },
  { key: 'early_planning', label: 'Early Planning' },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('QuickCaptureForm', () => {
  it('shows shared minimum validation errors from the action', async () => {
    submitQuickCaptureLeadMock.mockResolvedValue({ error: 'Job address is required.' })
    render(<QuickCaptureForm buildingStageOptions={buildingStageOptions} />)

    fireEvent.change(screen.getByLabelText(/Client name/), { target: { value: 'Aroha Smith' } })
    fireEvent.change(screen.getByLabelText(/Phone/), { target: { value: '021 333 444' } })
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'aroha@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /Capture lead/ }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Job address is required.')
    })
  })

  it('submits captured first-call fields and links to the full intake form on success', async () => {
    submitQuickCaptureLeadMock.mockResolvedValue({
      success: true,
      leadId: 'lead-quick-1',
      clientId: 'client-1',
      matchedExistingClient: false,
      score: 58,
      tier: 'B',
      reason: 'Tier B (58): strong lead',
      completeness: 31,
      distanceBand: 'lt_15km',
      flagNote: null,
      servicem8Sync: { ok: true, leadId: 'lead-quick-1', reference: 'inbox:lead-quick-1' },
    })

    render(<QuickCaptureForm buildingStageOptions={buildingStageOptions} />)

    fireEvent.change(screen.getByLabelText(/Client name/), { target: { value: 'Aroha Smith' } })
    fireEvent.change(screen.getByLabelText(/Phone/), { target: { value: '021 333 444' } })
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'aroha@example.com' } })
    fireEvent.change(screen.getByLabelText(/Job address/), { target: { value: '12 Queen Street, Auckland' } })
    fireEvent.change(screen.getByLabelText(/Job Description/), { target: { value: 'Pool fence quote' } })
    fireEvent.change(screen.getByLabelText(/Building Stage/), { target: { value: 'ready_for_glazing' } })
    fireEvent.click(screen.getByRole('button', { name: /Capture lead/ }))

    await waitFor(() => {
      expect(submitQuickCaptureLeadMock).toHaveBeenCalledOnce()
    })

    const submitted = submitQuickCaptureLeadMock.mock.calls[0]?.[0] as FormData
    expect(submitted.get('clientName')).toBe('Aroha Smith')
    expect(submitted.get('phone')).toBe('021 333 444')
    expect(submitted.get('email')).toBe('aroha@example.com')
    expect(submitted.get('location')).toBe('12 Queen Street, Auckland')
    expect(submitted.get('jobDescription')).toBe('Pool fence quote')
    expect(submitted.get('buildingStage')).toBe('ready_for_glazing')
    expect(screen.getByText(/Tier B/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Continue full intake/ })).toHaveAttribute(
      'href',
      '/lead-intake?leadId=lead-quick-1',
    )
  })
})
