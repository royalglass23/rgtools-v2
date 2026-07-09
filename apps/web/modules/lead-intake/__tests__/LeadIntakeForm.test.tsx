import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActiveScoringOptionLists } from '@/modules/lead-intake/scoring/config-options'

const submitLeadIntakeMock = vi.hoisted(() => vi.fn())
const computeLeadDistanceMock = vi.hoisted(() => vi.fn())
const routerPushMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}))

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
    onChange: (address: string, suburb: string, source?: 'input' | 'place' | 'manual') => void
  }) => (
    <label>
      Job Address *
      <input
        aria-label="Job Address"
        value={value}
        onChange={(event) => onChange(event.target.value, 'Albany', 'input')}
        onBlur={(event) => onChange(event.target.value, 'Albany', 'manual')}
      />
    </label>
  ),
}))

import { LeadIntakeForm } from '../LeadIntakeForm'

const optionLists: ActiveScoringOptionLists = {
  configVersionId: null,
  config: {} as ActiveScoringOptionLists['config'],
  categories: {
    '1': { label: 'Client type', options: [{ key: 'builder_developer_pool_builder_landscaper', label: 'Builder / Developer / Pool Builder / Landscaper' }] },
    '2': { label: 'Budget', options: [{ key: '20k_50k', label: '$20k-50k' }, { key: '50k_plus', label: '$50k+' }] },
    '4': { label: 'Project Type', options: [{ key: 'new_build_commercial_fit_out', label: 'New Build / Commercial Fit-out' }] },
    '5': { label: 'Price sensitivity', options: [{ key: 'not_price_sensitive', label: 'Not Price Sensitive' }] },
    '6': { label: 'Decision makers', options: [{ key: 'decision_maker_confirmed_owner_director', label: 'Decision Maker Confirmed / Owner / Director' }] },
    '7': { label: 'Distance', options: [{ key: 'lt_15km', label: '<15 km' }] },
    '8': { label: 'Resource Consent', options: [{ key: 'approved_not_required', label: 'Approved / Not Required' }] },
    '9': { label: 'Building Consent', options: [{ key: 'approved_not_required', label: 'Approved / Not Required' }] },
    '10': { label: 'Building Stage', options: [{ key: 'ready_for_glazing', label: 'Ready for Glazing' }] },
    '11': { label: 'Source', options: [{ key: 'existing_client_referral_repeat_builder_architect', label: 'Existing Client / Referral / Repeat Builder / Architect' }] },
    '12': { label: 'Payment History', options: [{ key: 'always_on_time_good', label: 'Always On Time / Good' }] },
    '13': { label: 'Site Access', options: [{ key: 'easy', label: 'Easy' }] },
    '14': { label: 'Installation Height', options: [{ key: 'ground_floor_ladder', label: 'Ground Floor / Ladder' }] },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  computeLeadDistanceMock.mockResolvedValue('lt_15km')
  submitLeadIntakeMock.mockResolvedValue({
    success: true,
    leadId: 'lead-1',
    clientId: 'client-1',
    matchedExistingClient: false,
    score: 15,
    tier: 'D',
    reason: 'Tier D (15): test',
    completeness: 50,
    distanceBand: 'lt_15km',
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
      target: { value: 'approved_not_required' },
    })
    fireEvent.change(screen.getByLabelText(/Building Consent \(BC\)/), {
      target: { value: 'approved_not_required' },
    })
    fireEvent.change(screen.getByLabelText(/Building Stage/), {
      target: { value: 'ready_for_glazing' },
    })
    fireEvent.change(screen.getByLabelText(/Follow-up date/), {
      target: { value: '2026-07-01' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Save and score/ }))

    await waitFor(() => {
      expect(submitLeadIntakeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          rcStatus: 'approved_not_required',
          bcStatus: 'approved_not_required',
          buildingStage: 'ready_for_glazing',
          followUpDate: '2026-07-01',
        }),
      )
    })
  })

  it('shows the selected option Team Note on focus and updates when the selection changes', async () => {
    render(<LeadIntakeForm optionLists={optionLists} />)
    const budgetSelect = screen.getByRole('combobox', { name: /Budget Band/ })

    fireEvent.change(budgetSelect, {
      target: { value: '20k_50k' },
    })
    fireEvent.focus(screen.getByRole('button', { name: /Budget Band Team Note/ }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Good opportunity. Follow up weekly and maintain momentum.')

    fireEvent.change(budgetSelect, {
      target: { value: '50k_plus' },
    })
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent('High-value opportunity. Arrange an on-site meeting within 48 hours. Senior salesperson to manage.')
    })
  })

  it('prefills follow-up date from tier cadence and does not overwrite a manual date', async () => {
    render(<LeadIntakeForm optionLists={optionLists} />)

    fireEvent.change(screen.getByLabelText(/Client type/), { target: { value: 'builder_developer_pool_builder_landscaper' } })
    fireEvent.change(screen.getByLabelText(/Budget Band/), { target: { value: '50k_plus' } })
    fireEvent.change(screen.getByLabelText(/Resource Consent \(RC\)/), { target: { value: 'approved_not_required' } })
    fireEvent.change(screen.getByLabelText(/Building Consent \(BC\)/), { target: { value: 'approved_not_required' } })
    fireEvent.change(screen.getByLabelText(/Building Stage/), { target: { value: 'ready_for_glazing' } })
    fireEvent.change(screen.getByLabelText(/^Project Type$/), { target: { value: 'new_build_commercial_fit_out' } })
    fireEvent.change(screen.getByLabelText(/Price-sensitivity read/), { target: { value: 'not_price_sensitive' } })
    fireEvent.change(screen.getByLabelText(/Decision-makers/), { target: { value: 'decision_maker_confirmed_owner_director' } })

    const tierBDate = datePlusDays(7)
    const tierADate = datePlusDays(1)

    await waitFor(() => {
      expect(screen.getByLabelText(/Follow-up date/)).toHaveValue(tierBDate)
    })

    fireEvent.change(screen.getByLabelText(/Source/), { target: { value: 'existing_client_referral_repeat_builder_architect' } })
    fireEvent.change(screen.getByLabelText(/Payment History/), { target: { value: 'always_on_time_good' } })

    await waitFor(() => {
      expect(screen.getByLabelText(/Follow-up date/)).toHaveValue(tierADate)
    })

    fireEvent.change(screen.getByLabelText(/Follow-up date/), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText(/Site Access/), { target: { value: 'easy' } })

    await waitFor(() => {
      expect(screen.getByLabelText(/Follow-up date/)).toHaveValue('2026-08-01')
    })
  })

  it('goes to the lead detail page after saving and scoring a new lead', async () => {
    render(<LeadIntakeForm optionLists={optionLists} />)

    fireEvent.change(screen.getByLabelText(/Client Name\/Business Name/), {
      target: { value: 'Aroha Smith' },
    })
    fireEvent.change(screen.getByLabelText(/Phone/), {
      target: { value: '021 333 444' },
    })
    fireEvent.change(screen.getByLabelText(/Email/), {
      target: { value: 'aroha@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Job Address'), {
      target: { value: '12 Queen Street, Auckland' },
    })
    fireEvent.change(screen.getByLabelText(/Product/), {
      target: { value: 'pool_fence' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Save and score/ }))

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith('/leads/lead-1?intakeSaved=added')
    })
  })

  it('keeps manually typed job address text in the submit payload', async () => {
    render(<LeadIntakeForm optionLists={optionLists} />)

    fireEvent.change(screen.getByLabelText(/Client Name\/Business Name/), {
      target: { value: 'Aroha Smith' },
    })
    fireEvent.change(screen.getByLabelText(/Phone/), {
      target: { value: '021 333 444' },
    })
    fireEvent.change(screen.getByLabelText(/Email/), {
      target: { value: 'aroha@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Job Address'), {
      target: { value: '22 Queen Street, Auckland' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Save and score/ }))

    await waitFor(() => {
      expect(submitLeadIntakeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          location: '22 Queen Street, Auckland',
        }),
      )
    })
    expect(computeLeadDistanceMock).not.toHaveBeenCalled()
  })

  it('computes distance when a pasted job address is manually committed', async () => {
    render(<LeadIntakeForm optionLists={optionLists} />)

    const addressInput = screen.getByLabelText('Job Address')
    fireEvent.change(addressInput, {
      target: { value: '22 Queen Street, Auckland' },
    })
    fireEvent.blur(addressInput)

    await waitFor(() => {
      expect(computeLeadDistanceMock).toHaveBeenCalledWith('22 Queen Street, Auckland')
    })
    await waitFor(() => {
      expect(screen.getByText('<15 km')).toBeInTheDocument()
    })
  })
})

function datePlusDays(days: number): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}
