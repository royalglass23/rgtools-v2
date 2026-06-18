import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActiveScoringOptionLists } from '@/modules/lead-intake/scoring/config-options'

const submitLeadIntakeMock = vi.hoisted(() => vi.fn())
const computeLeadDistanceMock = vi.hoisted(() => vi.fn())

vi.mock('../actions', () => ({
  submitLeadIntake: submitLeadIntakeMock,
  computeLeadDistance: computeLeadDistanceMock,
}))

vi.mock('../PlacesAutocomplete', () => ({
  PlacesAutocomplete: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (address: string, suburb: string) => void
  }) => (
    <label>
      Job Address *
      <input
        aria-label="Job Address"
        value={value}
        onChange={(event) => onChange(event.target.value, 'Albany')}
      />
    </label>
  ),
}))

import { LeadIntakeForm } from '../LeadIntakeForm'

const optionLists: ActiveScoringOptionLists = {
  configVersionId: 'config-1',
  config: {
    categories: {
      '1': { label: 'Client type', max: 20, options: { owner_occupier: 9 } },
      '2': { label: 'Budget', max: 20, options: {} },
      '4': { label: 'Complexity', max: 15, options: {} },
      '5': { label: 'Price sensitivity', max: 15, options: {} },
      '6': { label: 'Decision makers', max: 10, options: {} },
      '7': { label: 'Distance', max: 6, options: { within_30km: 6 } },
      '8': { label: 'Resource Consent', max: 7, options: { approved: 7 } },
      '9': { label: 'Building Consent', max: 6, options: { not_required: 6 } },
      '10': { label: 'Building Stage', max: 6, options: { fitout_complete: 6 } },
    },
    bonuses: {},
    penalties: {},
    tiers: { A: 75, B: 55, C: 30 },
  },
  categories: {
    '1': { label: 'Client type', options: [{ key: 'owner_occupier', label: 'Owner occupier' }] },
    '2': { label: 'Budget', options: [] },
    '4': { label: 'Complexity', options: [] },
    '5': { label: 'Price sensitivity', options: [] },
    '6': { label: 'Decision makers', options: [] },
    '7': { label: 'Distance', options: [{ key: 'within_30km', label: 'Within 30 km' }] },
    '8': { label: 'Resource Consent', options: [{ key: 'approved', label: 'Approved / granted' }] },
    '9': { label: 'Building Consent', options: [{ key: 'not_required', label: 'Not required / N/A' }] },
    '10': { label: 'Building Stage', options: [{ key: 'fitout_complete', label: 'Fit-out / finishing / completed' }] },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  computeLeadDistanceMock.mockResolvedValue('within_30km')
  submitLeadIntakeMock.mockResolvedValue({
    success: true,
    leadId: 'lead-1',
    clientId: 'client-1',
    matchedExistingClient: false,
    score: 15,
    tier: 'D',
    reason: 'Tier D (15): test',
    completeness: 50,
    distanceBand: 'within_30km',
    flagNote: null,
    servicem8Sync: { ok: true, leadId: 'lead-1', reference: 'inbox:lead-1' },
  })
})

describe('LeadIntakeForm', () => {
  it('renders RC, BC, Building Stage, and follow-up fields without the legacy consent select', () => {
    render(<LeadIntakeForm optionLists={optionLists} />)

    expect(screen.getByLabelText(/Resource Consent \(RC\)/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Building Consent \(BC\)/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Building Stage/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Follow-up date/)).toHaveAttribute('type', 'date')
    expect(screen.queryByLabelText(/Consent status/)).not.toBeInTheDocument()
  })

  it('submits the new consent readiness and follow-up fields', async () => {
    render(<LeadIntakeForm optionLists={optionLists} />)

    fireEvent.change(screen.getByLabelText(/Resource Consent \(RC\)/), {
      target: { value: 'approved' },
    })
    fireEvent.change(screen.getByLabelText(/Building Consent \(BC\)/), {
      target: { value: 'not_required' },
    })
    fireEvent.change(screen.getByLabelText(/Building Stage/), {
      target: { value: 'fitout_complete' },
    })
    fireEvent.change(screen.getByLabelText(/Follow-up date/), {
      target: { value: '2026-07-01' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Save and score/ }))

    await waitFor(() => {
      expect(submitLeadIntakeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          rcStatus: 'approved',
          bcStatus: 'not_required',
          buildingStage: 'fitout_complete',
          followUpDate: '2026-07-01',
        }),
      )
    })
  })

  it('resets driving distance after saving a new lead', async () => {
    render(<LeadIntakeForm optionLists={optionLists} />)

    fireEvent.change(screen.getByLabelText(/Client Name\/Business Name/), {
      target: { value: 'Aroha Smith' },
    })
    fireEvent.change(screen.getByLabelText(/Phone/), {
      target: { value: '021 333 444' },
    })
    fireEvent.change(screen.getByLabelText('Job Address'), {
      target: { value: '12 Queen Street, Auckland' },
    })
    fireEvent.change(screen.getByLabelText(/Project type/), {
      target: { value: 'pool_fence' },
    })

    expect(await screen.findByText('Within 30 km')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Save and score/ }))

    await waitFor(() => {
      expect(screen.getByLabelText(/Client Name\/Business Name/)).toHaveValue('')
      expect(screen.getByLabelText('Job Address')).toHaveValue('')
    })

    expect(screen.queryByText('Within 30 km')).not.toBeInTheDocument()
    expect(screen.getByText('Auto-computed from Job Address')).toBeInTheDocument()
  })
})
