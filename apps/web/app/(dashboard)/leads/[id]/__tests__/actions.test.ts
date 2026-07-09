// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuth = vi.hoisted(() => vi.fn())
const mockGetLeadDetail = vi.hoisted(() => vi.fn())
const mockGenerateLeadAiGuidance = vi.hoisted(() => vi.fn())
const mockUpdateWhere = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const mockUpdateSet = vi.hoisted(() => vi.fn(() => ({ where: mockUpdateWhere })))
const mockUpdate = vi.hoisted(() => vi.fn(() => ({ set: mockUpdateSet })))
const mockRevalidatePath = vi.hoisted(() => vi.fn())
const mockLogAudit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockRedirect = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/db', () => ({ db: { update: mockUpdate } }))
vi.mock('@/lib/audit-db', () => ({ logAudit: mockLogAudit }))
vi.mock('@/modules/leads/queries', () => ({ getLeadDetail: mockGetLeadDetail }))
vi.mock('@/modules/leads/ai-guidance', () => ({ generateLeadAiGuidance: mockGenerateLeadAiGuidance }))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn((column, value) => ({ column, value })) }))

import { deleteLeadAction, generateLeadGuidanceAction, generateLeadSuggestionAction } from '../actions'

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
})

describe('generateLeadSuggestionAction', () => {
  it('returns error for unauthenticated call', async () => {
    mockAuth.mockResolvedValue(null)

    const result = await generateLeadSuggestionAction('lead-1')

    expect(result).toEqual({ error: 'Sign in to generate a suggestion.' })
    expect(mockGetLeadDetail).not.toHaveBeenCalled()
  })

  it('does not generate a new suggestion for linked non-Quote leads', async () => {
    mockGetLeadDetail.mockResolvedValue({
      id: 'lead-1',
      servicem8JobUuid: 'job-1',
      servicem8Status: 'Work Order',
    })

    const result = await generateLeadSuggestionAction('lead-1')

    expect(result).toEqual({ error: 'This lead is read-only because ServiceM8 status is no longer Quote.' })
    expect(mockGenerateLeadAiGuidance).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns the durable generator blocked message for unlinked leads', async () => {
    mockGetLeadDetail.mockResolvedValue({
      id: 'lead-1',
      servicem8JobUuid: null,
      servicem8Status: null,
    })
    mockGenerateLeadAiGuidance.mockResolvedValue({
      ok: false,
      blocked: true,
      message: 'Link this lead to ServiceM8 to generate AI Guidance.',
    })

    const result = await generateLeadSuggestionAction('lead-1')

    expect(result).toEqual({ error: 'Link this lead to ServiceM8 to generate AI Guidance.' })
    expect(mockGenerateLeadAiGuidance).toHaveBeenCalledWith({
      leadId: 'lead-1',
      triggeredByUserId: 'user-1',
    })
  })

  it('still generates a suggestion for linked Quote leads', async () => {
    mockGetLeadDetail.mockResolvedValue({
      id: 'lead-1',
      servicem8JobUuid: 'job-1',
      servicem8Status: 'Quote',
    })
    mockGenerateLeadAiGuidance.mockResolvedValue({
      ok: true,
      snapshotId: 'snapshot-1',
      suggestionId: 'suggestion-1',
      text: 'Call this Quote lead.',
    })

    const result = await generateLeadSuggestionAction('lead-1')

    expect(result).toEqual({ text: 'Call this Quote lead.' })
    expect(mockGenerateLeadAiGuidance).toHaveBeenCalledWith({
      leadId: 'lead-1',
      triggeredByUserId: 'user-1',
    })
    expect(mockUpdateSet).not.toHaveBeenCalledWith(expect.objectContaining({ aiSuggestion: expect.any(String) }))
    expect(mockRevalidatePath).toHaveBeenCalledWith('/leads/lead-1')
  })

  it('logs an audit event on successful generation', async () => {
    mockGetLeadDetail.mockResolvedValue({
      id: 'lead-1',
      servicem8JobUuid: 'job-1',
      servicem8Status: 'Quote',
    })
    mockGenerateLeadAiGuidance.mockResolvedValue({
      ok: true,
      snapshotId: 'snapshot-1',
      suggestionId: 'suggestion-1',
      text: 'Follow up on quote.',
    })

    await generateLeadSuggestionAction('lead-1')

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'user-1',
      entityType: 'lead',
      action: 'lead.ai_guidance_generated',
      targetId: 'lead-1',
    }))
    const call = mockLogAudit.mock.calls[0][0]
    expect(call.after).toEqual({
      conversationSnapshotId: 'snapshot-1',
      aiSuggestionId: 'suggestion-1',
    })
    expect(call.after).not.toHaveProperty('aiSuggestion')
  })
})

describe('generateLeadGuidanceAction', () => {
  it('redirects back to the Lead detail page after saved AI Guidance', async () => {
    mockGetLeadDetail.mockResolvedValue({
      id: 'lead-1',
      servicem8JobUuid: 'job-1',
      servicem8Status: 'Quote',
    })
    mockGenerateLeadAiGuidance.mockResolvedValue({
      ok: true,
      snapshotId: 'snapshot-1',
      suggestionId: 'suggestion-1',
      text: 'Call this Quote lead.',
    })
    const formData = new FormData()
    formData.set('leadId', 'lead-1')

    await generateLeadGuidanceAction(formData)

    expect(mockRevalidatePath).toHaveBeenCalledWith('/leads/lead-1')
    expect(mockRedirect).toHaveBeenCalledWith('/leads/lead-1?aiGuidanceSaved=1')
  })

  it('redirects back to the Lead detail page with generation errors', async () => {
    mockGetLeadDetail.mockResolvedValue({
      id: 'lead-1',
      servicem8JobUuid: null,
      servicem8Status: null,
    })
    mockGenerateLeadAiGuidance.mockResolvedValue({
      ok: false,
      blocked: true,
      message: 'Link this lead to ServiceM8 to generate AI Guidance.',
    })
    const formData = new FormData()
    formData.set('leadId', 'lead-1')

    await generateLeadGuidanceAction(formData)

    expect(mockRedirect).toHaveBeenCalledWith('/leads/lead-1?aiGuidanceError=Link%20this%20lead%20to%20ServiceM8%20to%20generate%20AI%20Guidance.')
  })
})

describe('deleteLeadAction', () => {
  it('throws Forbidden for unauthenticated call', async () => {
    mockAuth.mockResolvedValue(null)

    await expect(deleteLeadAction('lead-1')).rejects.toThrow('Forbidden')

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockLogAudit).not.toHaveBeenCalled()
  })

  it('throws Forbidden for non-admin session', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'staff-id', role: 'staff' } })

    await expect(deleteLeadAction('lead-1')).rejects.toThrow('Forbidden')

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockLogAudit).not.toHaveBeenCalled()
  })
})
