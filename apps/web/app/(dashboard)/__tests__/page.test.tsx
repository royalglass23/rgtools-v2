import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => vi.fn())
const redirectMock = vi.hoisted(() => vi.fn())
const userCanAccessSlugMock = vi.hoisted(() => vi.fn())
const getActiveScoringOptionListsMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('@/lib/access-db', () => ({ userCanAccessSlug: userCanAccessSlugMock }))
vi.mock('@/modules/dashboard/config', () => ({ getDashboardTables: vi.fn(async () => []) }))
vi.mock('@/modules/dashboard/tables', () => ({ getTableMeta: vi.fn() }))
vi.mock('@/modules/dashboard/registry', () => ({ SERVER_TABLES: {} }))
vi.mock('@/modules/dashboard/kpis', () => ({
  getDashboardActionCounts: vi.fn(async () => ({
    staleLeads: 0,
    unsynced: 0,
    expiringSoon: 0,
    neverOpened: 0,
    forwarding: 0,
    goneCold: 0,
  })),
  getDashboardChartData: vi.fn(async () => ({ leadsPerWeek: [], pipelineByWeek: [] })),
  getDashboardKpis: vi.fn(async () => ({
    pipelineValue: 0,
    conversionRate: 0,
    volumeTrend: 0,
    leadVolume: 0,
    pipelineSparkline: [],
    conversionSparkline: [],
    volumeSparkline: [],
  })),
}))
vi.mock('@/modules/dashboard/ChartSection', () => ({ ChartSection: () => <div data-testid="chart-section" /> }))
vi.mock('@/modules/dashboard/SparkLine', () => ({ SparkLine: () => <div data-testid="sparkline" /> }))
vi.mock('@/modules/lead-intake/scoring/config-options', () => ({
  getActiveScoringOptionLists: getActiveScoringOptionListsMock,
}))
vi.mock('@/modules/dashboard/QuickCaptureForm', () => ({
  QuickCaptureForm: () => <div data-testid="quick-capture" />,
}))

import DashboardPage from '../page'

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: 'user-1', role: 'staff' } })
  getActiveScoringOptionListsMock.mockResolvedValue({
    categories: { '10': { options: [{ key: 'ready_for_glazing', label: 'Ready for Glazing' }] } },
  })
})

describe('DashboardPage quick capture access', () => {
  it('hides Quick Capture for users without lead-intake access', async () => {
    userCanAccessSlugMock.mockResolvedValue(false)

    render(await DashboardPage({ searchParams: Promise.resolve({}) }))

    expect(screen.queryByTestId('quick-capture')).not.toBeInTheDocument()
    expect(getActiveScoringOptionListsMock).not.toHaveBeenCalled()
  })

  it('shows Quick Capture for users with lead-intake access', async () => {
    userCanAccessSlugMock.mockResolvedValue(true)

    render(await DashboardPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByTestId('quick-capture')).toBeInTheDocument()
    expect(userCanAccessSlugMock).toHaveBeenCalledWith('user-1', 'lead-intake')
  })
})
