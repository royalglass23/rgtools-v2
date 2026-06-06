import { render, screen } from '@testing-library/react'
import { ScorePanel } from '../ScorePanel'
import type { ScoringConfig } from '@/lib/scoring/score-lead'

const config: ScoringConfig = {
  categories: {
    '1': { label: 'Customer profile', max: 20, options: { repeat_builder: 19, owner_occupier: 9 } },
    '2': { label: 'Project value', max: 20, options: { ge_50k: 19, lt_2k: 3 } },
  },
  bonuses: {},
  penalties: {},
  tiers: { A: 75, B: 55, C: 30 },
}

const emptyInput = {
  clientProfileKey: '',
  budgetBand: '',
  cat4: '',
  timeline: '',
  consentStatus: '',
  decisionMakers: '',
  priceSensitivityRead: '',
}

it('shows Tier D and score 0 when no fields are filled', () => {
  render(<ScorePanel input={emptyInput} config={config} />)
  expect(screen.getByText('Tier D')).toBeInTheDocument()
  expect(screen.getByText('0')).toBeInTheDocument()
})

it('shows correct tier and score when fields are filled', () => {
  render(
    <ScorePanel
      input={{ ...emptyInput, clientProfileKey: 'repeat_builder', budgetBand: 'ge_50k' }}
      config={config}
    />,
  )
  expect(screen.getByText('Tier C')).toBeInTheDocument()
  expect(screen.getByText('38')).toBeInTheDocument()
})

it('renders a row for every scoring category', () => {
  render(<ScorePanel input={emptyInput} config={config} />)
  expect(screen.getByText('Customer profile')).toBeInTheDocument()
  expect(screen.getByText('Project value')).toBeInTheDocument()
})

it('shows dashes for zero-point categories', () => {
  render(<ScorePanel input={emptyInput} config={config} />)
  const dashes = screen.getAllByText('—')
  expect(dashes).toHaveLength(2)
})

it('uses consentStatus over timeline for cat3 when both are set', () => {
  const cat3Config: ScoringConfig = {
    categories: {
      '3': { label: 'Consent', max: 20, options: { approved: 19, enquiry_only: 2 } },
    },
    bonuses: {},
    penalties: {},
    tiers: { A: 75, B: 55, C: 30 },
  }
  render(
    <ScorePanel
      input={{ ...emptyInput, consentStatus: 'approved', timeline: 'enquiry_only' }}
      config={cat3Config}
    />,
  )
  const nineTeens = screen.getAllByText('19')
  expect(nineTeens).toHaveLength(2)
  expect(nineTeens[0]).toBeInTheDocument()
})
