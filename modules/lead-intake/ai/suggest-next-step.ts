export class MissingOpenAIKeyError extends Error {
  constructor() {
    super('OPENAI_API_KEY is not configured')
    this.name = 'MissingOpenAIKeyError'
  }
}

export type SuggestionLead = {
  tier: string | null
  seedScore: number | null
  projectType: string | null
  freeText: string | null
  followUpDate: Date | string | null
  scoredFields: Array<{
    label: string
    answer: string
  }>
}

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
}

export function buildSuggestionPrompt(lead: SuggestionLead): string {
  const field = (label: string) => lead.scoredFields.find((candidate) => candidate.label === label)?.answer ?? 'Not selected'

  return [
    'You are advising Royal Glass staff on the next best action for a sales lead.',
    'Return 1-3 lines of recommended next action plus a one-line risk read. Keep it concise and practical.',
    '',
    'Lead profile:',
    `Tier: ${lead.tier ?? 'Not set'}`,
    `Score: ${lead.seedScore ?? 0}`,
    `Client Type: ${field('Client Type')}`,
    `Budget Band: ${field('Budget Band')}`,
    `Resource Consent: ${field('Resource Consent')}`,
    `Building Consent: ${field('Building Consent')}`,
    `Building Stage: ${field('Building Stage')}`,
    `Follow-up date: ${formatDateValue(lead.followUpDate)}`,
    `Project type: ${lead.projectType ?? 'Not set'}`,
    `Free text: ${lead.freeText ?? '-'}`,
  ].join('\n')
}

export async function generateSuggestion(lead: SuggestionLead): Promise<{ text: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new MissingOpenAIKeyError()

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You write concise, practical sales follow-up advice for a glazing business.',
        },
        {
          role: 'user',
          content: buildSuggestionPrompt(lead),
        },
      ],
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`OpenAI suggestion failed with HTTP ${response.status}${body ? `: ${body}` : ''}`)
  }

  const payload = await response.json() as ChatCompletionResponse
  const text = payload.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('OpenAI suggestion response did not include text')

  return { text }
}

function formatDateValue(value: Date | string | null) {
  if (!value) return 'Not set'
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return value
}
