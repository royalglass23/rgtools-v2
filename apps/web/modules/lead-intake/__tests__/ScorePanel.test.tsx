import { render, screen } from '@testing-library/react'
import { ScorePanel } from '../ScorePanel'
import type { ScoringConfig } from '@/modules/lead-intake/scoring/score-lead'

const config: ScoringConfig = {
  categories: {
    '1': { label: 'Customer profile', max: 20, options: { repeat_builder: 19, owner_occupier: 9 } },
    '2': { label: 'Project value', max: 20, options: { ge_50k: 19, lt_2k: 3 } },
    '8': { label: 'Resource Consent', max: 7, options: { approved: 7, under_review: 4 } },
    '9': { label: 'Building Consent', max: 6, options: { not_required: 6, not_applied: 1 } },
    '10': { label: 'Building Stage', max: 6, options: { fitout_complete: 6, planning: 1 } },
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
  rcStatus: '',
  bcStatus: '',
  buildingStage: '',
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

it('renders normal scoring rows and the consent readiness group', () => {
  render(<ScorePanel input={emptyInput} config={config} />)
  expect(screen.getByText('Customer profile')).toBeInTheDocument()
  expect(screen.getByText('Project value')).toBeInTheDocument()
  expect(screen.getByText('Consent readiness')).toBeInTheDocument()
  expect(screen.getByText('Resource Consent')).toBeInTheDocument()
  expect(screen.getByText('Building Consent')).toBeInTheDocument()
  expect(screen.getByText('Building Stage')).toBeInTheDocument()
})

it('shows dashes for zero-point categories and meta lines by default', () => {
  render(<ScorePanel input={emptyInput} config={config} />)
  const dashes = screen.getAllByText('—')
  expect(dashes.length).toBeGreaterThanOrEqual(5)
  expect(screen.getByText('Last update:')).toBeInTheDocument()
  expect(screen.getByText('Follow-up:')).toBeInTheDocument()
})

it('groups RC, BC, and Building Stage into a combined consent readiness score with meta lines', () => {
  render(
    <ScorePanel
      input={{ ...emptyInput, rcStatus: 'approved', bcStatus: 'not_required', buildingStage: 'fitout_complete' }}
      config={config}
      lastUpdated="2026-06-18"
      followUpDate="2026-07-01"
    />,
  )
  expect(screen.getByText('Consent readiness')).toBeInTheDocument()
  expect(screen.getAllByText('19')).toHaveLength(2)
  expect(screen.getByText('/ 19')).toBeInTheDocument()
  expect(screen.getByText('Last update:')).toBeInTheDocument()
  expect(screen.getByText('2026-06-18')).toBeInTheDocument()
  expect(screen.getByText('Follow-up:')).toBeInTheDocument()
  expect(screen.getByText('2026-07-01')).toBeInTheDocument()
})
