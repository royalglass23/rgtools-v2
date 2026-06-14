import { db } from '@/lib/db'
import { leadEmailLog } from '@/drizzle/schema-leads'
import { errorMessage } from '@/lib/error-message'
import type { CalculatorEstimateForEmail } from '@/modules/lead-intake/calculator/map-calculator-submission'

type FetchFn = typeof fetch

export type CustomerEstimateEmailInput = {
  leadId: string
  to: string
  customerName: string
  estimate: CalculatorEstimateForEmail
  projectType: string
  correlationId: string
  fetchFn?: FetchFn
}

export type CustomerEstimateEmailResult =
  | { ok: true; skipped?: false; providerMessageId?: string }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string }

export async function sendCustomerEstimateEmail(
  input: CustomerEstimateEmailInput,
): Promise<CustomerEstimateEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM

  if (!apiKey || !from) {
    await logEmail(input, { status: 'skipped', error: 'RESEND_API_KEY or RESEND_FROM is not configured' })
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
        subject: 'Your Royal Glass estimate',
        html: renderCustomerEstimateEmail(input),
      }),
    })

    const json = await response.json().catch(() => ({})) as { id?: string; message?: string }
    if (!response.ok) {
      const error = json.message || `Resend email failed with HTTP ${response.status}`
      await logEmail(input, { status: 'failed', error })
      return { ok: false, error }
    }

    await logEmail(input, { status: 'sent', providerMessageId: json.id })
    return { ok: true, providerMessageId: json.id }
  } catch (error) {
    const message = errorMessage(error)
    await logEmail(input, { status: 'failed', error: message })
    return { ok: false, error: message }
  }
}

function renderCustomerEstimateEmail(input: CustomerEstimateEmailInput): string {
  const flags = input.estimate.consultationFlags
  const flagHtml = flags.length > 0 || input.estimate.needsCallUs
    ? `<p style="background:#fff3cd;border-left:4px solid #d39e00;padding:12px 14px;">Some details may need a quick review: ${escapeHtml(flags.join(', ') || 'consultation recommended')}.</p>`
    : ''

  return `
    <div style="font-family:Arial,sans-serif;color:#172026;line-height:1.5;">
      <h1 style="font-size:24px;margin:0 0 16px;">Your Royal Glass estimate</h1>
      <p>Hi ${escapeHtml(input.customerName || 'there')},</p>
      <p>Thanks for using the Royal Glass calculator. Based on your selections, your estimated range is:</p>
      <p style="font-size:28px;font-weight:700;margin:20px 0;">$${input.estimate.low.toLocaleString()} - $${input.estimate.high.toLocaleString()}</p>
      ${flagHtml}
      <p>We have received your details and will be in touch shortly to confirm the job details.</p>
      <p style="margin-top:24px;">Royal Glass</p>
    </div>
  `
}

async function logEmail(
  input: CustomerEstimateEmailInput,
  result: { status: string; providerMessageId?: string; error?: string },
) {
  await db.insert(leadEmailLog).values({
    leadId: input.leadId,
    recipient: input.to,
    status: result.status,
    providerMessageId: result.providerMessageId ?? null,
    error: result.error ?? null,
  })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
