import { neon } from '@neondatabase/serverless'

export interface Env {
  DATABASE_URL: string
  QUOTES_BUCKET: R2Bucket
  TRACKER_URL?: string
}

type QuoteRow = {
  token: string
  pdf_storage_key: string | null
  expires_at: string | Date | null
  archived_at: string | Date | null
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

function isExpired(value: string | Date | null): boolean {
  if (value == null) return false
  return new Date(value).getTime() < Date.now()
}

async function loadQuote(code: string, env: Env): Promise<QuoteState> {
  const sql = neon(env.DATABASE_URL)
  const rows = await sql`
    SELECT token, pdf_storage_key, expires_at, archived_at, client_name, job_description
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
  return htmlResponse(viewerHtml(code, title, state.quote.token, config, env.TRACKER_URL ?? '/track'))
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
  config: Record<string, boolean>,
  trackerUrl: string,
): string {
  const safeCode = escapeJsString(code)
  const safeToken = escapeJsString(token)
  const safeTrackerUrl = escapeJsString(trackerUrl)
  const safeTitle = escapeHtml(title)
  const safeConfig = JSON.stringify(config).replace(/</g, '\\u003c')

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
    #toolbar {
      position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: center;
      gap: 14px; padding: 8px 12px; background: rgba(38,40,42,.96); color: #eee; font-size: 13px;
      box-shadow: 0 1px 6px rgba(0,0,0,.4);
    }
    #toolbar .group { display: flex; align-items: center; gap: 6px; }
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
  </style>
</head>
<body>
  <div id="toolbar">
    <div class="group">
      <button id="zoomOut" title="Zoom out" aria-label="Zoom out">&minus;</button>
      <span id="zoomLabel">150%</span>
      <button id="zoomIn" title="Zoom in" aria-label="Zoom in">+</button>
    </div>
    <div class="group"><span id="pageLabel">Page 1 / 1</span></div>
    <div class="group" id="featureButtons"></div>
  </div>
  <div id="loading">Loading...</div>
  <div id="viewer"></div>
  <div id="actionBar"></div>
  <footer>
    <a href="#" id="cookiesLink">Cookies &amp; Preferences</a>
    <span aria-hidden="true">&nbsp;&middot;&nbsp;</span>
    <a href="#" id="privacyLink">Privacy Policy</a>
  </footer>
  <script type="module">
    import * as pdfjsLib from '${PDFJS_LIB_URL}';

    pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS_WORKER_URL}';

    var PDF_URL = '/q/${safeCode}/pdf';
    var TOKEN = '${safeToken}';
    var TRACKER_URL = '${safeTrackerUrl}';
    var TRACKING_CONFIG = ${safeConfig};
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
    var activeStartedAt = document.visibilityState === 'visible' && document.hasFocus() ? Date.now() : null;
    var activeDurationMs = 0;
    var closed = false;

    if (!sessionStorage.getItem('rg_sid')) {
      sessionStorage.setItem('rg_sid', crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    }
    var SESSION_ID = sessionStorage.getItem('rg_sid');

    function isEnabled(key) {
      return TRACKING_CONFIG[key] !== false;
    }

    function beacon(payload, immediate) {
      payload.token = TOKEN;
      payload.session = SESSION_ID;
      var body = JSON.stringify(payload);

      if (!immediate && navigator.sendBeacon) {
        navigator.sendBeacon('/track', new Blob([body], { type: 'application/json' }));
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
      }
    }

    function currentActiveDuration() {
      updateActiveTime();
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
    window.addEventListener('pagehide', function () {
      if (closed) return;
      closed = true;
      beacon({
        event: 'close',
        duration: Date.now() - openedAt,
        activeDurationMs: currentActiveDuration(),
      }, false);
    });

    document.getElementById('cookiesLink').addEventListener('click', function (event) {
      event.preventDefault();
      alert('Coming soon');
    });

    document.getElementById('privacyLink').addEventListener('click', function (event) {
      event.preventDefault();
      alert('Coming soon');
    });
  </script>
</body>
</html>`
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405 })
    }

    const url = new URL(request.url)
    const pdfMatch = url.pathname.match(/^\/q\/([A-Za-z0-9]{4,16})\/pdf$/)
    const viewerMatch = url.pathname.match(/^\/q\/([A-Za-z0-9]{4,16})$/)

    try {
      if (pdfMatch) return await handlePdf(pdfMatch[1], env, request.method)
      if (viewerMatch) return await handleViewer(viewerMatch[1], env, request.method)
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
