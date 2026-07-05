import { render, screen } from '@testing-library/react'
import { ScorePanel } from '../ScorePanel'

const emptyInput = {
  clientProfileKey: '',
  budgetBand: '',
  cat4: '',
  timeline: '',
  rcStatus: '',
  bcStatus: '',
  buildingStage: '',
  decisionMakers: '',
  priceSensitivityRead: '',
}

it('shows Tier E and score 0 when no fields are filled', () => {
  render(<ScorePanel input={emptyInput} />)
  expect(screen.getByText('Tier E')).toBeInTheDocument()
  expect(screen.getByText('Score 0/100 | Question 0/13')).toBeInTheDocument()
  expect(screen.getByText('Last update:')).toBeInTheDocument()
  expect(screen.getByText('Follow-up:')).toBeInTheDocument()
})

it('shows correct tier and score when fields are filled', () => {
  render(
    <ScorePanel
      input={{
        ...emptyInput,
        clientProfileKey: 'builder_developer_pool_builder_landscaper',
        budgetBand: '50k_plus',
        rcStatus: 'approved_not_required',
        bcStatus: 'approved_not_required',
      }}
    />,
  )
  expect(screen.getByText('Tier D')).toBeInTheDocument()
  expect(screen.getByText('Score 46/100 | Question 4/13')).toBeInTheDocument()
})

it('does not show tier action guidance in the compact score panel', () => {
  render(
    <ScorePanel
      input={{
        ...emptyInput,
        clientProfileKey: 'builder_developer_pool_builder_landscaper',
        budgetBand: '50k_plus',
        rcStatus: 'approved_not_required',
        bcStatus: 'approved_not_required',
        buildingStage: 'ready_for_glazing',
        cat4: 'new_build_commercial_fit_out',
        priceSensitivityRead: 'not_price_sensitive',
        decisionMakers: 'decision_maker_confirmed_owner_director',
        leadSource: 'existing_client_referral_repeat_builder_architect',
        paymentHistory: 'always_on_time_good',
        siteAccess: 'easy',
        installationHeight: 'ground_floor_ladder',
      }}
    />,
  )

  expect(screen.getByText('Tier A')).toBeInTheDocument()
  expect(screen.queryByText('Call within 24 hours. Arrange a site meeting. Assign to senior salesperson.')).not.toBeInTheDocument()
})

it('renders all matrix scoring rows and meta lines', () => {
  render(<ScorePanel input={emptyInput} />)
  expect(screen.getByText('Client Type')).toBeInTheDocument()
  expect(screen.getByText('Budget Band')).toBeInTheDocument()
  expect(screen.getByText('Resource Consent')).toBeInTheDocument()
  expect(screen.getByText('Building Consent')).toBeInTheDocument()
  expect(screen.getByText('Installation Height')).toBeInTheDocument()
  expect(screen.getByText('Last update:')).toBeInTheDocument()
  expect(screen.getByText('Follow-up:')).toBeInTheDocument()
})

it('shows dashes for zero-point fields and formats meta dates', () => {
  render(<ScorePanel input={emptyInput} lastUpdated="2026-06-18" followUpDate="2026-07-01" />)
  const dashes = screen.getAllByText('-')
  expect(dashes.length).toBeGreaterThanOrEqual(5)
  expect(screen.getByText('2026-06-18')).toBeInTheDocument()
  expect(screen.getByText('2026-07-01')).toBeInTheDocument()
})
