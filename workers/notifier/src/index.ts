export interface Env {
  DATABASE_URL: string
  RESEND_API_KEY: string
}

type SqlClient = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>

type QuoteNotificationRow = {
  id: string
  short_code: string | null
  client_name: string
  job_description: string | null
  quote_value: string | null
  total_opens: number
  last_opened_at: string | Date | null
  forwarding_suspected: boolean
  max_scroll_depth: number
  total_time_ms: number
  latest_city: string | null
  latest_device: string | null
}

const DEFAULT_TO = ['support@royalglass.co.nz']
const FROM = 'Royal Glass <noreply@royalglass.co.nz>'
const VIEWER_BASE_URL = 'https://quotes.royalglass.co.nz'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseRecipients(value: string | null): string[] {
  const recipients = new Set<string>()

  for (const part of (value ?? '').split(/[;,\n]/)) {
    const email = part.trim().toLowerCase()
    if (EMAIL_RE.test(email)) recipients.add(email)
  }

  return Array.from(recipients)
}

function formatCurrency(value: string | null): string {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(Number(value ?? 0))
}

function formatDate(value: string | Date | null): string {
  if (value == null) return 'Unknown'
  return new Date(value).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })
}

async function getNotificationSettings(sql: SqlClient) {
  const rows = await sql`
    SELECT key, value FROM settings
    WHERE key IN ('notifications.enabled', 'notifications.to')
  ` as Array<{ key: string; value: string }>

  const enabled = rows.find((row) => row.key === 'notifications.enabled')?.value !== 'false'
  const configuredTo = parseRecipients(rows.find((row) => row.key === 'notifications.to')?.value ?? null)

  return {
    enabled,
    to: configuredTo.length > 0 ? configuredTo : DEFAULT_TO,
  }
}

async function isInternalOnlyOpen(sql: SqlClient, quoteId: string): Promise<boolean> {
  const rows = await sql`
    WITH first_event AS (
      SELECT session_id, ip
      FROM quote_events
      WHERE quote_id = ${quoteId}
        AND event_type = 'open'
      ORDER BY created_at ASC
      LIMIT 1
    )
    SELECT
      COUNT(DISTINCT qe.session_id) AS session_count,
      COUNT(*) FILTER (WHERE qe.ip IS DISTINCT FROM first_event.ip) AS different_ip_count
    FROM quote_events qe
    CROSS JOIN first_event
    WHERE qe.quote_id = ${quoteId}
      AND qe.event_type = 'open'
  ` as Array<{ session_count: string | number; different_ip_count: string | number }>

  const row = rows[0]
  if (!row) return false

  return Number(row.session_count) === 1 && Number(row.different_ip_count) === 0
}

async function hasReturnVisit(sql: SqlClient, quoteId: string): Promise<boolean> {
  const rows = await sql`
    SELECT COUNT(DISTINCT DATE(created_at)) AS open_days
    FROM quote_events
    WHERE quote_id = ${quoteId}
      AND event_type = 'open'
  ` as Array<{ open_days: string | number }>

  return Number(rows[0]?.open_days ?? 0) >= 2
}

async function hasCta(sql: SqlClient, quoteId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM quote_events
    WHERE quote_id = ${quoteId}
      AND event_type = 'cta'
    LIMIT 1
  `

  return rows.length > 0
}

function quoteLink(shortCode: string | null): string {
  return shortCode ? `${VIEWER_BASE_URL}/q/${shortCode}` : VIEWER_BASE_URL
}

async function sendEmail(env: Env, to: string[], subject: string, text: string): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject,
      text,
    }),
  })

  if (!response.ok) {
    throw new Error(`Resend failed with HTTP ${response.status}: ${await response.text()}`)
  }
}

function openEmail(row: QuoteNotificationRow) {
  return {
    subject: `Quote opened - ${row.client_name}`,
    text: `Your quote to ${row.client_name} was just opened.

Quote: ${row.job_description ?? 'Quote'}
Value: ${formatCurrency(row.quote_value)}
Location: ${row.latest_city ?? 'Unknown'}
Device: ${row.latest_device ?? 'Unknown'}
Link: ${quoteLink(row.short_code)}

- Royal Glass rgtools`,
  }
}

function highIntentEmail(row: QuoteNotificationRow) {
  return {
    subject: `High interest - ${row.client_name} is engaged`,
    text: `${row.client_name} is showing strong interest in your quote.

Opens: ${row.total_opens}
Forwarding suspected: ${row.forwarding_suspected ? 'yes' : 'no'}
Last opened: ${formatDate(row.last_opened_at)}
Link: ${quoteLink(row.short_code)}

- Royal Glass rgtools`,
  }
}

async function firstOpenCandidates(sql: SqlClient): Promise<QuoteNotificationRow[]> {
  return await sql`
    SELECT
      q.id, q.short_code, q.client_name, q.job_description, q.quote_value,
      qe.total_opens, qe.last_opened_at, qe.forwarding_suspected,
      qe.max_scroll_depth, qe.total_time_ms,
      (
        SELECT geo_city FROM quote_events
        WHERE quote_id = q.id AND event_type = 'open'
        ORDER BY created_at DESC
        LIMIT 1
      ) AS latest_city,
      (
        SELECT device_type FROM quote_events
        WHERE quote_id = q.id AND event_type = 'open'
        ORDER BY created_at DESC
        LIMIT 1
      ) AS latest_device
    FROM quotes q
    JOIN quote_engagement qe ON qe.quote_id = q.id
    WHERE q.opened_notified_at IS NULL
      AND qe.total_opens > 0
      AND q.archived_at IS NULL
  ` as QuoteNotificationRow[]
}

async function highIntentCandidates(sql: SqlClient): Promise<QuoteNotificationRow[]> {
  return await sql`
    SELECT
      q.id, q.short_code, q.client_name, q.job_description, q.quote_value,
      qe.total_opens, qe.last_opened_at, qe.forwarding_suspected,
      qe.max_scroll_depth, qe.total_time_ms,
      (
        SELECT geo_city FROM quote_events
        WHERE quote_id = q.id AND event_type = 'open'
        ORDER BY created_at DESC
        LIMIT 1
      ) AS latest_city,
      (
        SELECT device_type FROM quote_events
        WHERE quote_id = q.id AND event_type = 'open'
        ORDER BY created_at DESC
        LIMIT 1
      ) AS latest_device
    FROM quotes q
    JOIN quote_engagement qe ON qe.quote_id = q.id
    WHERE q.opened_notified_at IS NOT NULL
      AND q.high_intent_notified_at IS NULL
      AND q.archived_at IS NULL
      AND (
        qe.total_opens >= 3
        OR qe.forwarding_suspected = true
        OR (qe.max_scroll_depth > 80 AND qe.total_time_ms > 300000)
        OR (
          SELECT COUNT(DISTINCT DATE(created_at)) FROM quote_events
          WHERE quote_id = q.id AND event_type = 'open'
        ) >= 2
        OR EXISTS (
          SELECT 1 FROM quote_events
          WHERE quote_id = q.id AND event_type = 'cta'
        )
      )
  ` as QuoteNotificationRow[]
}

async function runNotifications(env: Env): Promise<{ opened: number; highIntent: number; skippedInternal: number }> {
  const { neon } = await import('@neondatabase/serverless')
  const sql = neon(env.DATABASE_URL) as SqlClient
  const settings = await getNotificationSettings(sql)

  if (!settings.enabled) return { opened: 0, highIntent: 0, skippedInternal: 0 }

  let opened = 0
  let highIntent = 0
  let skippedInternal = 0

  for (const row of await firstOpenCandidates(sql)) {
    if (await isInternalOnlyOpen(sql, row.id)) {
      skippedInternal += 1
      continue
    }

    const email = openEmail(row)
    await sendEmail(env, settings.to, email.subject, email.text)
    await sql`UPDATE quotes SET opened_notified_at = NOW(), updated_at = NOW() WHERE id = ${row.id}`
    opened += 1
  }

  for (const row of await highIntentCandidates(sql)) {
    if (await isInternalOnlyOpen(sql, row.id)) continue
    if (!await hasReturnVisit(sql, row.id) && row.total_opens < 3 && !row.forwarding_suspected
      && !(row.max_scroll_depth > 80 && row.total_time_ms > 300000) && !await hasCta(sql, row.id)) {
      continue
    }

    const email = highIntentEmail(row)
    await sendEmail(env, settings.to, email.subject, email.text)
    await sql`UPDATE quotes SET high_intent_notified_at = NOW(), updated_at = NOW() WHERE id = ${row.id}`
    highIntent += 1
  }

  return { opened, highIntent, skippedInternal }
}

const worker = {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const result = await runNotifications(env)
    console.log(JSON.stringify({ ...result, at: new Date().toISOString() }))
  },
}

export default worker
