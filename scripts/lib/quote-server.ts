// Shared local quote viewer used by the `quote:preview` and `quote:share`
// scripts. Pulls a quote from ServiceM8 and serves a clean PDF.js viewer
// (top toolbar: zoom + page indicator; bottom footer: cookies/privacy links).
// The PDF is streamed through the route, mirroring the real design.

import { createServer, type Server } from 'node:http'
import type { QuoteJobMeta } from '../../lib/servicem8/client'
import { createTracker } from './quote-tracking'

export type StartOptions = {
  jobNumber?: string
  uuid?: string
  latest?: boolean
  port: number
  /** Poll ServiceM8 until the quote PDF is generated, instead of failing fast. */
  watch?: boolean
  /** Watch timeout in seconds (default 300). */
  watchTimeoutSec?: number
  /** Minimum quote value (incl GST) to mint a tracking link. Default 5000. */
  minValue?: number
  /** Skip the threshold check. */
  force?: boolean
}

export type StartedServer = {
  code: string
  meta: QuoteJobMeta
  port: number
  server: Server
  /** Print the per-session view-tracking summary (call on shutdown). */
  printSummary: () => void
}

export async function startQuoteServer(opts: StartOptions): Promise<StartedServer> {
  const {
    createServiceM8RequestFromEnv,
    resolveJobUuid,
    getJobQuoteMeta,
    getQuoteAttachmentPdf,
    findQuoteAttachmentRecord,
    waitForQuoteAttachmentPdf,
  } = await import('../../lib/servicem8/client')
  const { generateShortCode } = await import('../../lib/short-code')

  const request = createServiceM8RequestFromEnv()

  console.log('Resolving job...')
  const jobUuid = await resolveJobUuid(
    { uuid: opts.uuid, jobNumber: opts.jobNumber, latestQuote: opts.latest },
    request,
  )
  if (!jobUuid) throw new Error('No matching job found.')

  let meta = await getJobQuoteMeta(jobUuid, request)
  console.log(`Job #${meta.jobNumber} — ${meta.clientName} — $${meta.quoteValue} (${meta.status})`)

  // Business rule: only track quotes above the threshold (default $5,000).
  const minValue = opts.minValue ?? 5000
  const checkThreshold = (m: QuoteJobMeta) => {
    const value = Number(m.quoteValue ?? '0')
    if (value < minValue && !opts.force) {
      throw new Error(
        `Quote value $${value.toLocaleString()} is below the $${minValue.toLocaleString()} ` +
          `tracking threshold — no tracking link needed. Use --force to override.`,
      )
    }
  }

  let pdf
  if (opts.watch) {
    // Snapshot any existing quote PDF first, so only a *newly generated* one fires.
    const baseline = await findQuoteAttachmentRecord(jobUuid, request)
    if (baseline) {
      console.log('Note: this job already has a quote PDF — waiting for a NEW one (re-generate it).')
    }
    console.log('Watching for a newly generated quote — generate/finalise the quote in ServiceM8 now...')
    pdf = await waitForQuoteAttachmentPdf(jobUuid, request, {
      baseline,
      timeoutMs: (opts.watchTimeoutSec ?? 300) * 1000,
      onWait: (sec) => console.log(`  ...still waiting (${sec}s) — no new quote PDF yet`),
    })
    if (!pdf) throw new Error('Timed out waiting for the quote PDF. Did the quote get generated?')
    // Re-read the value now that the quote is generated, then apply the threshold.
    meta = await getJobQuoteMeta(jobUuid, request)
    console.log(`New quote PDF detected! Final value: $${meta.quoteValue}`)
    checkThreshold(meta)
  } else {
    checkThreshold(meta)
    console.log('Pulling quote PDF...')
    pdf = await getQuoteAttachmentPdf(jobUuid, request)
    if (!pdf) {
      throw new Error(
        'No QUOTE PDF attachment found yet. Finalise/send the quote in ServiceM8, then re-run ' +
          '(or use --watch to wait for it).',
      )
    }
  }
  const pdfBuffer = Buffer.from(pdf.bytes)
  console.log(`Pulled ${(pdfBuffer.byteLength / 1024).toFixed(1)} KB`)

  const code = generateShortCode()
  const tracker = createTracker(code)

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${opts.port}`)

    if (req.method === 'POST' && url.pathname === `/q/${code}/track`) {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
        if (body.length > 4096) req.destroy() // tiny beacons only
      })
      req.on('end', () => {
        tracker.handleBeacon(req, body)
        res.writeHead(204).end()
      })
      return
    }

    if (url.pathname === `/q/${code}/pdf`) {
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdfBuffer.byteLength),
        'Cache-Control': 'no-store',
      })
      res.end(pdfBuffer)
      return
    }

    if (url.pathname === `/q/${code}`) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(viewerHtml(code, meta.clientName ?? 'Quote'))
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  })

  await new Promise<void>((resolve) => server.listen(opts.port, resolve))

  return { code, meta, port: opts.port, server, printSummary: tracker.printSummary }
}

function viewerHtml(code: string, title: string): string {
  // Inner browser JS uses string concatenation (not template literals) so it
  // passes through this outer TS template literal untouched. Only ${code} /
  // ${escapeHtml(title)} are interpolated here at serve time.
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
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
      width: 30px; height: 30px; border: none; border-radius: 6px; background: #4a4d50; color: #fff;
      font-size: 18px; line-height: 1; cursor: pointer;
    }
    #toolbar button:hover { background: #5d6164; }
    #zoomLabel { min-width: 44px; text-align: center; }
    #pageLabel { min-width: 78px; text-align: center; }
    #pages { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 20px 12px; }
    canvas { box-shadow: 0 2px 12px rgba(0,0,0,.4); max-width: 100%; height: auto; background: #fff; }
    #status { color: #ddd; text-align: center; padding: 40px 16px; font-size: 14px; }
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
      <span id="zoomLabel">100%</span>
      <button id="zoomIn" title="Zoom in" aria-label="Zoom in">+</button>
    </div>
    <div class="group"><span id="pageLabel">Page 1 / 1</span></div>
  </div>
  <div id="status">Loading quote…</div>
  <div id="pages"></div>
  <footer>
    <a href="#" id="cookiesLink">Cookies &amp; Preferences</a>
    <span aria-hidden="true">&nbsp;&middot;&nbsp;</span>
    <a href="#" id="privacyLink">Privacy Policy</a>
  </footer>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    (async () => {
      var statusEl = document.getElementById('status');
      var pagesEl = document.getElementById('pages');
      var zoomLabel = document.getElementById('zoomLabel');
      var pageLabel = document.getElementById('pageLabel');
      var dpr = window.devicePixelRatio || 1;
      var pdf, fitScale, scale, total = 1, current = 1, rendering = false;

      // ---- View tracking (IP/device captured server-side; time-per-page here) ----
      // One session per page-load; sessionStorage (not cookies) so reloads differ.
      var sessionId = sessionStorage.getItem('rg_sid');
      if (!sessionId) {
        sessionId = (window.crypto && crypto.randomUUID)
          ? crypto.randomUUID()
          : String(Date.now()) + '-' + Math.random().toString(16).slice(2);
        sessionStorage.setItem('rg_sid', sessionId);
      }
      var activePage = 1;
      var activeSince = null; // ms timestamp while actively counting, else null

      function beacon(payload) {
        try { navigator.sendBeacon('/q/${code}/track', JSON.stringify(payload)); } catch (e) {}
      }
      // Accrue time only while the tab is visible AND a page is active.
      function startCounting() {
        if (activeSince === null && document.visibilityState === 'visible') {
          activeSince = Date.now();
        }
      }
      function flush() {
        if (activeSince !== null) {
          var ms = Date.now() - activeSince;
          activeSince = null;
          if (ms > 0) beacon({ sessionId: sessionId, page: activePage, ms: ms });
        }
      }
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') flush(); else startCounting();
      });
      window.addEventListener('pagehide', flush);
      // Capture IP/device immediately, even if they close the tab right away.
      beacon({ sessionId: sessionId, page: 1, ms: 0, open: true });
      startCounting();

      function computeFitScale() {
        return Math.min(2, (Math.min(window.innerWidth, 900) - 24) / 612);
      }

      async function renderAll() {
        if (rendering) return;
        rendering = true;
        pagesEl.innerHTML = '';
        for (var n = 1; n <= total; n++) {
          var page = await pdf.getPage(n);
          var viewport = page.getViewport({ scale: scale * dpr });
          var canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = (viewport.width / dpr) + 'px';
          canvas.setAttribute('data-page', String(n));
          pagesEl.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }
        observePages();
        rendering = false;
      }

      function setZoom(next) {
        scale = Math.max(0.4, Math.min(3, next));
        zoomLabel.textContent = Math.round(scale * 100) + '%';
        renderAll();
      }

      // Track which page is in view; flush the previous page's time on change.
      var observer;
      function observePages() {
        if (observer) observer.disconnect();
        observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) {
              current = Number(e.target.getAttribute('data-page'));
              pageLabel.textContent = 'Page ' + current + ' / ' + total;
              if (current !== activePage) {
                flush();            // bank time spent on the page we're leaving
                activePage = current;
                startCounting();    // start the clock on the new page
              }
            }
          });
        }, { threshold: 0.5 });
        Array.prototype.forEach.call(pagesEl.children, function (c) { observer.observe(c); });
      }

      try {
        var data = await fetch('/q/${code}/pdf').then(function (r) { return r.arrayBuffer(); });
        pdf = await pdfjsLib.getDocument({ data: data }).promise;
        total = pdf.numPages;
        statusEl.remove();
        fitScale = computeFitScale();
        scale = fitScale;
        zoomLabel.textContent = Math.round(scale * 100) + '%';
        pageLabel.textContent = 'Page 1 / ' + total;
        await renderAll();
      } catch (e) {
        statusEl.textContent = 'Could not load the quote.';
        console.error(e);
      }

      document.getElementById('zoomIn').addEventListener('click', function () { setZoom(scale + 0.2); });
      document.getElementById('zoomOut').addEventListener('click', function () { setZoom(scale - 0.2); });
      document.getElementById('privacyLink').addEventListener('click', function (ev) {
        ev.preventDefault();
        alert('Privacy Policy placeholder — final copy comes in Stage 6.');
      });
      document.getElementById('cookiesLink').addEventListener('click', function (ev) {
        ev.preventDefault();
        alert('Cookies & Preferences placeholder — final copy comes in Stage 6.');
      });
    })();
  </script>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  )
}
