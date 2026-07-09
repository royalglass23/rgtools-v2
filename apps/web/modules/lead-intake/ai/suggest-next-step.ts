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
    emails: Array<{
      date: string | null
      subject: string | null
      body: string
      direction?: 'inbound' | 'outbound' | null
    }>
  } | null
}

type ResponsesTextResponse = {
  output_text?: string
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
    lead.freeText ? `Job Description: ${lead.freeText}` : null,
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
    'Emails marked (Customer) are the customer’s own words — weight their stated needs, objections, timeline, and urgency most heavily. Emails marked (Royal Glass) are our own outbound messages, so do not treat them as customer intent.',
    'If the newest history says the customer or site is not ready, recommend a timed follow-up or wait-for-customer step instead of a generic quote chase.',
    'Reference specifics from this history (the site, what they asked for, what was quoted or promised) in your output so the advice is concrete, not generic.',
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
      const who =
        email.direction === 'inbound' ? '(Customer) ' : email.direction === 'outbound' ? '(Royal Glass) ' : ''
      lines.push(`- [${email.date ?? 'No date'}] ${who}Subject: ${email.subject ?? 'No subject'}`)
      if (email.body) lines.push(`  ${email.body}`)
    }
  }

  return lines.join('\n')
}

const SYSTEM_PROMPT = `You are an expert glazing sales consultant advising Royal Glass — a specialist glass company in New Zealand offering bespoke windows, doors, frameless shower screens, glass balustrades, and architectural glass systems. You write for the Royal Glass staff member who will make the call or send the email.

Study the lead profile and respond in EXACTLY this format, in this order, with no preamble or extra commentary:

NEXT ACTION: <the specific step(s) to take, naming call, email, or a dated wait/follow-up; if a sequence, say it plainly e.g. "Email today to re-engage, then call to close" or "Hold — light check-in when BC comes through">
SALES ANGLE: <one sentence on how to position Royal Glass for this lead's specific situation>
RISK WATCH: <the single biggest threat to winning this lead>

Then include the channel section(s) that match your NEXT ACTION — usually ONE. Only include BOTH an EMAIL DRAFT and a PHONE AGENDA when the best play is genuinely a sequence (e.g. email now to re-engage, then a call to close), and put them in the order you would do them. Do NOT pad with both by default — each section must add a distinct step. If the NEXT ACTION is a wait/follow-up with no message to send yet, include neither and instead add a one-line FOLLOW-UP TRIGGER: <what event or date should prompt the next contact>.

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
• Use ONLY facts present in the lead profile or the conversation history. Do NOT invent prices, dollar figures, lead times, delivery dates, product specs, or guarantees.
• Do NOT state the customer's consent status — Resource Consent (RC), Building Consent (BC), or building stage — as fact unless it is explicitly given in the lead fields or the conversation history. Never tell a customer their consent is "approved", "granted", or "in progress" on your own assumption. If you need to reference it and it is not confirmed in the data, use a placeholder, e.g. [confirm BC status]. The same applies to any claim about the customer's decision, who won the job, their timeline, or project stage — assert it only if the data or history says so, otherwise use a placeholder or omit it.
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

Do NOT chase a deal that is not ready (this OVERRIDES the tier rules above):
• If the latest notes/emails show the customer has not confirmed, is still comparing quotes, or the job is gated on consent/BC that is not yet granted, the NEXT ACTION is a LIGHT, dated follow-up — a brief check-in tied to the trigger (e.g. "when BC comes through", "early [month]") — NOT a hard close.
• Do NOT propose booking a measure, a site visit, or a "let's schedule" close until the customer has actually confirmed intent in the history.
• Match the customer's stated pace: if they said they will come back to you, the step is to wait and set the trigger, optionally with a soft value-add touch — never pressure.

Use New Zealand English spelling and a natural, professional Kiwi business tone.`

export async function generateSuggestion(lead: SuggestionLead): Promise<{ text: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new MissingOpenAIKeyError()

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? 'gpt-5.4-mini',
      instructions: SYSTEM_PROMPT,
      input: buildSuggestionPrompt(lead),
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`OpenAI suggestion failed with HTTP ${response.status}${body ? `: ${body}` : ''}`)
  }

  const payload = await response.json() as ResponsesTextResponse
  const text = payload.output_text?.trim()
  if (!text) throw new Error('OpenAI suggestion response did not include text')

  return { text }
}

function formatDateValue(value: Date | string | null) {
  if (!value) return 'Not set'
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return value
}
