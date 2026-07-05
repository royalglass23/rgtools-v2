// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => vi.fn())
const userCanAccessSlugMock = vi.hoisted(() => vi.fn())
const submitLeadIntakeForUserMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/access-db', () => ({ userCanAccessSlug: userCanAccessSlugMock }))
vi.mock('@/modules/lead-intake/actions', () => ({
  submitLeadIntakeForUser: submitLeadIntakeForUserMock,
}))

import { submitQuickCaptureLead } from '../quick-capture-actions'

beforeEach(() => {
  vi.clearAllMocks()
})

function form(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  const values = {
    clientName: 'Aroha Smith',
    phone: '021 333 444',
    email: '',
    location: '12 Queen Street, Auckland',
    jobDescription: 'Pool fence quote',
    buildingStage: 'ready_for_glazing',
    ...overrides,
  }
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

describe('submitQuickCaptureLead', () => {
  it('rejects callers without lead-intake access before writing', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    userCanAccessSlugMock.mockResolvedValue(false)

    const result = await submitQuickCaptureLead(form())

    expect(result).toEqual({ error: 'Forbidden' })
    expect(userCanAccessSlugMock).toHaveBeenCalledWith('user-1', 'lead-intake')
    expect(submitLeadIntakeForUserMock).not.toHaveBeenCalled()
  })

  it('delegates to the shared intake action with first-call fields and default sync behavior', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } })
    userCanAccessSlugMock.mockResolvedValue(true)
    submitLeadIntakeForUserMock.mockResolvedValue({
      success: true,
      leadId: 'lead-quick-1',
      clientId: 'client-1',
      matchedExistingClient: false,
      score: 58,
      tier: 'B',
      reason: 'Tier B (58): strong lead',
      completeness: 31,
      distanceBand: 'lt_15km',
      flagNote: null,
      servicem8Sync: { ok: true, leadId: 'lead-quick-1', reference: 'inbox:lead-quick-1' },
    })

    const result = await submitQuickCaptureLead(form())

    expect(result).toMatchObject({ success: true, leadId: 'lead-quick-1', tier: 'B' })
    expect(submitLeadIntakeForUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: 'Aroha Smith',
        phone: '021 333 444',
        email: '',
        location: '12 Queen Street, Auckland',
        jobDescription: 'Pool fence quote',
        buildingStage: 'ready_for_glazing',
        source: 'phone',
      }),
      'user-1',
    )
    expect(submitLeadIntakeForUserMock.mock.calls[0]).toHaveLength(2)
  })
})
