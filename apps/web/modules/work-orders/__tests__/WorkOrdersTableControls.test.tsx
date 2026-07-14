import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { WorkOrdersTableControls } from '../WorkOrdersTableControls'
import type { WorkOrderListFilters } from '../list-filters'
import type { WorkOrderRow } from '../queries'
import type { WorkOrderSummaryFieldConfig } from '../summary-config'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('../actions', () => ({ batchDeleteWorkOrdersAction: vi.fn() }))

const filters: WorkOrderListFilters = {
  q: '',
  current: 'current',
  risk: 'all',
  importance: 'all',
  stage: 'all',
  hardware: 'all',
  maintenanceProgram: 'all',
  showRemovedItems: false,
  sort: 'lead_score_desc',
  page: 1,
  size: 5,
}

describe('WorkOrdersTableControls', () => {
  it('starts every parent expanded and collapses each Work Order independently', () => {
    renderDashboard([
      workOrder({ id: 'job-1', jobNumber: 'R100', clientName: 'Aroha Glass', leadScore: 91, itemLabel: 'Shower glass' }),
      workOrder({ id: 'job-2', jobNumber: 'R200', clientName: 'Kauri Homes', leadScore: null, itemLabel: 'Balustrade glass' }),
    ])

    const firstGroup = screen.getByRole('group', { name: 'Work Order R100' })
    const secondGroup = screen.getByRole('group', { name: 'Work Order R200' })

    expect(within(firstGroup).getByText('Aroha Glass')).toBeInTheDocument()
    expect(within(firstGroup).getByText('10 Queen Street')).toBeInTheDocument()
    expect(within(firstGroup).getByText('1 active item')).toBeInTheDocument()
    expect(within(firstGroup).getByText('Lead Score 91')).toBeInTheDocument()
    expect(within(firstGroup).getByText('Shower glass')).toBeVisible()
    expect(within(secondGroup).getByText('Balustrade glass')).toBeVisible()

    fireEvent.click(within(firstGroup).getByRole('button', { name: 'Collapse Work Order R100' }))

    expect(within(firstGroup).getByRole('button', { name: 'Expand Work Order R100' })).toHaveAttribute('aria-expanded', 'false')
    expect(within(firstGroup).queryByText('Shower glass')).not.toBeInTheDocument()
    expect(within(secondGroup).getByText('Balustrade glass')).toBeVisible()
  })

  it('keeps ServiceM8 item values read-only and exposes immutable hover detail', () => {
    renderDashboard([
      workOrder({ id: 'job-1', jobNumber: 'R100', clientName: 'Aroha Glass', leadScore: 91, itemLabel: 'Shower glass' }),
    ])

    const itemList = screen.getByRole('region', { name: 'Work Order items' })
    expect(within(itemList).getByText('Qty 1')).toBeInTheDocument()
    expect(within(itemList).getByText('GLASS-01')).toBeInTheDocument()
    const hoverCell = within(itemList).getByText('Shower glass').parentElement
    expect(hoverCell).toHaveAttribute(
      'title',
      'Shower glass full ServiceM8 description\nLine total excluding GST: $1250.00',
    )
    expect(within(itemList).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(itemList).queryByRole('button')).not.toBeInTheDocument()
  })

  it('offers 5, 10, 20 and 50 parent jobs per page and resets page size changes to page one', () => {
    renderDashboard([
      workOrder({ id: 'job-1', jobNumber: 'R100', clientName: 'Aroha Glass', leadScore: 91, itemLabel: 'Shower glass' }),
    ])

    const pageSize = screen.getByRole('combobox', { name: 'Page size' })
    expect(within(pageSize).getAllByRole('option').map((option) => option.textContent)).toEqual(['5', '10', '20', '50'])
    expect(pageSize).toHaveValue('5')
    expect(pageSize.closest('form')?.querySelector('input[name="page"]')).toHaveValue('1')
    expect(screen.getByText('Page 1 of 1').parentElement).toHaveClass('justify-center')
    expect(pageSize.closest('div')).toHaveClass('justify-end')
  })

  it('renders operational ownership from items without showing legacy parent values', () => {
    const row = workOrder({
      id: 'job-1',
      jobNumber: 'R100',
      clientName: 'Aroha Glass',
      leadScore: 91,
      itemLabel: 'Shower glass',
    })
    row.installerName = 'Legacy parent installer'
    row.items[0].installerName = 'Item installer'

    renderDashboard([row], [{
      id: 'installer',
      label: 'Installer',
      source: 'rg',
      visible: true,
      filterable: false,
      order: 1,
    }])

    expect(screen.getByText('Item installer')).toBeInTheDocument()
    expect(screen.queryByText('Legacy parent installer')).not.toBeInTheDocument()
  })
})

function renderDashboard(rows: WorkOrderRow[], fields: WorkOrderSummaryFieldConfig[] = []) {
  return render(
    <WorkOrdersTableControls
      rows={rows}
      filters={filters}
      fields={fields}
      options={{ installers: [], stages: [], hardwareStatuses: [] }}
      total={rows.length}
      pageCount={1}
    />,
  )
}

function workOrder({
  id,
  jobNumber,
  clientName,
  leadScore,
  itemLabel,
}: {
  id: string
  jobNumber: string
  clientName: string
  leadScore: number | null
  itemLabel: string
}): WorkOrderRow {
  return {
    id,
    servicem8Status: 'Work Order',
    isCurrent: true,
    jobNumber,
    jobAddress: '10 Queen Street',
    jobDescription: null,
    clientName,
    companyName: null,
    leadScore,
    installerName: null,
    stageName: null,
    hardwareStatusName: null,
    maintenanceProgram: false,
    installDate: null,
    dateCompleted: null,
    riskLevel: null,
    importance: null,
    aiSuggestion: null,
    aiSuggestionAt: null,
    clientContextSummary: null,
    clientApproachNote: null,
    updatedAt: new Date('2026-07-14T00:00:00Z'),
    activeItemCount: 1,
    items: [{
      id: `${id}-item`,
      workOrderId: id,
      itemCode: 'GLASS-01',
      quantity: '1.000',
      originalDescription: `${itemLabel} full ServiceM8 description`,
      lineTotalExcludingGst: '1250.00',
      generatedLabel: itemLabel,
      manualLabelOverride: null,
      isActive: true,
      installerId: null,
      installerName: null,
      stageOptionId: null,
      stageName: null,
      hardwareStatusOptionId: null,
      hardwareStatusName: null,
      maintenanceProgram: false,
      installDate: null,
      dateCompleted: null,
      riskLevel: null,
      importance: null,
    }],
  }
}
