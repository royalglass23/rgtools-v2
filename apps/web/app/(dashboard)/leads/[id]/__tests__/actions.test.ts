// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuth = vi.hoisted(() => vi.fn())
const mockGetLeadDetail = vi.hoisted(() => vi.fn())
const mockGenerateSuggestion = vi.hoisted(() => vi.fn())
const mockGetJobNotesAndEmails = vi.hoisted(() => vi.fn())
const mockUpdateWhere = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const mockUpdateSet = vi.hoisted(() => vi.fn(() => ({ where: mockUpdateWhere })))
const mockUpdate = vi.hoisted(() => vi.fn(() => ({ set: mockUpdateSet })))
const mockRevalidatePath = vi.hoisted(() => vi.fn())
const mockLogAudit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/db', () => ({ db: { update: mockUpdate } }))
vi.mock('@/lib/audit-db', () => ({ logAudit: mockLogAudit }))
vi.mock('@/modules/leads/queries', () => ({ getLeadDetail: mockGetLeadDetail }))
vi.mock('@/modules/lead-intake/ai/suggest-next-step', () => ({
  MissingOpenAIKeyError: class MissingOpenAIKeyError extends Error {},
  generateSuggestion: mockGenerateSuggestion,
}))
vi.mock('@/lib/servicem8/client', () => ({ getJobNotesAndEmails: mockGetJobNotesAndEmails }))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn((column, value) => ({ column, value })) }))

import { deleteLeadAction, generateLeadSuggestionAction } from '../actions'

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
    expect(mockGenerateSuggestion).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('enforces 60-second cooldown when aiSuggestionAt is recent', async () => {
    const recentTime = new Date(Date.now() - 30_000) // 30 seconds ago — within 60s window
    mockGetLeadDetail.mockResolvedValue({
      id: 'lead-1',
      servicem8JobUuid: null,
      servicem8Status: null,
      aiSuggestionAt: recentTime,
    })

    const result = await generateLeadSuggestionAction('lead-1')

    expect(result).toEqual({ error: 'Please wait before generating another suggestion.' })
    expect(mockGenerateSuggestion).not.toHaveBeenCalled()
  })

  it('still generates a suggestion for linked Quote leads', async () => {
    mockGetLeadDetail.mockResolvedValue({
      id: 'lead-1',
      servicem8JobUuid: 'job-1',
      servicem8Status: 'Quote',
    })
    mockGetJobNotesAndEmails.mockResolvedValue({ notes: [] })
    mockGenerateSuggestion.mockResolvedValue({ text: 'Call this Quote lead.' })

    const result = await generateLeadSuggestionAction('lead-1')

    expect(result).toEqual({ text: 'Call this Quote lead.' })
    expect(mockGenerateSuggestion).toHaveBeenCalled()
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
      aiSuggestion: 'Call this Quote lead.',
      updatedAt: expect.any(Date),
    }))
    expect(mockRevalidatePath).toHaveBeenCalledWith('/leads/lead-1')
  })

  it('logs an audit event on successful generation', async () => {
    mockGetLeadDetail.mockResolvedValue({
      id: 'lead-1',
      servicem8JobUuid: null,
      servicem8Status: null,
    })
    mockGenerateSuggestion.mockResolvedValue({ text: 'Follow up on quote.' })

    await generateLeadSuggestionAction('lead-1')

    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'user-1',
      entityType: 'lead',
      action: 'lead.ai_suggestion_generated',
      targetId: 'lead-1',
    }))
    const call = mockLogAudit.mock.calls[0][0]
    expect(call.after).toHaveProperty('aiSuggestionAt')
    expect(call.after).not.toHaveProperty('aiSuggestion') // no suggestion text in log
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
