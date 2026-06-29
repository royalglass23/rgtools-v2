// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.fn()
const requireModule = vi.fn()
const generateConversationSnapshotForQuote = vi.fn()
const generateAiSuggestionForQuote = vi.fn()
const getLatestQuoteAiGuidance = vi.fn()
const logAudit = vi.fn()
const revalidatePath = vi.fn()
const redirect = vi.fn((url: string) => {
  throw Object.assign(new Error('NEXT_REDIRECT'), { url })
})

vi.mock('@/lib/auth', () => ({ auth: () => auth() }))
vi.mock('@/lib/guard', () => ({
  requireModule: (slug: string) => requireModule(slug),
}))
vi.mock('@/lib/audit-db', () => ({
  logAudit: (...args: unknown[]) => logAudit(...args),
}))
vi.mock('../conversation-snapshot', () => ({
  generateConversationSnapshotForQuote: (...args: unknown[]) => generateConversationSnapshotForQuote(...args),
}))
vi.mock('../ai-suggestion', () => ({
  generateAiSuggestionForQuote: (...args: unknown[]) => generateAiSuggestionForQuote(...args),
}))
vi.mock('../ai-guidance', () => ({
  getLatestQuoteAiGuidance: (quoteId: string) => getLatestQuoteAiGuidance(quoteId),
}))
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidatePath(path) }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }))

import { createAiSuggestionAction } from '../actions'

const quoteId = '11111111-1111-4111-8111-111111111111'
const userId = '22222222-2222-4222-8222-222222222222'

function formData() {
  const data = new FormData()
  data.set('quoteId', quoteId)
  return data
}

describe('createAiSuggestionAction', () => {
  beforeEach(() => {
    auth.mockReset()
    requireModule.mockReset()
    generateConversationSnapshotForQuote.mockReset()
    generateAiSuggestionForQuote.mockReset()
    getLatestQuoteAiGuidance.mockReset()
    logAudit.mockReset()
    revalidatePath.mockReset()
    redirect.mockClear()

    auth.mockResolvedValue({ user: { id: userId } })
    requireModule.mockResolvedValue(undefined)
    generateConversationSnapshotForQuote.mockResolvedValue({
      ok: true,
      snapshotId: 'snapshot-1',
      partial: false,
    })
    generateAiSuggestionForQuote.mockResolvedValue({
      ok: true,
      suggestionId: 'suggestion-1',
    })
    getLatestQuoteAiGuidance.mockResolvedValue({
      conversationSnapshot: null,
      aiSuggestion: null,
      generationFailure: null,
    })
  })

  it('refreshes the Conversation Snapshot and creates an AI Suggestion through the authenticated staff action', async () => {
    await expect(createAiSuggestionAction(formData())).rejects.toMatchObject({
      url: `/quote-tracker/${quoteId}?snapshotSaved=1&suggestionSaved=1`,
    })

    expect(requireModule).toHaveBeenCalledWith('quote-tracker')
    expect(generateConversationSnapshotForQuote).toHaveBeenCalledWith({
      quoteId,
      triggeredByUserId: userId,
    })
    expect(generateAiSuggestionForQuote).toHaveBeenCalledWith({
      quoteId,
      triggeredByUserId: userId,
    })
    expect(generateConversationSnapshotForQuote.mock.invocationCallOrder[0]).toBeLessThan(
      generateAiSuggestionForQuote.mock.invocationCallOrder[0],
    )
    expect(logAudit).toHaveBeenCalledWith({
      actorId: userId,
      entityType: 'quote',
      action: 'quote.conversation_snapshot_created',
      targetId: quoteId,
      detail: { snapshotId: 'snapshot-1', partial: false },
    })
    expect(logAudit).toHaveBeenCalledWith({
      actorId: userId,
      entityType: 'quote',
      action: 'quote.ai_suggestion_created',
      targetId: quoteId,
      detail: { suggestionId: 'suggestion-1' },
    })
    expect(revalidatePath).toHaveBeenCalledWith(`/quote-tracker/${quoteId}`)
  })

  it('stops unauthorized staff before generating AI Guidance records', async () => {
    requireModule.mockRejectedValue(Object.assign(new Error('NEXT_REDIRECT'), { url: '/?denied=quote-tracker' }))

    await expect(createAiSuggestionAction(formData())).rejects.toMatchObject({
      url: '/?denied=quote-tracker',
    })

    expect(generateConversationSnapshotForQuote).not.toHaveBeenCalled()
    expect(generateAiSuggestionForQuote).not.toHaveBeenCalled()
    expect(logAudit).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('keeps generating the AI Suggestion when the Conversation Snapshot refresh only has partial ServiceM8 context', async () => {
    generateConversationSnapshotForQuote.mockResolvedValue({
      ok: true,
      snapshotId: 'snapshot-partial',
      partial: true,
    })

    await expect(createAiSuggestionAction(formData())).rejects.toMatchObject({
      url: `/quote-tracker/${quoteId}?snapshotSaved=partial&suggestionSaved=1`,
    })

    expect(generateAiSuggestionForQuote).toHaveBeenCalledWith({
      quoteId,
      triggeredByUserId: userId,
    })
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'quote.conversation_snapshot_created',
      detail: { snapshotId: 'snapshot-partial', partial: true },
    }))
  })

  it('regenerates from an older Conversation Snapshot when the ServiceM8 refresh fully fails', async () => {
    generateConversationSnapshotForQuote.mockResolvedValue({
      ok: false,
      message: 'ServiceM8 history could not be fetched.',
    })
    getLatestQuoteAiGuidance.mockResolvedValue({
      conversationSnapshot: { id: 'snapshot-old' },
      aiSuggestion: null,
      generationFailure: {
        failureStage: 'conversation_snapshot',
        errorMessage: 'ServiceM8 history could not be fetched.',
      },
    })

    await expect(createAiSuggestionAction(formData())).rejects.toMatchObject({
      url: `/quote-tracker/${quoteId}?snapshotError=${encodeURIComponent('ServiceM8 history could not be fetched.')}&suggestionSaved=1`,
    })

    expect(getLatestQuoteAiGuidance).toHaveBeenCalledWith(quoteId)
    expect(generateAiSuggestionForQuote).toHaveBeenCalledWith({
      quoteId,
      triggeredByUserId: userId,
    })
    expect(logAudit).not.toHaveBeenCalledWith(expect.objectContaining({
      action: 'quote.conversation_snapshot_created',
    }))
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'quote.ai_suggestion_created',
      detail: { suggestionId: 'suggestion-1' },
    }))
  })

  it('does not ask AI for a suggestion when ServiceM8 fully fails and no Conversation Snapshot exists', async () => {
    generateConversationSnapshotForQuote.mockResolvedValue({
      ok: false,
      message: 'ServiceM8 history could not be fetched.',
    })

    await expect(createAiSuggestionAction(formData())).rejects.toMatchObject({
      url: `/quote-tracker/${quoteId}?snapshotError=${encodeURIComponent('ServiceM8 history could not be fetched.')}`,
    })

    expect(getLatestQuoteAiGuidance).toHaveBeenCalledWith(quoteId)
    expect(generateAiSuggestionForQuote).not.toHaveBeenCalled()
    expect(logAudit).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('keeps the saved Conversation Snapshot visible when AI Suggestion generation fails', async () => {
    generateAiSuggestionForQuote.mockResolvedValue({
      ok: false,
      message: 'AI provider returned HTTP 429.',
    })

    await expect(createAiSuggestionAction(formData())).rejects.toMatchObject({
      url: `/quote-tracker/${quoteId}?snapshotSaved=1&suggestionError=${encodeURIComponent('AI provider returned HTTP 429.')}`,
    })

    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'quote.conversation_snapshot_created',
      detail: { snapshotId: 'snapshot-1', partial: false },
    }))
    expect(logAudit).not.toHaveBeenCalledWith(expect.objectContaining({
      action: 'quote.ai_suggestion_created',
    }))
    expect(revalidatePath).toHaveBeenCalledWith(`/quote-tracker/${quoteId}`)
  })
})
