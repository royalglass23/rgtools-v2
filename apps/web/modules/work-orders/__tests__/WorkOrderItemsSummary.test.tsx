import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../actions', () => ({
  updateWorkOrderItemLabelAction: vi.fn(),
  regenerateWorkOrderItemLabelAction: vi.fn(),
}))

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

  it('shows a truncated source fallback and clear pending state after label generation fails', () => {
    const originalDescription = 'Supply and install a very long frameless shower screen description with dimensions, hardware, finish, and additional production notes'

    render(<WorkOrderItemsSummary items={[{
      id: 'item-pending',
      itemCode: 'GLASS-001',
      quantity: '1.000',
      originalDescription,
      lineTotalExcludingGst: '900.00',
      generatedLabel: null,
      manualLabelOverride: null,
      labelStatus: 'failed',
      isActive: true,
    }]} />)

    expect(screen.getByText(`${originalDescription.slice(0, 77)}...`)).toBeInTheDocument()
    expect(screen.getByText('Label pending')).toBeInTheDocument()
    expect(screen.queryByText(originalDescription)).not.toBeInTheDocument()
  })

  it('keeps a manual label visible when its ServiceM8 source description changed', () => {
    render(<WorkOrderItemsSummary items={[{
      id: 'item-source-changed',
      itemCode: 'GLASS-001',
      quantity: '1.000',
      originalDescription: 'Updated source description',
      lineTotalExcludingGst: '900.00',
      generatedLabel: 'Old generated label',
      manualLabelOverride: 'Staff-approved production label',
      labelStatus: 'source_changed',
      isActive: true,
    }]} />)

    expect(screen.getByText('Staff-approved production label')).toBeInTheDocument()
    expect(screen.getByText('Source description changed')).toBeInTheDocument()
  })

  it('lets manage users edit only the short label and confirms AI regeneration', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<WorkOrderItemsSummary canManage items={[{
      id: 'item-editable',
      itemCode: 'GLASS-001',
      quantity: '2.000',
      originalDescription: 'Immutable ServiceM8 source description',
      lineTotalExcludingGst: '900.00',
      generatedLabel: 'Generated production label',
      manualLabelOverride: null,
      labelStatus: 'generated',
      isActive: true,
    }]} />)

    expect(screen.getByRole('textbox', { name: 'Short label for GLASS-001' })).toHaveValue('Generated production label')
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getByText('Qty 2')).not.toHaveAttribute('contenteditable')
    expect(screen.getByText('GLASS-001')).not.toHaveAttribute('contenteditable')

    fireEvent.submit(screen.getByRole('button', { name: 'Regenerate with AI' }).closest('form')!)
    expect(confirm).toHaveBeenCalledWith('Regenerate this label with AI? This will replace the current label.')

    confirm.mockRestore()
  })
})
