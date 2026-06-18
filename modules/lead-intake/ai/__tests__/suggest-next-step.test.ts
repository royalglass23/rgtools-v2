// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MissingOpenAIKeyError,
  buildSuggestionPrompt,
  generateSuggestion,
} from '../suggest-next-step'

const originalApiKey = process.env.OPENAI_API_KEY
const originalModel = process.env.OPENAI_MODEL

const lead = {
  tier: 'A',
  seedScore: 91,
  projectType: 'Frameless shower',
  freeText: 'Client wants a site measure next week.',
  followUpDate: '2026-06-24',
  scoredFields: [
    { category: 1, label: 'Client Type', answer: 'Homeowner', points: 12 },
    { category: 2, label: 'Budget Band', answer: '$10k-$20k', points: 10 },
    { category: 8, label: 'Resource Consent', answer: 'Not required', points: 5 },
    { category: 9, label: 'Building Consent', answer: 'Required', points: 2 },
    { category: 10, label: 'Building Stage', answer: 'Planning', points: 3 },
  ],
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  process.env.OPENAI_API_KEY = 'test-key'
  process.env.OPENAI_MODEL = 'test-model'
})

afterEach(() => {
  vi.unstubAllGlobals()
  if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY
  } else {
    process.env.OPENAI_API_KEY = originalApiKey
  }

  if (originalModel === undefined) {
    delete process.env.OPENAI_MODEL
  } else {
    process.env.OPENAI_MODEL = originalModel
  }
})

describe('buildSuggestionPrompt', () => {
  it('includes lead profile fields and requests concise next action plus risk read', () => {
    const prompt = buildSuggestionPrompt(lead)

    expect(prompt).toContain('Tier: A')
    expect(prompt).toContain('Score: 91')
    expect(prompt).toContain('Client Type: Homeowner')
    expect(prompt).toContain('Budget Band: $10k-$20k')
    expect(prompt).toContain('Resource Consent: Not required')
    expect(prompt).toContain('Building Consent: Required')
    expect(prompt).toContain('Building Stage: Planning')
    expect(prompt).toContain('Follow-up date: 2026-06-24')
    expect(prompt).toContain('Project type: Frameless shower')
    expect(prompt).toContain('Client wants a site measure next week.')
    expect(prompt).toContain('1-3 lines')
    expect(prompt).toContain('one-line risk read')
  })
})

describe('generateSuggestion', () => {
  it('posts to OpenAI chat completions and returns parsed text', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Book a site visit.\nRisk: consent timing may delay work.' } }],
      }),
    } as Response)

    await expect(generateSuggestion(lead)).resolves.toEqual({
      text: 'Book a site visit.\nRisk: consent timing may delay work.',
    })

    expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: expect.any(String),
    }))
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(body.model).toBe('test-model')
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[1].role).toBe('user')
  })

  it('throws MissingOpenAIKeyError without making a network call when the API key is missing', async () => {
    delete process.env.OPENAI_API_KEY

    await expect(generateSuggestion(lead)).rejects.toBeInstanceOf(MissingOpenAIKeyError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('throws a clear error when OpenAI returns a non-2xx response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    } as Response)

    await expect(generateSuggestion(lead)).rejects.toThrow('OpenAI suggestion failed with HTTP 429: rate limited')
  })
})
