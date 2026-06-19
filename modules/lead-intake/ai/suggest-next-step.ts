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
  // Extended fields from getLeadDetail
  clientName?: string | null
  companyName?: string | null
  source?: string | null
  location?: string | null
  strikeFlag?: string | null
  scoreReason?: string | null
  rcStatus?: string | null
  bcStatus?: string | null
  consentStatus?: string | null
  completeness?: number | null
  distanceBand?: string | null
  history?: {
    notes: Array<{ date: string | null; text: string }>
    emails: Array<{ date: string | null; subject: string | null; body: string }>
  } | null
}

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
}

export function buildSuggestionPrompt(lead: SuggestionLead): string {
  const field = (label: string) =>
    lead.scoredFields.find((f) => f.label === label)?.answer ?? 'Not selected'

  const clientType = field('Client Type')
  const isB2B =
    /builder|developer|investor|repeat/i.test(clientType) || !!lead.companyName
  const segment = isB2B ? 'B2B' : 'B2C (homeowner / residential)'

  const lines: Array<string | null> = [
    '=== CLIENT ===',
    lead.clientName ? `Name: ${lead.clientName}` : null,
    lead.companyName ? `Company: ${lead.companyName}` : null,
    `Segment: ${segment}`,
    `Client Type: ${clientType}`,
    lead.source ? `Lead source: ${lead.source}` : null,
    lead.location ? `Location: ${lead.location}` : null,

    '',
    '=== LEAD SCORE ===',
    `Tier: ${lead.tier ?? 'Not set'}`,
    `Score: ${lead.seedScore ?? 0}`,
    lead.completeness != null ? `Completeness: ${lead.completeness}%` : null,
    lead.strikeFlag ? `Strike flag: ${lead.strikeFlag}` : null,
    lead.scoreReason ? `Score reason: ${lead.scoreReason}` : null,

    '',
    '=== PROJECT ===',
    `Project type: ${lead.projectType ?? 'Not set'}`,
    `Budget Band: ${field('Budget Band')}`,
    `Complexity: ${field('Complexity')}`,
    `Distance: ${lead.distanceBand ?? field('Distance')}`,

    '',
    '=== CONSENT & BUILDING STAGE ===',
    `Resource Consent: ${lead.rcStatus ?? field('Resource Consent')}`,
    `Building Consent: ${lead.bcStatus ?? field('Building Consent')}`,
    `Building Stage: ${field('Building Stage')}`,
    `Follow-up date: ${formatDateValue(lead.followUpDate)}`,

    '',
    '=== SALES SIGNALS ===',
    `Decision-makers: ${field('Decision-makers')}`,
    `Price-sensitivity Read: ${field('Price-sensitivity Read')}`,
    lead.freeText ? `Notes: ${lead.freeText}` : null,
    renderHistorySection(lead.history),
  ]

  return lines.filter((line): line is string => line !== null).join('\n')
}

function renderHistorySection(history: SuggestionLead['history']): string | null {
  if (!history || (history.notes.length === 0 && history.emails.length === 0)) return null

  const lines = [
    '',
    '=== CONVERSATION HISTORY (from ServiceM8) ===',
    'Use this ServiceM8 history as the primary source for what the customer has already asked, been told, or committed to.',
    'Treat the newest ServiceM8 notes/emails as the current state, overriding older emails and generic priority rules when they conflict.',
    'If the newest history says the customer or site is not ready, recommend a timed follow-up or wait-for-customer step instead of a generic quote chase.',
  ]

  if (history.notes.length > 0) {
    lines.push(
      'Notes (most recent first):',
      ...history.notes.map((note) => `- [${note.date ?? 'No date'}] ${note.text}`),
    )
  }

  if (history.emails.length > 0) {
    if (history.notes.length > 0) lines.push('')
    lines.push('Emails (most recent first):')
    for (const email of history.emails) {
      lines.push(`- [${email.date ?? 'No date'}] Subject: ${email.subject ?? 'No subject'}`)
      if (email.body) lines.push(`  ${email.body}`)
    }
  }

  return lines.join('\n')
}

const SYSTEM_PROMPT = `You are an expert glazing sales consultant advising Royal Glass — a specialist glass company in New Zealand offering bespoke windows, doors, frameless shower screens, glass balustrades, and architectural glass systems. You write for the Royal Glass staff member who will make the call or send the email.

Study the lead profile and respond in EXACTLY this format, in this order, with no preamble or extra commentary:

NEXT ACTION: <one specific step to take today or by the follow-up date, naming call or email>
SALES ANGLE: <one sentence on how to position Royal Glass for this lead's specific situation>
RISK WATCH: <the single biggest threat to winning this lead>

Then include ONE channel section that matches your NEXT ACTION.

If the next action is a CALL, add:
PHONE AGENDA:
- Opening: <how to open and build instant rapport — use their name>
- Info to gather: <2-3 qualifying questions targeting the gaps marked "Not selected" or missing in the lead data>
- Talking points: <2-3 persuasion angles tailored to this client type and project>
- Objection handling: <the most likely objection for this lead and a one-line response>
- Close: <the specific commitment to secure before hanging up>

If the next action is an EMAIL, add:
EMAIL DRAFT:
Subject: <subject line>

<ready-to-send body addressed to the contact by name, referencing their specific project, warm and concise (4-6 short sentences). End with a clear call to action and sign off as "The Royal Glass Team".>

Accuracy rules (critical — staff may use this verbatim):
• Use ONLY facts present in the lead profile. Do NOT invent prices, dollar figures, lead times, delivery dates, product specs, or guarantees.
• When a specific number or detail would strengthen the message but is not in the data, insert a bracketed placeholder for staff to fill, e.g. [confirm lead time], [insert quote figure], [your name].
• Never promise anything Royal Glass has not committed to in the data.

Calibrate to the segment:
• B2B (builder / developer / investor): relationship-first — lead-time fit, account potential, trade pricing, repeat-volume pipeline; address the contact professionally.
• B2C (homeowner / residential): lifestyle and outcome focus — quality, trust, design inspiration, easing consent or timeline anxiety; warm and reassuring tone.

Priority rules:
• Tier A/B = act within 24 h; phone is almost always right, do not wait for the follow-up date
• Tier C = email first to re-engage, then propose a call
• Tier D = minimal effort; one short warm email only
• A strike flag or low completeness = gather missing info before quoting
• Building Consent "Required" or "In progress" = project may be 3–12 months out; set a long-range nurture cadence rather than pushing to quote now
• High price sensitivity or competing quotes = lead with value, quality, and track record, not price

Use New Zealand English spelling and a natural, professional Kiwi business tone.`

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
      model: process.env.OPENAI_MODEL ?? 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: buildSuggestionPrompt(lead),
        },
      ],
      temperature: 0.4,
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
