import { NextRequest, NextResponse, after } from 'next/server'
import { getClientIp } from '@/modules/lead-intake/anti-spam/client-ip'
import { checkLeadSubmitRateLimit } from '@/modules/lead-intake/anti-spam/rate-limit'
import { verifyTurnstileToken } from '@/modules/lead-intake/anti-spam/verify-turnstile'
import {
  mapCalculatorSubmissionToIntakeInput,
  normalizeEstimate,
  type CalculatorSubmission,
} from '@/modules/lead-intake/calculator/map-calculator-submission'
import { saveLeadSubmitFailure } from '@/modules/lead-intake/calculator/submit-failures'
import { sendCustomerEstimateEmail } from '@/modules/lead-intake/email/customer-estimate'
import { syncLeadToServiceM8 } from '@/modules/lead-intake/servicem8/sync'
import { submitLeadIntakeForUser } from '@/modules/lead-intake/actions'

const MINIMUM_SUBMIT_AGE_MS = 3000

function allowedOrigin(): string {
  return process.env.CALCULATOR_ALLOWED_ORIGIN || 'https://royalglass.co.nz'
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID()
  const ip = getClientIp(request.headers)
  let payload: unknown = null

  try {
    const originResult = validateOrigin(request)
    if (!originResult.ok) {
      logSubmit({ correlationId, ip, stage: 'cors', outcome: 'rejected', reason: 'origin_not_allowed' })
      return json({ error: 'Forbidden' }, 403, request)
    }

    payload = await readJsonBody(request)
    const submission = payload as CalculatorSubmission

    if (stringValue(submission.lead?.websiteUrl)) {
      logSubmit({ correlationId, ip, stage: 'honeypot', outcome: 'rejected', reason: 'honeypot_filled' })
      return json({ error: 'Forbidden' }, 403, request)
    }

    const loadedAt = numberValue(submission.loadedAt)
    if (!Number.isFinite(loadedAt)) {
      logSubmit({ correlationId, ip, stage: 'time_gate', outcome: 'rejected', reason: 'missing_loaded_at' })
      return json({ error: 'Invalid payload' }, 400, request)
    }

    if (Date.now() - loadedAt < MINIMUM_SUBMIT_AGE_MS) {
      logSubmit({ correlationId, ip, stage: 'time_gate', outcome: 'rejected', reason: 'too_fast' })
      return json({ error: 'Forbidden' }, 403, request)
    }

    const turnstile = await verifyTurnstileToken(submission.turnstileToken, ip)
    if (!turnstile.ok) {
      logSubmit({ correlationId, ip, stage: 'turnstile', outcome: 'rejected', reason: turnstile.reason })
      return json({ error: 'Forbidden' }, 403, request)
    }

    const rateLimit = await checkLeadSubmitRateLimit(ip)
    if (!rateLimit.ok) {
      logSubmit({ correlationId, ip, stage: 'rate_limit', outcome: 'rejected', reason: 'too_many_attempts' })
      return json(
        { error: 'Too many submissions' },
        429,
        request,
        { 'retry-after': String(rateLimit.retryAfterSeconds) },
      )
    }

    let input
    try {
      input = mapCalculatorSubmissionToIntakeInput(submission, {
        submittedAt: new Date(),
        submissionRef: `calculator:${Date.now()}-${crypto.randomUUID()}`,
      })
    } catch (error) {
      const message = errorMessage(error)
      await deadLetter({ correlationId, ip, stage: 'map', error: message, payload })
      return json({ error: 'Unable to submit lead' }, 500, request)
    }

    const result = await submitLeadIntakeForUser(input, null, { syncServiceM8: false })
    if (!('success' in result)) {
      await deadLetter({ correlationId, ip, stage: 'save', error: result.error, payload })
      return json({ error: 'Unable to submit lead' }, 500, request)
    }

    logSubmit({ correlationId, ip, stage: 'save', outcome: 'accepted', reason: result.leadId })

    const emailInput = {
      leadId: result.leadId,
      to: stringValue(submission.lead?.email),
      customerName: input.clientName,
      estimate: normalizeEstimate(submission.estimate),
      projectType: input.projectType,
      correlationId,
    }

    // Run the email after the response is sent so the customer never waits on it.
    // after() keeps the serverless function alive until this completes — a plain
    // fire-and-forget promise would be frozen/killed once the response returns.
    // The lead is already saved, so a scheduling failure here must never turn the
    // request into a 500: wrap it and still return success.
    try {
      after(async () => {
        // ServiceM8 sync runs here (not inline) so the customer never waits on it,
        // but it still happens automatically — no cron/retry batch required. The lead
        // is left as pending_sync by submitLeadIntakeForUser until this completes.
        try {
          const sm8 = await syncLeadToServiceM8(result.leadId)
          logSubmit({
            correlationId,
            ip,
            stage: 'sm8',
            outcome: sm8.ok ? 'accepted' : 'error',
            reason: sm8.ok ? sm8.reference : sm8.error,
          })
        } catch (error) {
          logSubmit({ correlationId, ip, stage: 'sm8', outcome: 'error', reason: errorMessage(error) })
        }

        try {
          const emailResult = await sendCustomerEstimateEmail(emailInput)
          logSubmit({
            correlationId,
            ip,
            stage: 'email',
            outcome: emailResult.ok ? 'accepted' : 'error',
            reason: emailResult.ok ? 'queued' : emailResult.error,
          })
        } catch (error) {
          logSubmit({ correlationId, ip, stage: 'email', outcome: 'error', reason: errorMessage(error) })
        }
      })
    } catch (schedulingError) {
      logSubmit({ correlationId, ip, stage: 'email', outcome: 'error', reason: errorMessage(schedulingError) })
    }

    return json({ ok: true, leadId: result.leadId }, 200, request)
  } catch (error) {
    const message = errorMessage(error)
    logSubmit({ correlationId, ip, stage: 'save', outcome: 'error', reason: message })
    if (payload !== null) {
      await deadLetter({ correlationId, ip, stage: 'save', error: message, payload })
    }
    return json({ error: 'Unable to submit lead' }, 500, request)
  }
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

async function deadLetter(input: {
  correlationId: string
  ip: string
  stage: string
  error: string
  payload: unknown
}) {
  logSubmit({
    correlationId: input.correlationId,
    ip: input.ip,
    stage: input.stage,
    outcome: 'error',
    reason: input.error,
  })
  await saveLeadSubmitFailure(input)
}

function corsHeaders(request: NextRequest, extra: Record<string, string> = {}) {
  const origin = request.headers.get('origin')
  const allowed = allowedOrigin()
  return {
    ...(origin === allowed ? { 'access-control-allow-origin': allowed } : {}),
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'vary': 'Origin',
    ...extra,
  }
}

function validateOrigin(request: NextRequest): { ok: true } | { ok: false } {
  return request.headers.get('origin') === allowedOrigin() ? { ok: true } : { ok: false }
}

function json(body: unknown, status: number, request: NextRequest, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: corsHeaders(request, headers),
  })
}

function stringValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}

function numberValue(value: unknown): number {
  const number = typeof value === 'number' ? value : Number.parseFloat(stringValue(value))
  return Number.isFinite(number) ? number : Number.NaN
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function logSubmit(entry: {
  correlationId: string
  ip: string
  stage: string
  outcome: 'accepted' | 'rejected' | 'error'
  reason: string
}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    source: 'calculator-submit',
    correlationId: entry.correlationId,
    ip: entry.ip,
    stage: entry.stage,
    outcome: entry.outcome,
    reason: entry.reason,
  }

  if (entry.outcome === 'error') console.error(JSON.stringify(logEntry))
  else if (entry.outcome === 'rejected') console.warn(JSON.stringify(logEntry))
  else console.info(JSON.stringify(logEntry))
}
