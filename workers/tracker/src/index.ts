import { neon } from '@neondatabase/serverless'
import { validatePayload } from './validate'
import type { BeaconPayload } from './validate'

export interface Env {
  DATABASE_URL: string
}

type SqlClient = ReturnType<typeof neon>
type TrackingSettings = Record<string, boolean>

const TRACKING_SETTING_DEFAULTS: TrackingSettings = {
  'track.ip': true,
  'track.geo': true,
  'track.page_completion': true,
  'track.return_visits': true,
  'track.distinct_viewers': true,
  'track.download_print': true,
  'track.active_time': true,
  'track.time_to_open': true,
  'track.cta_clicks': true,
  'viewer.download': true,
  'viewer.print': true,
  'viewer.accept': false,
  'viewer.contact_us': false,
}

const settingsCache = new Map<string, { value: TrackingSettings; expiresAt: number }>()
const SETTINGS_CACHE_TTL_MS = 60_000

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

function trackingSettingForEvent(event: BeaconPayload['event']): string | null {
  if (event === 'page_view') return 'track.page_completion'
  if (event === 'download') return 'track.download_print'
  if (event === 'cta') return 'track.cta_clicks'
  if (event === 'close') return 'track.active_time'
  return null
}

async function getTrackingSettings(sql: SqlClient, env: Env): Promise<TrackingSettings> {
  const cached = settingsCache.get(env.DATABASE_URL)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const rows = await sql`
    SELECT key, value FROM settings
    WHERE key LIKE 'track.%' OR key LIKE 'viewer.%'
  `
  const value = { ...TRACKING_SETTING_DEFAULTS }

  for (const row of rows as Array<{ key: string; value: string }>) {
    if (Object.prototype.hasOwnProperty.call(value, row.key)) {
      value[row.key] = row.value !== 'false'
    }
  }

  settingsCache.set(env.DATABASE_URL, { value, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS })
  return value
}

function geoFields(request: Request, settings: TrackingSettings) {
  const cf = (request as Request & { cf?: Record<string, unknown> }).cf ?? {}

  return {
    ip: settings['track.ip'] ? request.headers.get('CF-Connecting-IP') ?? 'unknown' : null,
    country: settings['track.geo'] && typeof cf.country === 'string' ? cf.country : null,
    city: settings['track.geo'] && typeof cf.city === 'string' ? cf.city : null,
    region: settings['track.geo'] && typeof cf.region === 'string' ? cf.region : null,
    isp: settings['track.geo'] && typeof cf.asOrganization === 'string' ? cf.asOrganization : null,
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

async function handleTrack(request: Request, env: Env, payload: BeaconPayload): Promise<Response> {
  const { token, event, session, depth, duration, activeDurationMs, pageNumber } = payload
  const sql = neon(env.DATABASE_URL)
  const settings = await getTrackingSettings(sql, env)
  const eventSetting = trackingSettingForEvent(event)

  if (eventSetting && settings[eventSetting] === false) {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const rows = await sql`
    SELECT id FROM quotes WHERE token = ${token}::uuid AND archived_at IS NULL LIMIT 1
  `
  if (rows.length === 0) return new Response(null, { status: 404, headers: CORS_HEADERS })

  const quoteId = rows[0].id as string
  const geo = geoFields(request, settings)
  const ipHash = await hashIp(geo.ip ?? 'unknown')
  const deviceType = detectDevice(request.headers.get('User-Agent') ?? '')
  const eventDuration = event === 'close' ? activeDurationMs ?? duration ?? null : duration ?? null

  await sql`
    INSERT INTO quote_events (
      quote_id, event_type, device_type, session_id, scroll_depth, duration_ms,
      ip_hash, ip, geo_country, geo_city, geo_region, geo_isp, page_number
    )
    VALUES (
      ${quoteId}, ${event}, ${deviceType},
      ${session}::uuid, ${depth ?? null}, ${eventDuration}, ${ipHash},
      ${geo.ip}, ${geo.country}, ${geo.city}, ${geo.region}, ${geo.isp}, ${pageNumber ?? null}
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
    if (settings['track.distinct_viewers'] && settings['track.ip']) {
      const [{ ip_count }] = await sql`
        SELECT COUNT(DISTINCT ip) AS ip_count
        FROM quote_events
        WHERE quote_id = ${quoteId} AND ip IS NOT NULL
      `

      if (Number(ip_count) > 1) {
        await sql`
          INSERT INTO quote_engagement (quote_id, forwarding_suspected, updated_at)
          VALUES (${quoteId}, true, NOW())
          ON CONFLICT (quote_id) DO UPDATE SET
            forwarding_suspected = true,
            updated_at = NOW()
        `
      }
    }
  } else if (event === 'close' && eventDuration != null) {
    await sql`
      INSERT INTO quote_engagement (quote_id, total_time_ms, updated_at)
      VALUES (${quoteId}, ${eventDuration}, NOW())
      ON CONFLICT (quote_id) DO UPDATE SET
        total_time_ms = quote_engagement.total_time_ms + ${eventDuration},
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
  } else if (event === 'page_view' && pageNumber != null) {
    await sql`
      INSERT INTO quote_engagement (quote_id, max_page_number, updated_at)
      VALUES (${quoteId}, ${pageNumber}, NOW())
      ON CONFLICT (quote_id) DO UPDATE SET
        max_page_number = GREATEST(quote_engagement.max_page_number, ${pageNumber}),
        updated_at      = NOW()
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
