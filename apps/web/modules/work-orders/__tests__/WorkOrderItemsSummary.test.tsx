import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockBulkApplyOperationalField = vi.hoisted(() => vi.fn())
const mockUpdateOperationalField = vi.hoisted(() => vi.fn())

vi.mock('../actions', () => ({
  updateWorkOrderItemLabelAction: vi.fn(),
  regenerateWorkOrderItemLabelAction: vi.fn(),
  updateWorkOrderItemOperationalFieldAction: mockUpdateOperationalField,
  bulkApplyWorkOrderItemOperationalFieldAction: mockBulkApplyOperationalField,
}))

import { WorkOrderItemsSummary } from '../WorkOrderItemsSummary'
import type { WorkOrderItemSummaryRow } from '../work-order-items'

function workOrderItem(
  item: Partial<WorkOrderItemSummaryRow> & Pick<WorkOrderItemSummaryRow, 'id' | 'itemCode' | 'quantity' | 'originalDescription' | 'lineTotalExcludingGst' | 'generatedLabel' | 'manualLabelOverride' | 'isActive'>,
): WorkOrderItemSummaryRow {
  return {
    workOrderId: 'work-order-1',
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
    ...item,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('WorkOrderItemsSummary', () => {
  it('shows every active ServiceM8 item beneath one parent count', () => {
    render(<WorkOrderItemsSummary items={[
      workOrderItem({
        id: 'item-1',
        itemCode: 'GLASS-001',
        quantity: '1.000',
        originalDescription: 'Shower glass',
        lineTotalExcludingGst: '900.00',
        generatedLabel: null,
        manualLabelOverride: null,
        isActive: true,
      }),
      workOrderItem({
        id: 'item-2',
        itemCode: 'HARDWARE-001',
        quantity: '2.000',
        originalDescription: 'Shower hardware',
        lineTotalExcludingGst: '150.00',
        generatedLabel: null,
        manualLabelOverride: null,
        isActive: true,
      }),
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
      workOrderItem({ id: 'item-active', itemCode: 'GLASS-001', quantity: '1.000', originalDescription: 'Current glass', lineTotalExcludingGst: '900.00', generatedLabel: null, manualLabelOverride: null, isActive: true }),
      workOrderItem({ id: 'item-removed', itemCode: 'OLD-001', quantity: '1.000', originalDescription: 'Removed glass', lineTotalExcludingGst: '800.00', generatedLabel: null, manualLabelOverride: null, isActive: false }),
    ]} />)

    expect(screen.getByText('1 active item')).toBeInTheDocument()
    expect(screen.getByText('Removed glass')).toBeInTheDocument()
    expect(screen.getByText('Removed')).toBeInTheDocument()
  })

  it('keeps immutable source detail in the hover text when ServiceM8 has no line total', () => {
    render(<WorkOrderItemsSummary items={[
      workOrderItem({
        id: 'item-no-total',
        itemCode: 'GLASS-001',
        quantity: '1.000',
        originalDescription: 'Original ServiceM8 glass description',
        lineTotalExcludingGst: null,
        generatedLabel: 'Generated glass label',
        manualLabelOverride: 'Manual production label',
        isActive: true,
      }),
    ]} />)

    expect(screen.getByText('Manual production label').parentElement).toHaveAttribute(
      'title',
      'Original ServiceM8 glass description\nLine total excluding GST: Not available',
    )
  })

  it('shows a truncated source fallback and clear pending state after label generation fails', () => {
    const originalDescription = 'Supply and install a very long frameless shower screen description with dimensions, hardware, finish, and additional production notes'

    render(<WorkOrderItemsSummary items={[workOrderItem({
      id: 'item-pending',
      itemCode: 'GLASS-001',
      quantity: '1.000',
      originalDescription,
      lineTotalExcludingGst: '900.00',
      generatedLabel: null,
      manualLabelOverride: null,
      labelStatus: 'failed',
      isActive: true,
    })]} />)

    expect(screen.getByText(`${originalDescription.slice(0, 77)}...`)).toBeInTheDocument()
    expect(screen.getByText('Label pending')).toBeInTheDocument()
    expect(screen.queryByText(originalDescription)).not.toBeInTheDocument()
  })

  it('keeps a manual label visible when its ServiceM8 source description changed', () => {
    render(<WorkOrderItemsSummary items={[workOrderItem({
      id: 'item-source-changed',
      itemCode: 'GLASS-001',
      quantity: '1.000',
      originalDescription: 'Updated source description',
      lineTotalExcludingGst: '900.00',
      generatedLabel: 'Old generated label',
      manualLabelOverride: 'Staff-approved production label',
      labelStatus: 'source_changed',
      isActive: true,
    })]} />)

    expect(screen.getByText('Staff-approved production label')).toBeInTheDocument()
    expect(screen.getByText('Source description changed')).toBeInTheDocument()
  })

  it('lets manage users edit only the short label and confirms AI regeneration', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<WorkOrderItemsSummary canManage items={[workOrderItem({
      id: 'item-editable',
      itemCode: 'GLASS-001',
      quantity: '2.000',
      originalDescription: 'Immutable ServiceM8 source description',
      lineTotalExcludingGst: '900.00',
      generatedLabel: 'Generated production label',
      manualLabelOverride: null,
      labelStatus: 'generated',
      isActive: true,
    })]} />)

    expect(screen.getByRole('textbox', { name: 'Short label for GLASS-001' })).toHaveValue('Generated production label')
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getByText('Qty 2')).not.toHaveAttribute('contenteditable')
    expect(screen.getByText('GLASS-001')).not.toHaveAttribute('contenteditable')

    fireEvent.submit(screen.getByRole('button', { name: 'Regenerate with AI' }).closest('form')!)
    expect(confirm).toHaveBeenCalledWith('Regenerate this label with AI? This will replace the current label.')

    confirm.mockRestore()
  })

  it('gives manage users independent controls for all eight item operational fields', () => {
    render(<WorkOrderItemsSummary
      canManage
      options={{
        installers: [{ id: 'installer-1', label: 'Install Team' }],
        stages: [{ id: 'stage-1', label: 'Ready to install' }],
        hardwareStatuses: [{ id: 'hardware-1', label: 'Hardware ready' }],
      }}
      items={[{
        id: 'item-operational',
        workOrderId: 'work-order-1',
        itemCode: 'GLASS-001',
        quantity: '1.000',
        originalDescription: 'Shower glass',
        lineTotalExcludingGst: '900.00',
        generatedLabel: 'Shower panel',
        manualLabelOverride: null,
        isActive: true,
        installerId: 'installer-1',
        installerName: 'Install Team',
        stageOptionId: 'stage-1',
        stageName: 'Ready to install',
        hardwareStatusOptionId: 'hardware-1',
        hardwareStatusName: 'Hardware ready',
        maintenanceProgram: true,
        installDate: '2026-07-20',
        dateCompleted: null,
        riskLevel: 'high',
        importance: 'medium',
      }]}
    />)

    for (const label of [
      'Installer for GLASS-001',
      'Stage for GLASS-001',
      'Hardware for GLASS-001',
      'Maintenance Program for GLASS-001',
      'Install date for GLASS-001',
      'Date completed for GLASS-001',
      'Risk for GLASS-001',
      'Importance for GLASS-001',
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  it('shows item operational values without edit or bulk controls for view-only users', () => {
    render(<WorkOrderItemsSummary items={[workOrderItem({
      id: 'item-view-only',
      itemCode: 'GLASS-001',
      quantity: '1.000',
      originalDescription: 'Shower glass',
      lineTotalExcludingGst: '900.00',
      generatedLabel: 'Shower panel',
      manualLabelOverride: null,
      isActive: true,
      installerName: 'Install Team',
      stageName: 'Ready to install',
      hardwareStatusName: 'Hardware ready',
      maintenanceProgram: true,
      installDate: '2026-07-20',
      riskLevel: 'high',
      importance: 'medium',
    })]} />)

    for (const value of ['Install Team', 'Ready to install', 'Hardware ready', 'Yes', '2026-07-20', 'High', 'Medium']) {
      expect(screen.getByText(value)).toBeInTheDocument()
    }
    expect(screen.queryByLabelText('Installer for GLASS-001')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Apply .* to all active items/ })).not.toBeInTheDocument()
  })

  it('confirms a one-time field copy before bulk applying it to active items', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockBulkApplyOperationalField.mockResolvedValue({ changedCount: 2 })

    render(<WorkOrderItemsSummary
      canManage
      options={{
        installers: [{ id: 'installer-1', label: 'Install Team' }],
        stages: [],
        hardwareStatuses: [],
      }}
      items={[{
        id: 'item-source',
        workOrderId: 'work-order-1',
        itemCode: 'GLASS-001',
        quantity: '1.000',
        originalDescription: 'Shower glass',
        lineTotalExcludingGst: '900.00',
        generatedLabel: 'Shower panel',
        manualLabelOverride: null,
        isActive: true,
        installerId: 'installer-1',
        installerName: 'Install Team',
        stageOptionId: null,
        stageName: null,
        hardwareStatusOptionId: null,
        hardwareStatusName: null,
        maintenanceProgram: false,
        installDate: null,
        dateCompleted: null,
        riskLevel: null,
        importance: null,
      }]}
    />)

    fireEvent.click(screen.getByRole('button', { name: 'Apply Installer to all active items' }))

    expect(confirm).toHaveBeenCalledWith(
      'Apply Installer from GLASS-001 to all active items in this Work Order?',
    )
    expect(mockBulkApplyOperationalField).toHaveBeenCalledWith(
      'work-order-1',
      'item-source',
      'installer',
    )
    expect(await screen.findByText('Applied to 2 items')).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('restores only the failed field and offers retry with actionable feedback', async () => {
    mockUpdateOperationalField
      .mockRejectedValueOnce(new Error('Installer could not be saved because the option is no longer active.'))
      .mockResolvedValueOnce({ value: 'installer-2' })

    render(<WorkOrderItemsSummary
      canManage
      options={{
        installers: [
          { id: 'installer-1', label: 'Install Team One' },
          { id: 'installer-2', label: 'Install Team Two' },
        ],
        stages: [{ id: 'stage-1', label: 'Ready to install' }],
        hardwareStatuses: [],
      }}
      items={[{
        id: 'item-save',
        workOrderId: 'work-order-1',
        itemCode: 'GLASS-001',
        quantity: '1.000',
        originalDescription: 'Shower glass',
        lineTotalExcludingGst: '900.00',
        generatedLabel: 'Shower panel',
        manualLabelOverride: null,
        isActive: true,
        installerId: 'installer-1',
        installerName: 'Install Team One',
        stageOptionId: 'stage-1',
        stageName: 'Ready to install',
        hardwareStatusOptionId: null,
        hardwareStatusName: null,
        maintenanceProgram: false,
        installDate: null,
        dateCompleted: null,
        riskLevel: null,
        importance: null,
      }]}
    />)

    const installer = screen.getByLabelText('Installer for GLASS-001')
    const stage = screen.getByLabelText('Stage for GLASS-001')
    fireEvent.change(installer, { target: { value: 'installer-2' } })

    expect(screen.getByText('Saving')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Installer could not be saved because the option is no longer active.',
    )
    expect(installer).toHaveValue('installer-1')
    expect(stage).toHaveValue('stage-1')

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument())
    expect(installer).toHaveValue('installer-2')
    expect(mockUpdateOperationalField).toHaveBeenCalledTimes(2)
  })
})
