import { neon } from '@neondatabase/serverless'
import { renderPrivacyNotice } from './privacy-notice'

export interface Env {
  DATABASE_URL: string
  QUOTES_BUCKET: R2Bucket
  TRACKER_URL?: string
}

type QuoteRow = {
  id: string
  token: string
  pdf_storage_key: string | null
  expires_at: string | Date | null
  archived_at: string | Date | null
  email_gate_enabled: boolean
  email_gate_has_recipients: boolean
  client_name: string | null
  job_description: string | null
}

type QuoteState =
  | { status: 'missing' }
  | { status: 'archived' }
  | { status: 'expired'; quote: QuoteRow }
  | { status: 'ok'; quote: QuoteRow }

const PDFJS_LIB_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs'
const PDFJS_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs'
const ROYAL_GLASS_LOGO_DATA_URL = 'data:image/png;base64,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'

const TRACKING_SETTING_DEFAULTS = {
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

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  })
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  })
}

function emptyResponse(status: number, headers?: HeadersInit): Response {
  return new Response(null, { status, headers })
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeJsString(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n')
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function emailsMatch(viewerEmail: string, recipientEmail: string): boolean {
  return normalizeEmail(viewerEmail) === normalizeEmail(recipientEmail)
}

function isExpired(value: string | Date | null): boolean {
  if (value == null) return false
  return new Date(value).getTime() < Date.now()
}

async function loadQuote(code: string, env: Env): Promise<QuoteState> {
  const sql = neon(env.DATABASE_URL)
  const rows = await sql`
    SELECT
      id, token, pdf_storage_key, expires_at, archived_at, email_gate_enabled,
      EXISTS (
        SELECT 1 FROM quote_recipients WHERE quote_recipients.quote_id = quotes.id
      ) AS email_gate_has_recipients,
      client_name, job_description
    FROM quotes
    WHERE short_code = ${code}
    LIMIT 1
  `
  if (rows.length === 0) return { status: 'missing' }

  const quote = rows[0] as QuoteRow
  if (quote.archived_at != null) return { status: 'archived' }
  if (isExpired(quote.expires_at)) return { status: 'expired', quote }

  return { status: 'ok', quote }
}

async function getTrackingConfig(env: Env): Promise<Record<string, boolean>> {
  const sql = neon(env.DATABASE_URL)
  const rows = await sql`
    SELECT key, value FROM settings
    WHERE key LIKE 'track.%' OR key LIKE 'viewer.%'
  `
  const config = { ...TRACKING_SETTING_DEFAULTS }

  for (const row of rows as Array<{ key: string; value: string }>) {
    if (Object.prototype.hasOwnProperty.call(config, row.key)) {
      config[row.key as keyof typeof config] = row.value !== 'false'
    }
  }

  return config
}

async function handleGate(code: string, request: Request, env: Env): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  if (body == null || typeof body !== 'object') {
    return jsonResponse({ error: 'invalid_body' }, 400)
  }

  const payload = body as Record<string, unknown>
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  const name = typeof payload.name === 'string' && payload.name.trim() !== ''
    ? payload.name.trim().slice(0, 200)
    : null
  const token = payload.token
  const sessionId = payload.sessionId

  if (!isValidEmail(email) || !isUuid(token) || !isUuid(sessionId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }

  const sql = neon(env.DATABASE_URL)
  const rows = await sql`
    SELECT quotes.id AS quote_id, quote_recipients.id AS recipient_id, quote_recipients.email
    FROM quotes
    INNER JOIN quote_recipients ON quote_recipients.quote_id = quotes.id
    WHERE quotes.short_code = ${code}
      AND quotes.token = ${token}::uuid
      AND quotes.email_gate_enabled = true
      AND quotes.archived_at IS NULL
      AND (quotes.expires_at IS NULL OR quotes.expires_at >= NOW())
  `

  if (rows.length === 0) return jsonResponse({ error: 'not_found' }, 404)

  const recipient = (rows as Array<{ quote_id: string; recipient_id: string; email: string }>)
    .find((row) => emailsMatch(email, row.email))
  if (!recipient) {
    return jsonResponse({ error: 'email_mismatch' }, 403)
  }

  await sql`
    INSERT INTO quote_viewer_emails (quote_id, recipient_id, email, name, session_id, ip)
    VALUES (
      ${recipient.quote_id},
      ${recipient.recipient_id},
      ${email},
      ${name},
      ${sessionId}::uuid,
      ${request.headers.get('CF-Connecting-IP')}
    )
  `

  return jsonResponse({ ok: true }, 200)
}

async function handlePdf(code: string, env: Env, method: string): Promise<Response> {
  const state = await loadQuote(code, env)

  if (state.status === 'missing' || state.status === 'archived') return emptyResponse(404)
  if (state.status === 'expired') return jsonResponse({ error: 'expired' }, 410)

  const pdfStorageKey = state.quote.pdf_storage_key
  if (pdfStorageKey == null) return emptyResponse(404)

  const obj = await env.QUOTES_BUCKET.get(pdfStorageKey)
  if (obj == null) return emptyResponse(404)

  return new Response(method === 'HEAD' ? null : obj.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
    },
  })
}

async function handleViewer(code: string, env: Env, method: string): Promise<Response> {
  const state = await loadQuote(code, env)

  if (state.status === 'missing' || state.status === 'archived') return emptyResponse(404)
  if (state.status === 'expired') {
    return method === 'HEAD' ? emptyResponse(410, expiredHeaders()) : htmlResponse(expiredHtml(), 410)
  }

  const title = state.quote.client_name ?? state.quote.job_description ?? 'Quote'
  if (method === 'HEAD') return emptyResponse(200, htmlHeaders())

  const config = await getTrackingConfig(env)
  return htmlResponse(viewerHtml(
    code,
    title,
    state.quote.token,
    state.quote.email_gate_enabled && state.quote.email_gate_has_recipients,
    config,
    env.TRACKER_URL ?? '/track',
  ))
}

function htmlHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
  }
}

function expiredHeaders(): HeadersInit {
  return htmlHeaders()
}

function expiredHtml(): string {
  return `<!DOCTYPE html><html><head><title>Link Expired</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb}
.box{text-align:center;color:#374151}.sub{color:#6b7280;margin-top:8px;font-size:.9rem}</style></head>
<body><div class="box"><h1>This link has expired</h1>
<p class="sub">This quote link is no longer available.</p>
<p class="sub">Contact us if you need a new copy.</p></div></body></html>`
}

function viewerHtml(
  code: string,
  title: string,
  token: string,
  emailGateEnabled: boolean,
  config: Record<string, boolean>,
  trackerUrl: string,
): string {
  const safeCode = escapeJsString(code)
  const safeToken = escapeJsString(token)
  const safeTrackerUrl = escapeJsString(trackerUrl)
  const safeTitle = escapeHtml(title)
  const safeConfig = JSON.stringify(config).replace(/</g, '\\u003c')
  const gateDisplay = emailGateEnabled ? 'block' : 'none'
  const viewerDisplay = emailGateEnabled ? 'none' : 'block'

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #525659; font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    #gate {
      display: ${gateDisplay}; max-width: 400px; margin: 80px auto; padding: 2rem; color: #111827;
      background: #fff; border-radius: 8px; box-shadow: 0 12px 32px rgba(0,0,0,.22);
    }
    #gate h2 { margin: 0 0 1rem; font-size: 1.25rem; line-height: 1.3; }
    #gateName,
    #gateEmail {
      width: 100%; padding: .75rem; border: 1px solid #d1d5db; border-radius: 6px; margin-bottom: .75rem;
      font: inherit;
    }
    #gateSubmit {
      width: 100%; padding: .75rem; background: #1d4ed8; color: #fff; border: 0; border-radius: 6px;
      cursor: pointer; font: inherit; font-weight: 650;
    }
    #gateSubmit:disabled { opacity: .7; cursor: wait; }
    #gateError { color: #dc2626; margin: .5rem 0 0; display: none; font-size: .9rem; }
    #viewerWrap { display: ${viewerDisplay}; }
    #toolbar {
      position: sticky; top: 0; z-index: 10; display: grid; grid-template-columns: minmax(328px, 1fr) auto minmax(328px, 1fr); align-items: center;
      gap: 14px; padding: 8px 12px; background: rgba(38,40,42,.96); color: #eee; font-size: 13px;
      box-shadow: 0 1px 6px rgba(0,0,0,.4);
    }
    #toolbar .brandLink {
      justify-self: start; display: inline-flex; align-items: center; width: 328px; height: 88px;
      padding: 6px 8px; border-radius: 8px; transition: background .15s ease, transform .15s ease;
    }
    #toolbar .brandLink:hover { background: rgba(255,255,255,.08); transform: translateY(-1px); }
    #toolbar .brandLink img { display: block; max-width: 100%; max-height: 76px; object-fit: contain; }
    #toolbar .toolbarCenter { display: flex; align-items: center; justify-content: center; gap: 14px; min-width: 0; }
    #toolbar .group { display: flex; align-items: center; gap: 6px; }
    #featureButtons { justify-self: end; flex-wrap: wrap; justify-content: flex-end; }
    #toolbar button {
      min-width: 30px; height: 30px; border: 0; border-radius: 6px; background: #4a4d50; color: #fff;
      font-size: 13px; line-height: 1; cursor: pointer; padding: 0 10px;
    }
    #toolbar button:hover { background: #5d6164; }
    #zoomLabel { min-width: 44px; text-align: center; }
    #pageLabel { min-width: 78px; text-align: center; }
    #viewer { display: flex; flex-direction: column; align-items: center; padding: 20px 12px; }
    canvas { box-shadow: 0 2px 12px rgba(0,0,0,.4); max-width: 100%; height: auto; background: #fff; margin-bottom: 16px; }
    #loading { color: #ddd; text-align: center; padding: 40px 16px; font-size: 14px; }
    #actionBar {
      position: sticky; bottom: 0; z-index: 10; display: none; justify-content: center; gap: 10px;
      padding: 10px 12px; background: rgba(38,40,42,.96); box-shadow: 0 -1px 6px rgba(0,0,0,.4);
    }
    #actionBar button {
      border: 0; border-radius: 6px; background: #f5f7f8; color: #152c3a; padding: 9px 14px;
      font-size: 13px; font-weight: 650; cursor: pointer;
    }
    footer {
      color: #c7c7c7; text-align: center; font-size: 12px; padding: 18px 16px 28px;
      border-top: 1px solid rgba(255,255,255,.08);
    }
    footer a { color: #9fd0d8; text-decoration: none; }
    footer a:hover { text-decoration: underline; }
    @media (max-width: 860px) {
      #toolbar {
        grid-template-columns: 1fr auto;
        grid-template-areas:
          "brand features"
          "center center";
        gap: 8px 12px;
      }
      #toolbar .brandLink { grid-area: brand; width: min(264px, 68vw); height: 76px; padding-left: 0; }
      #toolbar .brandLink img { max-height: 66px; }
      #toolbar .toolbarCenter { grid-area: center; }
      #featureButtons { grid-area: features; }
    }
    #privacyModal {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(0,0,0,.7);
      display: flex; align-items: center; justify-content: center;
    }
    #privacyModal[hidden] { display: none; }
    #privacyModalBox {
      position: relative; width: min(820px, 96vw); height: 88vh;
      background: #1a1b1d; border-radius: 6px; overflow: hidden;
      display: flex; flex-direction: column;
    }
    #privacyModalClose {
      position: absolute; top: 10px; right: 14px; z-index: 1;
      background: transparent; border: none; color: #c7c7c7;
      font-size: 1.5rem; cursor: pointer; line-height: 1;
    }
    #privacyFrame { flex: 1; border: none; width: 100%; }
    .gate-notice { font-size: 0.75rem; color: #888; margin-top: 0.5rem; }
    .gate-notice a { color: #7ab4d8; }
  </style>
</head>
<body>
  <div id="gate">
    <h2>Enter your email to view this quote</h2>
    <input id="gateName" type="text" autocomplete="name" placeholder="Name (optional)">
    <input id="gateEmail" type="email" autocomplete="email" placeholder="your@email.com">
    <button id="gateSubmit" type="button">View Quote</button>
    <p class="gate-notice">Your email confirms access and lets Royal Glass know their quote was viewed. <a href="/privacy">Privacy &amp; Cookies</a></p>
    <p id="gateError"></p>
  </div>
  <div id="viewerWrap">
    <div id="toolbar">
      <a class="brandLink" href="https://royalglass.co.nz" target="_blank" rel="noopener noreferrer" aria-label="Royal Glass website">
        <img src="${ROYAL_GLASS_LOGO_DATA_URL}" alt="Royal Glass">
      </a>
      <div class="toolbarCenter">
        <div class="group">
          <button id="zoomOut" title="Zoom out" aria-label="Zoom out">&minus;</button>
          <span id="zoomLabel">150%</span>
          <button id="zoomIn" title="Zoom in" aria-label="Zoom in">+</button>
        </div>
        <div class="group"><span id="pageLabel">Page 1 / 1</span></div>
      </div>
      <div class="group" id="featureButtons"></div>
    </div>
    <div id="loading">Loading...</div>
    <div id="viewer"></div>
    <div id="actionBar"></div>
    <footer>
      <a href="#" id="cookiesLink">Cookies &amp; Tracking</a>
      <span aria-hidden="true">&nbsp;&middot;&nbsp;</span>
      <a href="#" id="privacyLink">Privacy Policy</a>
    </footer>
  </div>
  <div id="privacyModal" hidden>
    <div id="privacyModalBox">
      <button id="privacyModalClose" aria-label="Close">&times;</button>
      <iframe id="privacyFrame" src="" title="Privacy &amp; Cookies Notice"></iframe>
    </div>
  </div>
  <script type="module">
    import * as pdfjsLib from '${PDFJS_LIB_URL}';

    pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS_WORKER_URL}';

    var PDF_URL = '/q/${safeCode}/pdf';
    var TOKEN = '${safeToken}';
    var TRACKER_URL = '${safeTrackerUrl}';
    var TRACKING_CONFIG = ${safeConfig};
    var EMAIL_GATE_ENABLED = ${emailGateEnabled ? 'true' : 'false'};
    var viewerWrapEl = document.getElementById('viewerWrap');
    var loadingEl = document.getElementById('loading');
    var viewerEl = document.getElementById('viewer');
    var zoomLabel = document.getElementById('zoomLabel');
    var pageLabel = document.getElementById('pageLabel');
    var featureButtonsEl = document.getElementById('featureButtons');
    var actionBarEl = document.getElementById('actionBar');
    var pdf = null;
    var scale = 1.5;
    var total = 1;
    var observer = null;
    var renderRun = 0;
    var maxScrollDepth = 0;
    var viewedPages = {};
    var openedAt = Date.now();
    var activeStartedAt = document.visibilityState === 'visible' ? Date.now() : null;
    var activeDurationMs = 0;
    var closed = false;
    var initialized = false;

    // Persist the viewer id in localStorage (not sessionStorage) so a returning
    // reader on the same browser keeps one id and is counted as a single unique
    // viewer across visits. Return-visit detection is independent of this (it
    // uses distinct open-days), so persistence doesn't distort that signal.
    if (!localStorage.getItem('rg_sid')) {
      localStorage.setItem('rg_sid', crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    }
    var SESSION_ID = localStorage.getItem('rg_sid');

    var trackedPage = null;     // page currently being timed
    var pageStartedAt = null;   // when the current active page segment began

    function isEnabled(key) {
      return TRACKING_CONFIG[key] !== false;
    }

    function beacon(payload, immediate) {
      payload.token = TOKEN;
      payload.session = SESSION_ID;
      var body = JSON.stringify(payload);

      if (!immediate && navigator.sendBeacon) {
        // Must target the cross-origin tracker worker (not the viewer's own
        // origin) and use a CORS-safelisted content type so the unload beacon
        // is sent without a preflight. The tracker reads request.json()
        // regardless of the declared content type.
        navigator.sendBeacon(TRACKER_URL, new Blob([body], { type: 'text/plain' }));
        return;
      }

      fetch(TRACKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: !immediate,
      }).catch(function () {});
    }

    function updateActiveTime() {
      var activeNow = document.visibilityState === 'visible' && document.hasFocus();
      if (activeNow && activeStartedAt === null) {
        activeStartedAt = Date.now();
      } else if (!activeNow && activeStartedAt !== null) {
        activeDurationMs += Date.now() - activeStartedAt;
        activeStartedAt = null;
        sendPageTiming(flushPageTimer());
        return;
      }
      if (activeNow && trackedPage !== null && pageStartedAt === null) pageStartedAt = Date.now();
    }

    function flushPageTimer(restartCurrent) {
      var segment = null;
      if (trackedPage !== null && pageStartedAt !== null) {
        var duration = Date.now() - pageStartedAt;
        if (duration > 0) segment = { pageNumber: trackedPage, duration: duration };
      }
      pageStartedAt = null;
      var activeNow = document.visibilityState === 'visible' && document.hasFocus();
      if (restartCurrent && activeNow && trackedPage !== null) pageStartedAt = Date.now();
      return segment;
    }

    function sendPageTiming(segment, immediate) {
      if (!segment || !isEnabled('track.page_completion')) return;
      beacon({ event: 'page_view', pageNumber: segment.pageNumber, duration: segment.duration }, immediate !== false);
    }

    function syncPageTimer(nextPage) {
      // Bank the in-progress active segment for the page we were on, then (re)start
      // timing the current page only while the tab is actually active.
      sendPageTiming(flushPageTimer());
      if (nextPage !== undefined && nextPage !== null) trackedPage = nextPage;
      var activeNow = document.visibilityState === 'visible' && document.hasFocus();
      if (activeNow && trackedPage !== null) pageStartedAt = Date.now();
    }

    function currentActiveDuration() {
      // Flush the in-progress active segment. updateActiveTime() only banks time
      // on a visible->hidden transition, so when sampled while still active (the
      // common case: read, then close) the open segment must be added here, with
      // activeStartedAt rebased so repeated samples don't double-count.
      if (activeStartedAt !== null) {
        var now = Date.now();
        activeDurationMs += now - activeStartedAt;
        activeStartedAt = now;
      }
      return activeDurationMs;
    }

    function makeButton(label, onClick) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', onClick);
      return button;
    }

    function setupFeatureButtons() {
      if (isEnabled('viewer.download')) {
        featureButtonsEl.appendChild(makeButton('Download', function () {
          if (isEnabled('track.download_print')) beacon({ event: 'download' }, true);
          window.open(PDF_URL, '_blank', 'noopener');
        }));
      }

      if (isEnabled('viewer.print')) {
        featureButtonsEl.appendChild(makeButton('Print', function () {
          if (isEnabled('track.download_print')) beacon({ event: 'download' }, true);
          window.print();
        }));
      }

      if (isEnabled('viewer.accept')) {
        actionBarEl.appendChild(makeButton('Accept', function () {
          if (isEnabled('track.cta_clicks')) beacon({ event: 'cta', ctaType: 'accept' }, true);
          alert('Coming soon');
        }));
      }

      if (isEnabled('viewer.contact_us')) {
        actionBarEl.appendChild(makeButton('Contact Us', function () {
          if (isEnabled('track.cta_clicks')) beacon({ event: 'cta', ctaType: 'contact' }, true);
          alert('Coming soon');
        }));
      }

      if (actionBarEl.children.length > 0) actionBarEl.style.display = 'flex';
    }

    function updateZoomLabel() {
      zoomLabel.textContent = Math.round(scale * 100) + '%';
    }

    function updatePageLabel(page) {
      pageLabel.textContent = 'Page ' + page + ' / ' + total;
    }

    function observePages() {
      if (observer) observer.disconnect();
      observer = new IntersectionObserver(function (entries) {
        var bestPage = null;
        var bestRatio = 0;

        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.intersectionRatio >= bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestPage = Number(entry.target.getAttribute('data-page'));
          }
        });

        if (bestPage !== null) {
          updatePageLabel(bestPage);
          if (bestPage !== trackedPage) syncPageTimer(bestPage);
          if (isEnabled('track.page_completion') && !viewedPages[bestPage]) {
            viewedPages[bestPage] = true;
            beacon({ event: 'page_view', pageNumber: bestPage }, true);
          }
        }
      }, { threshold: [0.5, 0.75, 1] });

      Array.prototype.forEach.call(viewerEl.children, function (canvas) {
        observer.observe(canvas);
      });
    }

    async function renderAllPages() {
      var thisRun = ++renderRun;
      viewerEl.innerHTML = '';
      loadingEl.style.display = 'block';
      updateZoomLabel();

      for (var pageNumber = 1; pageNumber <= total; pageNumber++) {
        if (thisRun !== renderRun) return;

        var page = await pdf.getPage(pageNumber);
        var viewport = page.getViewport({ scale: scale });
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.setAttribute('data-page', String(pageNumber));
        viewerEl.appendChild(canvas);

        await page.render({ canvasContext: context, viewport: viewport }).promise;
      }

      loadingEl.style.display = 'none';
      observePages();
    }

    async function initViewer() {
      if (initialized) return;
      initialized = true;

      try {
      pdf = await pdfjsLib.getDocument({ url: PDF_URL }).promise;
      total = pdf.numPages;
      updatePageLabel(1);
      beacon({ event: 'open' }, true);
      setupFeatureButtons();
      await renderAllPages();
      } catch (err) {
        loadingEl.textContent = 'Could not load the quote.';
        console.error(err);
      }
    }

    function showGateError(message) {
      var errorEl = document.getElementById('gateError');
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }

    document.getElementById('zoomOut').addEventListener('click', function () {
      scale = Math.max(0.5, scale - 0.25);
      renderAllPages();
    });

    document.getElementById('zoomIn').addEventListener('click', function () {
      scale = Math.min(3, scale + 0.25);
      renderAllPages();
    });

    window.addEventListener('scroll', function () {
      var doc = document.documentElement;
      var scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
      var depth = Math.min(100, Math.max(0, Math.round((window.scrollY / scrollable) * 100)));

      if (depth >= maxScrollDepth + 10 || depth === 100) {
        maxScrollDepth = depth;
        beacon({ event: 'scroll', depth: maxScrollDepth }, true);
      }
    }, { passive: true });

    document.addEventListener('visibilitychange', updateActiveTime);
    window.addEventListener('focus', updateActiveTime);
    window.addEventListener('blur', updateActiveTime);
    setInterval(function () {
      if (!initialized || closed) return;
      sendPageTiming(flushPageTimer(true));
    }, 10000);
    window.addEventListener('pagehide', function () {
      if (!initialized) return;
      if (closed) return;
      closed = true;
      // Bank the final active segment for the current page, then report per-page time.
      sendPageTiming(flushPageTimer(), false);
      beacon({
        event: 'close',
        duration: Date.now() - openedAt,
        activeDurationMs: currentActiveDuration(),
      }, false);
    });

    document.getElementById('cookiesLink').addEventListener('click', function (event) {
      event.preventDefault();
      document.getElementById('privacyFrame').src = '/privacy#cookies';
      document.getElementById('privacyModal').removeAttribute('hidden');
    });

    document.getElementById('privacyLink').addEventListener('click', function (event) {
      event.preventDefault();
      document.getElementById('privacyFrame').src = '/privacy';
      document.getElementById('privacyModal').removeAttribute('hidden');
    });

    document.getElementById('privacyModalClose').addEventListener('click', function () {
      document.getElementById('privacyModal').setAttribute('hidden', '');
      document.getElementById('privacyFrame').src = '';
    });

    if (EMAIL_GATE_ENABLED) {
      document.getElementById('gateSubmit').addEventListener('click', async function () {
        var button = document.getElementById('gateSubmit');
        var email = document.getElementById('gateEmail').value.trim();
        var name = document.getElementById('gateName').value.trim();

        if (!email || !email.includes('@')) {
          showGateError('Please enter a valid email.');
          return;
        }

        button.disabled = true;
        try {
          var res = await fetch('/q/${safeCode}/gate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, name: name || undefined, sessionId: SESSION_ID, token: TOKEN }),
          });

          if (!res.ok) {
            showGateError(res.status === 403
              ? 'Please use the email address this quote was shared with.'
              : 'Something went wrong. Try again.');
            return;
          }

          document.getElementById('gate').style.display = 'none';
          viewerWrapEl.style.display = 'block';
          await initViewer();
        } catch (err) {
          showGateError('Something went wrong. Try again.');
          console.error(err);
        } finally {
          button.disabled = false;
        }
      });
    } else {
      initViewer();
    }
  </script>
</body>
</html>`
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'POST') {
      return new Response(null, { status: 405 })
    }

    const url = new URL(request.url)
    if (url.pathname === '/privacy') {
      return htmlResponse(renderPrivacyNotice())
    }

    const pdfMatch = url.pathname.match(/^\/q\/([A-Za-z0-9]{4,16})\/pdf$/)
    const gateMatch = url.pathname.match(/^\/q\/([A-Za-z0-9]{4,16})\/gate$/)
    const viewerMatch = url.pathname.match(/^\/q\/([A-Za-z0-9]{4,16})$/)

    try {
      if (gateMatch) {
        if (request.method !== 'POST') return new Response(null, { status: 405 })
        return await handleGate(gateMatch[1], request, env)
      }
      if (pdfMatch) {
        if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 })
        return await handlePdf(pdfMatch[1], env, request.method)
      }
      if (viewerMatch) {
        if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 })
        return await handleViewer(viewerMatch[1], env, request.method)
      }
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        source: 'viewer.fetch',
        message: error instanceof Error ? error.message : String(error),
        path: url.pathname,
        createdAt: new Date().toISOString(),
      }))

      return new Response(null, { status: 500 })
    }

    return new Response(null, { status: 404 })
  },
}

export default worker
