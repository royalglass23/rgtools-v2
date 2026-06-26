// @vitest-environment node
import { config } from 'dotenv'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { neon } from '@neondatabase/serverless'

import cleanupWorker from '../../../../workers/cleanup/src/index'
import trackerWorker from '../../../../workers/tracker/src/index'
import viewerWorker from '../../../../workers/viewer/src/index'

config({ path: '../../.env.local' })

type SqlClient = ReturnType<typeof neon>

const TEST_KEYS = [
  'track.ip',
  'track.geo',
  'track.page_completion',
  'track.distinct_viewers',
  'track.active_time',
  'notifications.enabled',
  'notifications.to',
]

const databaseUrl = process.env.DATABASE_URL
const describeWithDb = databaseUrl ? describe : describe.skip

function makeR2Bucket() {
  const deletedKeys: string[] = []
  return {
    deletedKeys,
    async get() {
      return {
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('%PDF-1.4\n% test quote\n'))
            controller.close()
          },
        }),
      }
    },
    async delete(key: string) {
      deletedKeys.push(key)
    },
  }
}

function trackRequest(payload: Record<string, unknown>, ip: string, userAgent: string) {
  return new Request('https://track.test/track', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip,
      'User-Agent': userAgent,
    },
    body: JSON.stringify(payload),
  })
}

async function readQuote(sql: SqlClient, quoteId: string) {
  const rows = await sql`
    SELECT expires_at, archived_at, pdf_storage_key, opened_notified_at, high_intent_notified_at
    FROM quotes
    WHERE id = ${quoteId}
    LIMIT 1
  `
  return rows[0] as {
    expires_at: Date | string | null
    archived_at: Date | string | null
    pdf_storage_key: string | null
    opened_notified_at: Date | string | null
    high_intent_notified_at: Date | string | null
  }
}

describeWithDb('quote tracking lifecycle integration', () => {
  const sql = neon(databaseUrl ?? '')
  const quoteId = crypto.randomUUID()
  const token = crypto.randomUUID()
  const shortCode = `QT${Date.now().toString(36).slice(-8)}`
  const storageKey = `test/quote-tracking-lifecycle/${quoteId}.pdf`
  const sessionOne = crypto.randomUUID()
  const sessionTwo = crypto.randomUUID()
  const oldSettings = new Map<string, string | null>()
  const bucket = makeR2Bucket()

  beforeAll(async () => {
    const rows = await sql`
      SELECT key, value FROM settings
      WHERE key = ANY(${TEST_KEYS})
    ` as Array<{ key: string; value: string }>

    for (const key of TEST_KEYS) {
      oldSettings.set(key, rows.find((row) => row.key === key)?.value ?? null)
    }

    const desiredSettings: Record<string, string> = {
      'track.ip': 'true',
      'track.geo': 'true',
      'track.page_completion': 'true',
      'track.distinct_viewers': 'true',
      'track.active_time': 'true',
      'notifications.enabled': 'true',
      'notifications.to': 'qa@example.test',
    }

    for (const [key, value] of Object.entries(desiredSettings)) {
      await sql`
        INSERT INTO settings (key, value)
        VALUES (${key}, ${value})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `
    }

    await sql`
      INSERT INTO quotes (
        id, servicem8_uuid, client_name, company_name, job_description, job_address,
        quote_value, pdf_storage_key, short_code, token, expires_at, status_tag
      )
      VALUES (
        ${quoteId}, ${`qt-test-lifecycle-${quoteId}`}, 'QT TEST Lifecycle Client',
        'QT TEST Company', 'Automated tracking lifecycle quote', '1 Test Lane',
        '1234.56', ${storageKey}, ${shortCode}, ${token}::uuid,
        NOW() + INTERVAL '1 hour', 'cold'
      )
    `
  })

  afterAll(async () => {
    await sql`DELETE FROM quote_notified_viewers WHERE quote_id = ${quoteId}`
    await sql`DELETE FROM quote_viewer_emails WHERE quote_id = ${quoteId}`
    await sql`DELETE FROM quote_events WHERE quote_id = ${quoteId}`
    await sql`DELETE FROM quote_engagement WHERE quote_id = ${quoteId}`
    await sql`DELETE FROM quotes WHERE id = ${quoteId}`

    for (const [key, value] of oldSettings.entries()) {
      if (value == null) {
        await sql`DELETE FROM settings WHERE key = ${key}`
      } else {
        await sql`
          INSERT INTO settings (key, value)
          VALUES (${key}, ${value})
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `
      }
    }

    vi.restoreAllMocks()
  })

  it('serves the active test quote, records tracking, sends mocked notifications, then expires and archives it', async () => {
    const viewerEnv = {
      DATABASE_URL: databaseUrl,
      QUOTES_BUCKET: bucket,
      TRACKER_URL: 'https://track.test/track',
    }
    const trackerEnv = { DATABASE_URL: databaseUrl }
    const notificationEnv = { DATABASE_URL: databaseUrl, RESEND_API_KEY: 'test-resend-key', TEST_QUOTE_ID: quoteId }
    const cleanupEnv = { DATABASE_URL: databaseUrl, QUOTES_BUCKET: bucket }

    const activeViewer = await viewerWorker.fetch(new Request(`https://quotes.test/q/${shortCode}`), viewerEnv as never)
    expect(activeViewer.status).toBe(200)

    const activePdf = await viewerWorker.fetch(new Request(`https://quotes.test/q/${shortCode}/pdf`, { method: 'HEAD' }), viewerEnv as never)
    expect(activePdf.status).toBe(200)

    for (const request of [
      trackRequest({ token, event: 'open', session: sessionOne }, '203.0.113.10', 'Lifecycle Desktop/1.0'),
      trackRequest({ token, event: 'page_view', session: sessionOne, pageNumber: 2, duration: 12000 }, '203.0.113.10', 'Lifecycle Desktop/1.0'),
      trackRequest({ token, event: 'scroll', session: sessionOne, depth: 90 }, '203.0.113.10', 'Lifecycle Desktop/1.0'),
      trackRequest({ token, event: 'close', session: sessionOne, activeDurationMs: 45000 }, '203.0.113.10', 'Lifecycle Desktop/1.0'),
      trackRequest({ token, event: 'open', session: sessionTwo }, '203.0.113.20', 'Lifecycle Mobile/1.0 Mobile'),
    ]) {
      const response = await trackerWorker.fetch(request, trackerEnv as never)
      expect(response.status).toBe(204)
    }

    const [engagement] = await sql`
      SELECT total_opens, unique_sessions, unique_devices, forwarding_suspected,
        max_scroll_depth, max_page_number, total_time_ms
      FROM quote_engagement
      WHERE quote_id = ${quoteId}
    ` as Array<{
      total_opens: number
      unique_sessions: number
      unique_devices: number
      forwarding_suspected: boolean
      max_scroll_depth: number
      max_page_number: number
      total_time_ms: number
    }>

    expect(Number(engagement.total_opens)).toBe(2)
    expect(Number(engagement.unique_sessions)).toBe(2)
    expect(Number(engagement.unique_devices)).toBe(2)
    expect(engagement.forwarding_suspected).toBe(true)
    expect(Number(engagement.max_scroll_depth)).toBe(90)
    expect(Number(engagement.max_page_number)).toBe(2)
    expect(Number(engagement.total_time_ms)).toBe(45000)

    const [{ events, events_with_user_agent_hash: eventsWithUserAgentHash }] = await sql`
      SELECT COUNT(*)::int AS events,
        COUNT(user_agent_hash)::int AS events_with_user_agent_hash
      FROM quote_events
      WHERE quote_id = ${quoteId}
    ` as Array<{ events: number; events_with_user_agent_hash: number }>
    expect(Number(events)).toBe(5)
    expect(Number(eventsWithUserAgentHash)).toBe(5)

    const realFetch = globalThis.fetch
    const resendFetch = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url === 'https://api.resend.com/emails') {
        return Promise.resolve(new Response(JSON.stringify({ id: 'email-test' }), { status: 200 }))
      }
      return realFetch(input, init)
    })
    const { default: notifierWorker } = await import('../../../../workers/notifier/src/index')
    await notifierWorker.scheduled({} as ScheduledEvent, notificationEnv as never)

    const resendCalls = resendFetch.mock.calls.filter(([input]) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      return url === 'https://api.resend.com/emails'
    })
    expect(resendCalls).toHaveLength(3)
    const emailSubjects = resendCalls.map(([, init]) => {
      const body = JSON.parse(String((init as RequestInit).body))
      return body.subject as string
    })
    expect(emailSubjects.filter((subject) => subject.startsWith('Quote opened -'))).toHaveLength(2)
    expect(emailSubjects.some((subject) => subject.startsWith('High interest -'))).toBe(true)

    const [{ notified }] = await sql`
      SELECT COUNT(*)::int AS notified
      FROM quote_notified_viewers
      WHERE quote_id = ${quoteId}
    ` as Array<{ notified: number }>
    expect(Number(notified)).toBe(2)

    const notifiedQuote = await readQuote(sql, quoteId)
    expect(notifiedQuote.opened_notified_at).not.toBeNull()
    expect(notifiedQuote.high_intent_notified_at).not.toBeNull()

    await sql`UPDATE quotes SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = ${quoteId}`
    const expiredViewer = await viewerWorker.fetch(new Request(`https://quotes.test/q/${shortCode}`), viewerEnv as never)
    expect(expiredViewer.status).toBe(410)

    await cleanupWorker.scheduled({} as ScheduledEvent, cleanupEnv as never)
    const archivedQuote = await readQuote(sql, quoteId)
    expect(archivedQuote.archived_at).not.toBeNull()
    expect(archivedQuote.pdf_storage_key).toBeNull()
    expect(bucket.deletedKeys).toContain(storageKey)

    const archivedViewer = await viewerWorker.fetch(new Request(`https://quotes.test/q/${shortCode}`), viewerEnv as never)
    expect(archivedViewer.status).toBe(404)
  })
})
