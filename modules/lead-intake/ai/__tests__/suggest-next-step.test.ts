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
  clientName: 'Jane Smith',
  location: 'Ponsonby, Auckland',
  completeness: 85,
  scoredFields: [
    { category: 1, label: 'Client Type', answer: 'Homeowner', points: 12 },
    { category: 2, label: 'Budget Band', answer: '$10k-$20k', points: 10 },
    { category: 4, label: 'Complexity', answer: 'Standard', points: 5 },
    { category: 5, label: 'Price-sensitivity Read', answer: 'Low', points: 8 },
    { category: 6, label: 'Decision-makers', answer: 'Single', points: 5 },
    { category: 7, label: 'Distance', answer: '0-20 km', points: 5 },
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
  it('includes all lead profile fields in structured sections', () => {
    const prompt = buildSuggestionPrompt(lead)

    // Client section
    expect(prompt).toContain('Name: Jane Smith')
    expect(prompt).toContain('Segment: B2C')
    expect(prompt).toContain('Client Type: Homeowner')
    expect(prompt).toContain('Location: Ponsonby, Auckland')

    // Score section
    expect(prompt).toContain('Tier: A')
    expect(prompt).toContain('Score: 91')
    expect(prompt).toContain('Completeness: 85%')

    // Project section
    expect(prompt).toContain('Project type: Frameless shower')
    expect(prompt).toContain('Budget Band: $10k-$20k')

    // Consent & timeline section
    expect(prompt).toContain('Resource Consent: Not required')
    expect(prompt).toContain('Building Consent: Required')
    expect(prompt).toContain('Building Stage: Planning')
    expect(prompt).toContain('Follow-up date: 2026-06-24')

    // Sales signals
    expect(prompt).toContain('Price-sensitivity Read: Low')
    expect(prompt).toContain('Notes: Client wants a site measure next week.')
  })

  it('detects B2B segment when company name is present', () => {
    const b2bLead = {
      ...lead,
      companyName: 'Acme Builders Ltd',
      scoredFields: [
        { label: 'Client Type', answer: 'Builder' },
        ...lead.scoredFields.slice(1),
      ],
    }
    const prompt = buildSuggestionPrompt(b2bLead)
    expect(prompt).toContain('Segment: B2B')
    expect(prompt).toContain('Company: Acme Builders Ltd')
  })

  it('includes strike flag and score reason when present', () => {
    const flaggedLead = {
      ...lead,
      strikeFlag: 'price_shopper',
      scoreReason: 'High price sensitivity with multiple quotes',
    }
    const prompt = buildSuggestionPrompt(flaggedLead)
    expect(prompt).toContain('Strike flag: price_shopper')
    expect(prompt).toContain('Score reason: High price sensitivity with multiple quotes')
  })

  it('includes ServiceM8 conversation history when present', () => {
    const prompt = buildSuggestionPrompt({
      ...lead,
      history: {
        notes: [
          { date: '2026-06-18', text: 'Customer asked for an urgent shower measure.' },
        ],
        emails: [
          {
            date: '2026-06-17',
            subject: 'Frameless shower quote',
            body: 'Can Royal Glass quote the ensuite this week?',
          },
        ],
      },
    })

    expect(prompt).toContain('=== CONVERSATION HISTORY (from ServiceM8) ===')
    expect(prompt).toContain('Use this ServiceM8 history as the primary source for what the customer has already asked, been told, or committed to.')
    expect(prompt).toContain('Treat the newest ServiceM8 notes/emails as the current state, overriding older emails and generic priority rules when they conflict.')
    expect(prompt).toContain('If the newest history says the customer or site is not ready, recommend a timed follow-up or wait-for-customer step instead of a generic quote chase.')
    expect(prompt).toContain('- [2026-06-18] Customer asked for an urgent shower measure.')
    expect(prompt).toContain('- [2026-06-17] Subject: Frameless shower quote')
    expect(prompt).toContain('  Can Royal Glass quote the ensuite this week?')
  })

  it('labels email direction so the model distinguishes customer voice from our outbound', () => {
    const prompt = buildSuggestionPrompt({
      ...lead,
      history: {
        notes: [],
        emails: [
          { date: '2026-06-17', subject: 'Re: Quote', body: 'Can you do frameless instead?', direction: 'inbound' },
          { date: '2026-06-16', subject: 'Quote sent', body: 'Thanks for the opportunity.', direction: 'outbound' },
        ],
      },
    })

    expect(prompt).toContain('- [2026-06-17] (Customer) Subject: Re: Quote')
    expect(prompt).toContain('- [2026-06-16] (Royal Glass) Subject: Quote sent')
    expect(prompt).toContain('Emails marked (Customer) are the customer’s own words')
  })

  it('omits ServiceM8 conversation history when empty or missing', () => {
    expect(buildSuggestionPrompt(lead)).not.toContain('CONVERSATION HISTORY')
    expect(buildSuggestionPrompt({ ...lead, history: { notes: [], emails: [] } }))
      .not.toContain('CONVERSATION HISTORY')
  })
})

describe('generateSuggestion', () => {
  it('posts to OpenAI chat completions with gpt-4o and returns parsed text', async () => {
    const mockResponse = [
      'NEXT ACTION: Call Jane today to book a site measure.',
      'SALES ANGLE: Lead with our frameless shower portfolio and quick turnaround.',
      'RISK WATCH: Building consent required — confirm timeline before quoting.',
      '',
      'PHONE AGENDA:',
      '- Opening: Hi Jane, this is Royal Glass following up on your shower screen enquiry.',
      '- Info to gather: Have you received your building consent yet? What is your ideal start date?',
      '- Talking points: We specialise in frameless systems, our lead time is 3-4 weeks once consent is issued.',
      '- Close: Lock in a site measure for this week so we have measurements ready when consent comes through.',
    ].join('\n')

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: mockResponse } }],
      }),
    } as Response)

    await expect(generateSuggestion(lead)).resolves.toEqual({ text: mockResponse })

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

  it('uses gpt-4o when no OPENAI_MODEL env var is set', async () => {
    delete process.env.OPENAI_MODEL
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'NEXT ACTION: Call now.' } }],
      }),
    } as Response)

    await generateSuggestion(lead)

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(body.model).toBe('gpt-4o')
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
