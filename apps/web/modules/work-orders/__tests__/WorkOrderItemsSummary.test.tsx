import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WorkOrderItemsSummary } from '../WorkOrderItemsSummary'

describe('WorkOrderItemsSummary', () => {
  it('shows every active ServiceM8 item beneath one parent count', () => {
    render(<WorkOrderItemsSummary items={[
      {
        id: 'item-1',
        itemCode: 'GLASS-001',
        quantity: '1.000',
        originalDescription: 'Shower glass',
        lineTotalExcludingGst: '900.00',
        generatedLabel: null,
        manualLabelOverride: null,
        isActive: true,
      },
      {
        id: 'item-2',
        itemCode: 'HARDWARE-001',
        quantity: '2.000',
        originalDescription: 'Shower hardware',
        lineTotalExcludingGst: '150.00',
        generatedLabel: null,
        manualLabelOverride: null,
        isActive: true,
      },
    ]} />)

    expect(screen.getByText('2 active items')).toBeInTheDocument()
    expect(screen.getByText('GLASS-001')).toBeInTheDocument()
    expect(screen.getByText('Shower glass')).toBeInTheDocument()
    expect(screen.getByText('HARDWARE-001')).toBeInTheDocument()
    expect(screen.getByText('Shower hardware')).toBeInTheDocument()
  })

  it('keeps an empty Work Order visible without inventing a child item', () => {
    render(<WorkOrderItemsSummary items={[]} />)

    expect(screen.getByText('0 active items')).toBeInTheDocument()
    expect(screen.getByText('No items synced from ServiceM8 yet')).toBeInTheDocument()
  })

  it('marks removed rows while keeping the active count unchanged', () => {
    render(<WorkOrderItemsSummary items={[
      { id: 'item-active', itemCode: 'GLASS-001', quantity: '1.000', originalDescription: 'Current glass', lineTotalExcludingGst: '900.00', generatedLabel: null, manualLabelOverride: null, isActive: true },
      { id: 'item-removed', itemCode: 'OLD-001', quantity: '1.000', originalDescription: 'Removed glass', lineTotalExcludingGst: '800.00', generatedLabel: null, manualLabelOverride: null, isActive: false },
    ]} />)

    expect(screen.getByText('1 active item')).toBeInTheDocument()
    expect(screen.getByText('Removed glass')).toBeInTheDocument()
    expect(screen.getByText('Removed')).toBeInTheDocument()
  })

  it('keeps immutable source detail in the hover text when ServiceM8 has no line total', () => {
    render(<WorkOrderItemsSummary items={[
      {
        id: 'item-no-total',
        itemCode: 'GLASS-001',
        quantity: '1.000',
        originalDescription: 'Original ServiceM8 glass description',
        lineTotalExcludingGst: null,
        generatedLabel: 'Generated glass label',
        manualLabelOverride: 'Manual production label',
        isActive: true,
      },
    ]} />)

    expect(screen.getByText('Manual production label').parentElement).toHaveAttribute(
      'title',
      'Original ServiceM8 glass description\nLine total excluding GST: Not available',
    )
  })
})
