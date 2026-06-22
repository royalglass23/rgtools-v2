import { errorMessage } from '@/lib/error-message'

type FetchFn = typeof fetch

export type ReadyLinkEmailInput = {
  to: string[]
  quote: {
    link: string
    clientName: string
    jobAddress: string | null
    quoteValue: string
  }
  fetchFn?: FetchFn
}

export type ReadyLinkEmailResult =
  | { ok: true; skipped?: false; providerMessageId?: string }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string }

export async function sendReadyLinkEmail(input: ReadyLinkEmailInput): Promise<ReadyLinkEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM

  if (!apiKey || !from || input.to.length === 0) {
    return { ok: true, skipped: true, reason: 'resend-not-configured' }
  }

  try {
    const response = await (input.fetchFn ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: `Tracked quote link ready: ${input.quote.clientName}`,
        html: renderReadyLinkEmail(input),
      }),
    })

    const json = await response.json().catch(() => ({})) as { id?: string; message?: string }
    if (!response.ok) {
      return { ok: false, error: json.message || `Resend email failed with HTTP ${response.status}` }
    }

    return { ok: true, providerMessageId: json.id }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}

function renderReadyLinkEmail(input: ReadyLinkEmailInput): string {
  return `<!DOCTYPE html>
<html lang="en">
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;line-height:1.5;">
  <h1 style="font-size:20px;">Tracked quote link ready</h1>
  <p><strong>${escapeHtml(input.quote.clientName)}</strong></p>
  ${input.quote.jobAddress ? `<p>${escapeHtml(input.quote.jobAddress)}</p>` : ''}
  <p>Quote value: $${escapeHtml(input.quote.quoteValue)}</p>
  <p><a href="${escapeHtml(input.quote.link)}">${escapeHtml(input.quote.link)}</a></p>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
