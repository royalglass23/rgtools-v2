// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import {
  AI_GUIDANCE_FAILURE_COOLDOWN_MS,
  AI_GUIDANCE_REGENERATION_COOLDOWN_MS,
  AI_GUIDANCE_TIMEOUT_MESSAGE,
  buildAiGuidanceFailureRecord,
  fetchAiGuidanceOpenAi,
  getAiGuidanceCooldown,
  runAiGuidanceGeneration,
} from '../runtime'

describe('AI Guidance shared runtime', () => {
  it('returns reusable retry and regeneration cooldown messages', () => {
    const now = new Date('2026-06-25T00:04:59Z')
    const formatDateTime = (date: Date) => date.toISOString()

    expect(AI_GUIDANCE_FAILURE_COOLDOWN_MS).toBe(60_000)
    expect(AI_GUIDANCE_REGENERATION_COOLDOWN_MS).toBe(5 * 60_000)
    expect(getAiGuidanceCooldown({
      latestSuccessAt: new Date('2026-06-25T00:00:00Z'),
      now,
      formatDateTime,
    })).toEqual({
      kind: 'regeneration',
      retryAfter: new Date('2026-06-25T00:05:00Z'),
      message: 'AI Guidance can be regenerated after 2026-06-25T00:05:00.000Z.',
    })

    expect(getAiGuidanceCooldown({
      latestFailureRetryAfter: new Date('2026-06-25T00:06:00Z'),
      now,
      formatDateTime,
    })).toEqual({
      kind: 'retry',
      retryAfter: new Date('2026-06-25T00:06:00Z'),
      message: 'AI Guidance can be retried after 2026-06-25T00:06:00.000Z.',
    })
  })

  it('builds failure metadata with shared stage, model, prompt, input, retry, and safe message fields', () => {
    const attemptedAt = new Date('2026-06-25T00:00:00Z')

    const failure = buildAiGuidanceFailureRecord({
      stage: 'ai_suggestion',
      error: Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' }),
      attemptedAt,
      triggeredByUserId: 'user-1',
      model: 'gpt-4o-mini',
      promptVersion: 'quote-ai-guidance-v1',
      inputSnapshotVersion: 'quote-ai-guidance-input-v1',
    })

    expect(failure).toEqual({
      triggeredByUserId: 'user-1',
      failureStage: 'ai_suggestion',
      errorType: 'timeout',
      errorMessage: AI_GUIDANCE_TIMEOUT_MESSAGE,
      attemptedAt,
      retryAfter: new Date('2026-06-25T00:01:00Z'),
      model: 'gpt-4o-mini',
      promptVersion: 'quote-ai-guidance-v1',
      inputSnapshotVersion: 'quote-ai-guidance-input-v1',
    })
  })

  it('runs a domain generator with declared context, versions, validator, and saver', async () => {
    const save = vi.fn(async (input: {
      context: { customerName: string }
      output: { nextMove: string }
      generatedAt: Date
      metadata: { model: string; promptVersion: string; inputSnapshotVersion: string | null }
    }) => ({ id: `saved-${input.output.nextMove}` }))

    const result = await runAiGuidanceGeneration({
      stage: 'lead_guidance',
      model: 'gpt-4o-mini',
      promptVersion: 'lead-ai-guidance-v1',
      inputSnapshotVersion: 'lead-ai-guidance-input-v1',
      triggeredByUserId: 'user-1',
      now: () => new Date('2026-06-25T00:00:00Z'),
      buildContext: async () => ({ customerName: 'Jane Smith' }),
      generate: async ({ context }) => ({ nextMove: `call ${context.customerName}` }),
      validate: (value) => value as { nextMove: string },
      save,
      recordFailure: vi.fn(),
    })

    expect(result).toEqual({ ok: true, saved: { id: 'saved-call Jane Smith' } })
    expect(save).toHaveBeenCalledWith({
      context: { customerName: 'Jane Smith' },
      output: { nextMove: 'call Jane Smith' },
      generatedAt: new Date('2026-06-25T00:00:00Z'),
      metadata: {
        model: 'gpt-4o-mini',
        promptVersion: 'lead-ai-guidance-v1',
        inputSnapshotVersion: 'lead-ai-guidance-input-v1',
      },
    })
  })

  it('passes an AbortSignal to OpenAI fetches so generation stops after 5 minutes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response)

    await fetchAiGuidanceOpenAi('https://api.openai.com/v1/chat/completions', { method: 'POST' })

    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })
})
