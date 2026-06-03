import { neon } from '@neondatabase/serverless'
import { validatePayload } from './validate'
import type { BeaconPayload } from './validate'

export interface Env {
  DATABASE_URL: string
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    }
  }

  return {
    message: String(error),
    stack: null,
    name: typeof error,
  }
}

function logWorkerError(source: string, error: unknown, metadata: Record<string, unknown> = {}): string {
  const errorId = crypto.randomUUID()
  const normalized = normalizeError(error)

  console.error(JSON.stringify({
    id: errorId,
    level: 'error',
    source,
    message: normalized.message,
    stack: normalized.stack,
    metadata: {
      errorName: normalized.name,
      ...metadata,
    },
    createdAt: new Date().toISOString(),
  }))

  return errorId
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function detectDevice(ua: string): 'mobile' | 'desktop' {
  return /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop'
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

async function handleTrack(request: Request, env: Env, payload: BeaconPayload): Promise<Response> {
  const { token, event, session, depth, duration } = payload
  const sql = neon(env.DATABASE_URL)

  const rows = await sql`
    SELECT id FROM quotes WHERE token = ${token}::uuid AND archived_at IS NULL LIMIT 1
  `
  if (rows.length === 0) return new Response(null, { status: 404, headers: CORS_HEADERS })

  const quoteId = rows[0].id as string
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const ipHash = await hashIp(ip)
  const deviceType = detectDevice(request.headers.get('User-Agent') ?? '')

  await sql`
    INSERT INTO quote_events (quote_id, event_type, device_type, session_id, scroll_depth, duration_ms, ip_hash)
    VALUES (
      ${quoteId}, ${event}, ${deviceType},
      ${session}::uuid, ${depth ?? null}, ${duration ?? null}, ${ipHash}
    )
  `

  if (event === 'open') {
    const [{ session_count }] = await sql`
      SELECT COUNT(*) AS session_count FROM quote_events
      WHERE quote_id = ${quoteId} AND session_id = ${session}::uuid AND event_type = 'open'
    `
    const [{ device_count }] = await sql`
      SELECT COUNT(*) AS device_count FROM quote_events
      WHERE quote_id = ${quoteId} AND device_type = ${deviceType} AND event_type = 'open'
    `
    const newSession = Number(session_count) <= 1 ? 1 : 0
    const newDevice = Number(device_count) <= 1 ? 1 : 0

    await sql`
      INSERT INTO quote_engagement (quote_id, total_opens, unique_sessions, unique_devices, last_opened_at, updated_at)
      VALUES (${quoteId}, 1, ${newSession}, ${newDevice}, NOW(), NOW())
      ON CONFLICT (quote_id) DO UPDATE SET
        total_opens    = quote_engagement.total_opens + 1,
        unique_sessions = quote_engagement.unique_sessions + ${newSession},
        unique_devices  = quote_engagement.unique_devices + ${newDevice},
        last_opened_at  = NOW(),
        updated_at      = NOW()
    `
  } else if (event === 'close' && duration != null) {
    await sql`
      INSERT INTO quote_engagement (quote_id, total_time_ms, updated_at)
      VALUES (${quoteId}, ${duration}, NOW())
      ON CONFLICT (quote_id) DO UPDATE SET
        total_time_ms = quote_engagement.total_time_ms + ${duration},
        updated_at    = NOW()
    `
  } else if (event === 'scroll' && depth != null) {
    await sql`
      INSERT INTO quote_engagement (quote_id, max_scroll_depth, updated_at)
      VALUES (${quoteId}, ${depth}, NOW())
      ON CONFLICT (quote_id) DO UPDATE SET
        max_scroll_depth = GREATEST(quote_engagement.max_scroll_depth, ${depth}),
        updated_at       = NOW()
    `
  }

  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    if (url.pathname !== '/track') {
      return new Response(null, { status: 404, headers: CORS_HEADERS })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return new Response(null, { status: 400, headers: CORS_HEADERS })
    }

    if (!validatePayload(body)) {
      return new Response(null, { status: 400, headers: CORS_HEADERS })
    }

    try {
      return await handleTrack(request, env, body)
    } catch (err) {
      const errorId = logWorkerError('tracker.handleTrack', err, {
        path: url.pathname,
        event: body.event,
        token: body.token,
        session: body.session,
        userAgent: request.headers.get('User-Agent') ?? '',
      })

      return new Response(null, {
        status: 204,
        headers: {
          ...CORS_HEADERS,
          'X-RG-Error-Id': errorId,
        },
      })
    }
  },
}

export default worker
