import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LeadsListFilters } from '../queries'
import type { TablePrefs } from '../table-prefs-shared'
import { LeadsTableControls } from '../LeadsTableControls'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('../actions', () => ({
  batchDeleteLeadsAction: vi.fn(),
}))

vi.mock('../table-prefs-actions', () => ({
  saveTablePrefs: vi.fn(),
}))

const filters: LeadsListFilters = {
  q: '',
  tier: 'all',
  sm8: 'all',
  date: 'all',
  page: 1,
  size: 10,
  sortColumn: 'createdAt',
  sortDir: 'desc',
}

const prefs: TablePrefs = {
  columns: [
    { key: 'client', visible: true },
    { key: 'date', visible: true },
    { key: 'address', visible: false },
  ],
  sortColumn: 'createdAt',
  sortDir: 'desc',
}

const rows = [{
  id: 'lead-1',
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  clientName: 'Ada Lovelace',
  companyName: 'Analytical Glass',
  location: 'Hidden Road',
  projectType: 'Frameless shower',
  tier: 'A',
  seedScore: 92,
  servicem8JobUuid: null,
  servicem8JobNumber: null,
  syncStatus: 'pending_sync',
  completeness: 80,
  rcStatus: 'Required',
  bcStatus: 'Not required',
  buildingStage: 'Planning',
  followUpDate: '2026-06-20',
  updatedAt: new Date('2026-06-02T00:00:00.000Z'),
  aiSuggestion: 'Call this lead tomorrow',
}]

describe('LeadsTableControls', () => {
  it('renders visible columns in preference order and hides hidden columns', () => {
    render(
      <LeadsTableControls
        filters={filters}
        rows={rows}
        total={1}
        pageCount={1}
        isAdmin={false}
        prefs={prefs}
      />,
    )

    const table = screen.getByRole('table')
    const headers = within(table).getAllByRole('columnheader').map((header) => header.textContent)

    expect(headers).toEqual(['Client', 'Date (desc)'])
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.queryByText('Job Address')).not.toBeInTheDocument()
    expect(screen.queryByText('Hidden Road')).not.toBeInTheDocument()
  })
})
