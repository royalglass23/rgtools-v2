import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAssertCanManage = vi.hoisted(() => vi.fn())
const mockAssertCanConfigure = vi.hoisted(() => vi.fn())
const mockRevalidatePath = vi.hoisted(() => vi.fn())
const mockRedirect = vi.hoisted(() => vi.fn())
const mockInsert = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
const mockSelect = vi.hoisted(() => vi.fn())
const mockAuth = vi.hoisted(() => vi.fn())

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
  },
}))
vi.mock('@/lib/servicem8/client', () => ({
  createServiceM8RequestFromEnv: vi.fn(),
}))

import {
  addWorkOrderTimelineNoteAction,
  createWorkOrderInstallerAction,
  deactivateWorkOrderInstallerAction,
  generateWorkOrderAiSuggestionAction,
  markWorkOrderEventClientVisibleCandidateAction,
  refreshWorkOrdersAction,
  updateWorkOrderOperationalFieldsAction,
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
          installDate: null,
          dateCompleted: null,
          riskLevelOverride: null,
          importanceOverride: null,
        }]),
      })),
    })),
  })
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
})

describe('work order action permissions', () => {
  it('requires manage access before refreshing Work Orders from ServiceM8', async () => {
    mockAssertCanManage.mockRejectedValue(new Error('Forbidden: Work Orders manage access is required.'))

    await expect(refreshWorkOrdersAction()).rejects.toThrow('Forbidden: Work Orders manage access is required.')
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('requires manage access before updating operational Work Order fields', async () => {
    mockAssertCanManage.mockRejectedValue(new Error('Forbidden: Work Orders manage access is required.'))

    await expect(updateWorkOrderOperationalFieldsAction('work-order-1', new FormData())).rejects.toThrow(
      'Forbidden: Work Orders manage access is required.',
    )
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
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

  it('records timeline entries for changed operational fields with actor ownership', async () => {
    const updateSet = vi.fn(() => ({ where: vi.fn(async () => []) }))
    mockUpdate.mockReturnValue({ set: updateSet })
    const insertValues = vi.fn(async () => [])
    mockInsert.mockReturnValue({ values: insertValues })
    const formData = new FormData()
    formData.set('installerId', 'installer-1')
    formData.set('stageOptionId', 'stage-1')
    formData.set('hardwareStatusOptionId', 'hardware-1')
    formData.set('riskLevel', 'high')
    formData.set('importance', 'medium')
    formData.set('notes', 'Call before arrival')

    await updateWorkOrderOperationalFieldsAction('work-order-1', formData)

    expect(insertValues).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        workOrderId: 'work-order-1',
        actorId: 'user-1',
        fieldName: 'installer_changed',
        previousValue: null,
        newValue: 'installer-1',
        isClientVisibleCandidate: false,
      }),
      expect.objectContaining({
        fieldName: 'risk_changed',
        newValue: 'high',
      }),
      expect.objectContaining({
        fieldName: 'importance_changed',
        newValue: 'medium',
      }),
    ]))
    expect(insertValues).not.toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        fieldName: 'client_note_changed',
      }),
    ]))
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
