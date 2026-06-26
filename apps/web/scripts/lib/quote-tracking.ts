// Simple POC view-tracking for the local quote viewer.
//
// Captures, per viewing session: raw IP, a coarse device string (parsed from
// the User-Agent), and active time-per-page. Time only accrues while the tab is
// visible and the page is the active one — the browser pauses/flushes via
// visibilitychange + pagehide (see quote-server viewer JS).
//
// Storage is intentionally throwaway for the POC: an in-memory map, a live
// console line per event, a JSON snapshot under tmp/quote-tracking/<code>.json,
// and a summary table on shutdown. No DB, no schema changes (that's Stage 4).

import type { IncomingMessage } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type TrackBeacon = {
  sessionId: string
  page: number
  ms: number
  /** First beacon of a session — captures IP/device even on an instant close. */
  open?: boolean
}

type Session = {
  ip: string
  device: string
  userAgent: string
  firstSeen: number
  lastSeen: number
  /** Accumulated active milliseconds keyed by page number. */
  pagesMs: Record<number, number>
}

export type Tracker = {
  /** Handle a POST /track beacon. `body` is the raw request body string. */
  handleBeacon: (req: IncomingMessage, body: string) => void
  /** Print the per-session summary table (called on shutdown). */
  printSummary: () => void
}

/** Pull the visitor's real IP, accounting for the Cloudflare tunnel hop. */
function extractIp(req: IncomingMessage): string {
  const cf = req.headers['cf-connecting-ip']
  if (typeof cf === 'string' && cf) return cf
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim()
  return req.socket.remoteAddress ?? 'unknown'
}

/** Coarse, dependency-free device label, e.g. "Mobile · iOS · Safari". */
function parseDevice(ua: string): string {
  if (!ua) return 'Unknown device'

  const os =
    /iPhone|iPad|iPod/i.test(ua) ? 'iOS'
    : /Android/i.test(ua) ? 'Android'
    : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/i.test(ua) ? 'macOS'
    : /Linux/i.test(ua) ? 'Linux'
    : 'Unknown OS'

  const form =
    /iPad|Tablet/i.test(ua) ? 'Tablet'
    : /Mobi|iPhone|Android.*Mobile/i.test(ua) ? 'Mobile'
    : 'Desktop'

  const browser =
    /Edg\//i.test(ua) ? 'Edge'
    : /OPR\/|Opera/i.test(ua) ? 'Opera'
    : /Chrome\//i.test(ua) && !/Chromium/i.test(ua) ? 'Chrome'
    : /Firefox\//i.test(ua) ? 'Firefox'
    : /Safari\//i.test(ua) ? 'Safari'
    : 'Unknown browser'

  return `${form} · ${os} · ${browser}`
}

function fmtSecs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

export function createTracker(code: string): Tracker {
  const sessions = new Map<string, Session>()
  const dir = join(process.cwd(), 'tmp', 'quote-tracking')
  const file = join(dir, `${code}.json`)
  mkdirSync(dir, { recursive: true })

  function persist(): void {
    const out = {
      code,
      updatedAt: new Date().toISOString(),
      sessions: [...sessions.entries()].map(([sessionId, s]) => ({
        sessionId,
        ip: s.ip,
        device: s.device,
        firstSeen: new Date(s.firstSeen).toISOString(),
        lastSeen: new Date(s.lastSeen).toISOString(),
        totalMs: Object.values(s.pagesMs).reduce((a, b) => a + b, 0),
        pagesMs: s.pagesMs,
      })),
    }
    try {
      writeFileSync(file, JSON.stringify(out, null, 2))
    } catch {
      // Tracking is best-effort for the POC — never break the viewer on a write error.
    }
  }

  function handleBeacon(req: IncomingMessage, body: string): void {
    let beacon: TrackBeacon
    try {
      beacon = JSON.parse(body)
    } catch {
      return
    }
    if (!beacon?.sessionId) return

    const now = Date.now()
    let session = sessions.get(beacon.sessionId)
    if (!session) {
      const ip = extractIp(req)
      const ua = String(req.headers['user-agent'] ?? '')
      const device = parseDevice(ua)
      session = { ip, device, userAgent: ua, firstSeen: now, lastSeen: now, pagesMs: {} }
      sessions.set(beacon.sessionId, session)
      console.log(`[track] ${ip} · ${device} · opened quote`)
    }

    session.lastSeen = now
    const ms = Number(beacon.ms) || 0
    if (!beacon.open && ms > 0 && Number.isFinite(beacon.page)) {
      const page = Number(beacon.page)
      session.pagesMs[page] = (session.pagesMs[page] ?? 0) + ms
      console.log(`[track] ${session.ip} · ${session.device} · page ${page} · ${fmtSecs(ms)}`)
    }
    persist()
  }

  function printSummary(): void {
    if (sessions.size === 0) {
      console.log('\n[track] No views recorded this session.')
      return
    }
    console.log('\n──────── Quote view tracking ────────')
    let i = 0
    for (const session of sessions.values()) {
      i++
      const total = Object.values(session.pagesMs).reduce((a, b) => a + b, 0)
      console.log(`\nSession ${i}:`)
      console.log(`  IP:      ${session.ip}`)
      console.log(`  Device:  ${session.device}`)
      console.log(`  Total:   ${fmtSecs(total)}`)
      const pages = Object.keys(session.pagesMs)
        .map(Number)
        .sort((a, b) => a - b)
      for (const page of pages) {
        console.log(`    page ${page}: ${fmtSecs(session.pagesMs[page])}`)
      }
    }
    console.log(`\nSaved to tmp/quote-tracking/${code}.json`)
    console.log('─────────────────────────────────────')
  }

  return { handleBeacon, printSummary }
}
