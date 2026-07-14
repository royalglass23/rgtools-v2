import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAssertCanManage = vi.hoisted(() => vi.fn())
const mockAssertCanConfigure = vi.hoisted(() => vi.fn())
const mockRevalidatePath = vi.hoisted(() => vi.fn())
const mockRedirect = vi.hoisted(() => vi.fn())
const mockInsert = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
const mockSelect = vi.hoisted(() => vi.fn())
const mockDelete = vi.hoisted(() => vi.fn())
const mockTransaction = vi.hoisted(() => vi.fn())
const mockAuth = vi.hoisted(() => vi.fn())
const mockLogAudit = vi.hoisted(() => vi.fn())
const mockGenerateWorkOrderItemLabel = vi.hoisted(() => vi.fn())

vi.mock('../permissions', () => ({
  assertCurrentUserCanConfigureWorkOrders: mockAssertCanConfigure,
  assertCurrentUserCanManageWorkOrders: mockAssertCanManage,
}))

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/db', () => ({
  db: {
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect,
    delete: mockDelete,
    transaction: mockTransaction,
  },
}))
vi.mock('@/lib/audit-db', () => ({ logAudit: mockLogAudit }))
vi.mock('@/lib/servicem8/client', () => ({
  createServiceM8RequestFromEnv: vi.fn(),
}))
vi.mock('../item-labels', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../item-labels')>()
  return {
    ...actual,
    generateWorkOrderItemLabel: mockGenerateWorkOrderItemLabel,
  }
})

import {
  addWorkOrderTimelineNoteAction,
  batchDeleteWorkOrdersAction,
  bulkApplyWorkOrderItemOperationalFieldAction,
  createWorkOrderInstallerAction,
  deactivateWorkOrderInstallerAction,
  generateWorkOrderAiSuggestionAction,
  markWorkOrderEventClientVisibleCandidateAction,
  refreshWorkOrdersAction,
  regenerateWorkOrderItemLabelAction,
  saveWorkOrderBillingExclusionsAction,
  updateWorkOrderItemOperationalFieldAction,
  updateWorkOrderItemLabelAction,
} from '../actions'

beforeEach(() => {
  vi.clearAllMocks()
  mockAssertCanManage.mockResolvedValue(undefined)
  mockAssertCanConfigure.mockResolvedValue(undefined)
  mockUpdate.mockReturnValue({
    set: vi.fn(() => ({
      where: vi.fn(async () => []),
    })),
  })
  mockSelect.mockReturnValue({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => [{
          installerId: null,
          stageOptionId: null,
          hardwareStatusOptionId: null,
          maintenanceProgram: false,
          installDate: null,
          dateCompleted: null,
          riskLevelOverride: null,
          importanceOverride: null,
        }]),
      })),
    })),
  })
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
  mockGenerateWorkOrderItemLabel.mockResolvedValue('Regenerated production label')
  mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) => callback({
    delete: mockDelete,
  }))
  mockDelete.mockReturnValue({
    where: vi.fn(async () => []),
  })
})

function operationalItem(id: string, isActive: boolean, installerId: string | null) {
  return {
    id,
    workOrderId: 'work-order-1',
    isActive,
    installerId,
    stageOptionId: null,
    hardwareStatusOptionId: null,
    maintenanceProgram: false,
    installDate: null,
    dateCompleted: null,
    riskLevelOverride: null,
    importanceOverride: null,
  }
}

describe('work order action permissions', () => {
  it('requires manage access before refreshing Work Orders from ServiceM8', async () => {
    mockAssertCanManage.mockRejectedValue(new Error('Forbidden: Work Orders manage access is required.'))

    await expect(refreshWorkOrdersAction()).rejects.toThrow('Forbidden: Work Orders manage access is required.')
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('requires manage access before updating an operational Work Order Item field', async () => {
    mockAssertCanManage.mockRejectedValue(new Error('Forbidden: Work Orders manage access is required.'))

    await expect(updateWorkOrderItemOperationalFieldAction('item-1', 'risk', 'high')).rejects.toThrow(
      'Forbidden: Work Orders manage access is required.',
    )
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('updates one Work Order Item field and records its item-level audit event', async () => {
    const updateSet = vi.fn(() => ({ where: vi.fn(async () => []) }))
    const insertValues = vi.fn(async () => [])
    mockTransaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<void>) => callback({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{
              id: 'item-1',
              workOrderId: 'work-order-1',
              isActive: true,
              installerId: '11111111-1111-4111-8111-111111111111',
            }]),
          })),
        })),
      })),
      update: vi.fn(() => ({ set: updateSet })),
      insert: vi.fn(() => ({ values: insertValues })),
    }))

    await updateWorkOrderItemOperationalFieldAction(
      'item-1',
      'installer',
      '22222222-2222-4222-8222-222222222222',
    )

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      installerId: '22222222-2222-4222-8222-222222222222',
      updatedAt: expect.any(Date),
    }))
    expect(updateSet).not.toHaveBeenCalledWith(expect.objectContaining({
      stageOptionId: expect.anything(),
    }))
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      workOrderId: 'work-order-1',
      workOrderItemId: 'item-1',
      actorId: 'user-1',
      fieldName: 'item_installer_changed',
      previousValue: '11111111-1111-4111-8111-111111111111',
      newValue: '22222222-2222-4222-8222-222222222222',
      isClientVisibleCandidate: false,
    }))
  })

  it('rejects an invalid Work Order Item date before starting a write transaction', async () => {
    await expect(
      updateWorkOrderItemOperationalFieldAction('item-1', 'installDate', '14/07/2026'),
    ).rejects.toThrow('Install date must use YYYY-MM-DD.')

    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('bulk applies one field only to changed active sibling items and audits each change', async () => {
    const updateSet = vi.fn(() => ({ where: vi.fn(async () => []) }))
    const insertValues = vi.fn(async () => [])
    mockTransaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<void>) => callback({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => [
            operationalItem('item-source', true, '11111111-1111-4111-8111-111111111111'),
            operationalItem('item-active-change', true, '22222222-2222-4222-8222-222222222222'),
            operationalItem('item-active-same', true, '11111111-1111-4111-8111-111111111111'),
            operationalItem('item-removed', false, '33333333-3333-4333-8333-333333333333'),
          ]),
        })),
      })),
      update: vi.fn(() => ({ set: updateSet })),
      insert: vi.fn(() => ({ values: insertValues })),
    }))

    const result = await bulkApplyWorkOrderItemOperationalFieldAction(
      'work-order-1',
      'item-source',
      'installer',
    )

    expect(result).toEqual({ changedCount: 1 })
    expect(updateSet).toHaveBeenCalledTimes(1)
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      installerId: '11111111-1111-4111-8111-111111111111',
    }))
    expect(insertValues).toHaveBeenCalledWith([
      expect.objectContaining({
        workOrderId: 'work-order-1',
        workOrderItemId: 'item-active-change',
        actorId: 'user-1',
        fieldName: 'item_installer_changed',
        previousValue: '22222222-2222-4222-8222-222222222222',
        newValue: '11111111-1111-4111-8111-111111111111',
      }),
    ])
  })

  it('lets an authorised user replace only the Work Order Item short label', async () => {
    const set = vi.fn(() => ({ where: vi.fn(async () => []) }))
    mockUpdate.mockReturnValue({ set })
    mockSelect.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{
            id: 'item-1',
            workOrderId: 'work-order-1',
            originalDescription: 'Immutable ServiceM8 source description',
            generatedLabel: 'Generated label',
            manualLabelOverride: null,
          }]),
        })),
      })),
    })
    const formData = new FormData()
    formData.set('label', 'Staff corrected label')

    await updateWorkOrderItemLabelAction('item-1', formData)

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      manualLabelOverride: 'Staff corrected label',
      labelStatus: 'manual',
      sourceDescriptionFingerprint: expect.any(String),
    }))
    expect(set).not.toHaveBeenCalledWith(expect.objectContaining({
      originalDescription: expect.anything(),
      itemCode: expect.anything(),
      quantity: expect.anything(),
    }))
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'user-1',
      entityType: 'work_order_item',
      action: 'work_order_item.label_manually_updated',
      targetId: 'item-1',
    }))
  })

  it('requires manage access before manually changing a Work Order Item label', async () => {
    mockAssertCanManage.mockRejectedValue(new Error('Forbidden: Work Orders manage access is required.'))
    const formData = new FormData()
    formData.set('label', 'Unauthorised label')

    await expect(updateWorkOrderItemLabelAction('item-1', formData)).rejects.toThrow(
      'Forbidden: Work Orders manage access is required.',
    )

    expect(mockSelect).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects an empty manual label before reading or changing the item', async () => {
    const formData = new FormData()
    formData.set('label', '   ')

    await expect(updateWorkOrderItemLabelAction('item-1', formData)).rejects.toThrow(
      'Work Order Item label is required.',
    )

    expect(mockSelect).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('deliberately replaces a manual label when an authorised user regenerates with AI', async () => {
    const set = vi.fn(() => ({ where: vi.fn(async () => []) }))
    mockUpdate.mockReturnValue({ set })
    mockSelect.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{
            id: 'item-1',
            workOrderId: 'work-order-1',
            originalDescription: 'Current immutable ServiceM8 description',
            generatedLabel: 'Old generated label',
            manualLabelOverride: 'Staff-approved label',
          }]),
        })),
      })),
    })

    await regenerateWorkOrderItemLabelAction('item-1')

    expect(mockGenerateWorkOrderItemLabel).toHaveBeenCalledWith('Current immutable ServiceM8 description')
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      generatedLabel: 'Regenerated production label',
      manualLabelOverride: null,
      labelStatus: 'generated',
      sourceDescriptionFingerprint: expect.any(String),
    }))
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'work_order_item.label_regenerated',
      detail: expect.objectContaining({
        previousLabel: 'Staff-approved label',
        newLabel: 'Regenerated production label',
      }),
    }))
  })

  it('requires manage access before regenerating a Work Order Item label', async () => {
    mockAssertCanManage.mockRejectedValue(new Error('Forbidden: Work Orders manage access is required.'))

    await expect(regenerateWorkOrderItemLabelAction('item-1')).rejects.toThrow(
      'Forbidden: Work Orders manage access is required.',
    )

    expect(mockSelect).not.toHaveBeenCalled()
    expect(mockGenerateWorkOrderItemLabel).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('requires manage access before bulk deleting Work Orders', async () => {
    mockAssertCanManage.mockRejectedValue(new Error('Forbidden: Work Orders manage access is required.'))
    const formData = new FormData()
    formData.append('workOrderId', 'work-order-1')

    await expect(batchDeleteWorkOrdersAction(formData)).rejects.toThrow(
      'Forbidden: Work Orders manage access is required.',
    )

    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('lets manage users bulk delete selected Work Orders', async () => {
    const formData = new FormData()
    formData.append('workOrderId', 'work-order-1')
    formData.append('workOrderId', 'work-order-2')

    await batchDeleteWorkOrdersAction(formData)

    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'user-1',
      entityType: 'work_order',
      action: 'work_order.deleted',
      targetId: 'work-order-1',
      detail: { batch: true },
    }), expect.anything())
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      targetId: 'work-order-2',
    }), expect.anything())
    expect(mockRevalidatePath).toHaveBeenCalledWith('/')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/work-orders')
  })

  it('requires manage access before marking timeline entries as client-visible candidates', async () => {
    mockAssertCanManage.mockRejectedValue(new Error('Forbidden: Work Orders manage access is required.'))
    const formData = new FormData()
    formData.set('portalTitle', 'Installation booked')
    formData.set('portalMessage', 'Your installation has been booked for Tuesday.')

    await expect(markWorkOrderEventClientVisibleCandidateAction('event-1', formData)).rejects.toThrow(
      'Forbidden: Work Orders manage access is required.',
    )
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('requires a customer-safe title and message before marking a timeline entry visible to clients', async () => {
    const formData = new FormData()
    formData.set('portalTitle', 'Installation booked')
    formData.set('portalMessage', '   ')

    await expect(markWorkOrderEventClientVisibleCandidateAction('event-1', formData)).rejects.toThrow(
      'Client-visible timeline updates need a customer-safe title and message.',
    )
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('stores portal-safe timeline wording separately from internal audit details', async () => {
    const set = vi.fn(() => ({ where: vi.fn(async () => []) }))
    mockUpdate.mockReturnValue({ set })
    const formData = new FormData()
    formData.set('portalTitle', 'Installation booked')
    formData.set('portalMessage', 'Your installation has been booked for Tuesday.')

    await markWorkOrderEventClientVisibleCandidateAction('event-1', formData)

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      isClientVisibleCandidate: true,
      portalTitle: 'Installation booked',
      portalMessage: 'Your installation has been booked for Tuesday.',
      portalMarkedBy: 'user-1',
    }))
    expect(set).not.toHaveBeenCalledWith(expect.objectContaining({
      note: expect.anything(),
      fieldName: expect.anything(),
      newValue: expect.anything(),
      previousValue: expect.anything(),
    }))
    expect(mockRevalidatePath).toHaveBeenCalledWith('/work-orders')
  })

  it('requires configuration access before changing Work Order option lists', async () => {
    mockAssertCanConfigure.mockRejectedValue(new Error('Forbidden: Work Orders configuration access is required.'))
    const formData = new FormData()
    formData.set('displayName', 'Install team')

    await expect(createWorkOrderInstallerAction(formData)).rejects.toThrow(
      'Forbidden: Work Orders configuration access is required.',
    )
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('requires configuration access before changing billing exclusions', async () => {
    mockAssertCanConfigure.mockRejectedValue(new Error('Forbidden: Work Orders configuration access is required.'))
    const formData = new FormData()
    formData.set('billingExclusions', 'invoice\ndeposit')

    await expect(saveWorkOrderBillingExclusionsAction(formData)).rejects.toThrow(
      'Forbidden: Work Orders configuration access is required.',
    )
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('prevents duplicate option names by normalized-name comparison instead of silently reusing them', async () => {
    const onConflictDoNothing = vi.fn(async () => ({ rowCount: 0 }))
    const values = vi.fn(() => ({ onConflictDoNothing }))
    mockInsert.mockReturnValue({ values })
    const formData = new FormData()
    formData.set('displayName', '  Install   Team  ')

    await createWorkOrderInstallerAction(formData)

    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      displayName: 'Install   Team',
      normalizedName: 'install team',
      isActive: true,
      createdBy: 'user-1',
    }))
    expect(onConflictDoNothing).toHaveBeenCalled()
  })

  it('lets configuration users deactivate options without deleting historical references', async () => {
    const set = vi.fn(() => ({ where: vi.fn(async () => []) }))
    mockUpdate.mockReturnValue({ set })

    await deactivateWorkOrderInstallerAction('installer-1')

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      isActive: false,
      archivedAt: expect.any(Date),
    }))
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/work-orders')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/work-orders')
  })

  it('lets manage users add internal timeline notes without changing structured fields', async () => {
    const insertValues = vi.fn(async () => [])
    mockInsert.mockReturnValue({ values: insertValues })
    const formData = new FormData()
    formData.set('note', 'Client asked for a Friday install window.')

    await addWorkOrderTimelineNoteAction('work-order-1', formData)

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      workOrderId: 'work-order-1',
      actorId: 'user-1',
      fieldName: 'timeline_note_added',
      previousValue: null,
      newValue: 'Client asked for a Friday install window.',
      note: 'Client asked for a Friday install window.',
      isClientVisibleCandidate: false,
    }))
    expect(mockRevalidatePath).toHaveBeenCalledWith('/work-orders')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/work-orders/work-order-1')
  })

  it('refreshes AI suggestion without mutating operational fields', async () => {
    const set = vi.fn(() => ({ where: vi.fn(async () => []) }))
    mockUpdate.mockReturnValue({ set })
    const builder: {
      leftJoin: ReturnType<typeof vi.fn>
      where: ReturnType<typeof vi.fn>
    } = {
      leftJoin: vi.fn(() => undefined),
      where: vi.fn(() => ({
        limit: vi.fn(async () => [{
          clientName: 'Jane Client',
          jobNumber: 'R260210',
          stageName: 'Install booked',
          hardwareStatusName: 'Ready',
          riskLevel: 'high',
          importance: 'medium',
          clientContextSummary: 'Builder wants a Friday install.',
          aiSuggestionAt: null,
        }]),
      })),
    }
    builder.leftJoin.mockReturnValue(builder)
    mockSelect.mockReturnValue({
      from: vi.fn(() => builder),
    })

    await generateWorkOrderAiSuggestionAction('work-order-1')

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      aiSuggestion: expect.stringContaining('Jane Client'),
      aiSuggestionAt: expect.any(Date),
      updatedAt: expect.any(Date),
    }))
    expect(set).not.toHaveBeenCalledWith(expect.objectContaining({
      installerId: expect.anything(),
      stageOptionId: expect.anything(),
      hardwareStatusOptionId: expect.anything(),
      riskLevelOverride: expect.anything(),
      importanceOverride: expect.anything(),
      installDate: expect.anything(),
      dateCompleted: expect.anything(),
    }))
  })

  it('blocks AI suggestion refreshes during the cooldown window', async () => {
    const set = vi.fn(() => ({ where: vi.fn(async () => []) }))
    mockUpdate.mockReturnValue({ set })
    const builder: {
      leftJoin: ReturnType<typeof vi.fn>
      where: ReturnType<typeof vi.fn>
    } = {
      leftJoin: vi.fn(() => undefined),
      where: vi.fn(() => ({
        limit: vi.fn(async () => [{
          clientName: 'Jane Client',
          jobNumber: 'R260210',
          stageName: 'Install booked',
          hardwareStatusName: 'Ready',
          riskLevel: 'high',
          importance: 'medium',
          clientContextSummary: 'Builder wants a Friday install.',
          aiSuggestionAt: new Date(),
        }]),
      })),
    }
    builder.leftJoin.mockReturnValue(builder)
    mockSelect.mockReturnValue({
      from: vi.fn(() => builder),
    })

    await generateWorkOrderAiSuggestionAction('work-order-1')

    expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining('/work-orders/work-order-1?aiRefreshCooldownUntil='))
    expect(set).not.toHaveBeenCalled()
  })
})
