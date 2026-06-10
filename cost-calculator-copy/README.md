# RG Cost Calculator — WordPress Plugin

A React/Vite single-page app delivered as a WordPress plugin shortcode. Customers complete a 7-step wizard describing their frameless glass balustrade or pool fence project, submit their contact details, and receive an instant indicative price range.

Current version: **2.3.0**

---

## How it works

1. A WordPress page with `[rg_calculator]` shortcode loads the plugin
2. Plugin enqueues `rg-calculator.js` + `rg-calculator.css` and injects REST config via `window.rgCalculatorConfig`
3. React app mounts on `#rg-calculator-root` and runs the 9-step wizard client-side
4. On the final step, pricing is fetched live from the WP admin (`GET /wp-json/royal-glass/v1/pricing`) and estimate is calculated in the browser
5. Customer fills in contact details (lead capture), including NZ address via Nominatim autocomplete
6. On submit, lead is posted to `POST /wp-json/royal-glass/v1/leads`
7. WordPress saves to `wp_rg_leads`, then sends three emails asynchronously via shutdown hook: admin notification, ServiceM8 inbox email, and customer estimate email
8. Customer sees their price estimate with an optional amber bar listing items to confirm at site visit
9. Customer can forward the estimate to a builder, partner, or architect via the "Share this estimate" panel (calls `POST /wp-json/royal-glass/v1/estimate-email`)

---

## Development

```bash
npm install
npm run dev      # dev server at localhost:5173
npm run build    # produces dist/rg-calculator.js and dist/rg-calculator.css
npm run lint
npm run format
```

---

## Changing prices

Edit `src/lib/calculator/config.ts` — the only file prices live in. All values are NZD, excluding GST. Prices can also be edited live from the WordPress admin (RG Calculator → Pricing) without a rebuild.

After editing `config.ts`, run `npm run build` and redeploy.

---

## Deploying to WordPress

### Build and copy assets

```bash
npm run build
cp dist/rg-calculator.js  wordpress-plugin/rg-calculator/assets/
cp dist/rg-calculator.css wordpress-plugin/rg-calculator/assets/
```

```powershell
Compress-Archive -Path wordpress-plugin\rg-calculator -DestinationPath wordpress-plugin\rg-calculator.zip -Force
```

> Do NOT copy `dist/*.jpg` — images are not built by Vite. They live permanently in the assets folder.

### First-time install

1. Build and package (above)
2. WordPress Admin → Plugins → Add New → Upload Plugin → `rg-calculator.zip` → Install → Activate
3. Create a page: title `Get an Instant Estimate`, slug `estimate`, content `[rg_calculator]`, full-width template, Publish
4. If the REST API returns 404: Settings → Permalinks → Post name → Save

### Subsequent deploys (JS/CSS only)

Upload `dist/rg-calculator.js` and `dist/rg-calculator.css` to `wp-content/plugins/rg-calculator/assets/` via cPanel or SFTP. No plugin reactivation needed. Re-upload the full ZIP for PHP changes.

### `wp-config.php` constants

```php
define('RG_TURNSTILE_SITE_KEY', '0x...');          // Cloudflare Turnstile site key (frontend)
define('RG_TURNSTILE_SECRET',   '0x...');          // Cloudflare Turnstile secret (backend)
define('RG_LEAD_NOTIFY_EMAIL',  'roxy@royalglass.co.nz'); // Who receives admin lead notifications
define('RG_SM8_INBOX_EMAIL',    'inbox@servicem8.com');    // ServiceM8 inbox address (comma-separated list OK)
```

> Both Turnstile constants must be defined for CAPTCHA enforcement to activate. Defining only one is treated as disabled.

> `RG_SM8_INBOX_EMAIL` can be left undefined to disable ServiceM8 email entirely.

> `RG_GOOGLE_MAPS_KEY` is still accepted but currently unused — address autocomplete was switched to Nominatim (OpenStreetMap), which requires no API key.

---

## Plugin structure

```
wordpress-plugin/rg-calculator/
├── rg-calculator.php           # Bootstrap, shortcode, asset enqueue, SEO schema
├── assets/
│   ├── rg-calculator.js        # Built React app (copy from dist/ after build)
│   ├── rg-calculator.css       # Built styles (copy from dist/ after build)
│   └── *.jpg                   # Wizard option images (15 files — do not overwrite)
└── includes/
    ├── database.php            # wp_rg_leads table schema + CRUD helpers
    ├── validation.php          # Input validation and sanitization
    ├── api.php                 # REST route handlers: /leads, /pricing, /estimate-email
    ├── email.php               # Admin notification + customer HTML estimate email
    ├── admin-pricing.php       # WP admin: edit pricing values
    └── admin-leads.php         # WP admin: view and manage submitted leads
```

---

## Lead management

Submitted leads appear under **RG Calculator → Leads** in the WordPress admin.

**Status flow:** `NEW` → `REVIEWED` → `ACCEPTED` or `REJECTED`

Each lead has a detail view showing full contact info, project details, and estimate, with one-click status buttons.

---

## Bot protection

| Layer | Endpoint | Detail |
|---|---|---|
| Time gate | `/leads` only | Rejects submissions under 3 seconds |
| Honeypot | `/leads` only | Hidden `website_url` field — bots fill it, humans don't |
| Cloudflare Turnstile | `/leads` only | Invisible CAPTCHA — active when both keys are configured |
| Rate limit | Both endpoints | 10 lead submissions / 5 estimate emails per IP per hour; admin bypass |

> **Known gap:** `/estimate-email` currently has rate limiting only (no Turnstile, no honeypot, no time gate). Fix planned.

---

## Email behaviour

Three emails fire asynchronously via the `shutdown` hook on every lead submit — no user-facing delay:

| Email | Recipient | Format | When |
|---|---|---|---|
| Admin notification | `RG_LEAD_NOTIFY_EMAIL` | Plain text | Every lead |
| ServiceM8 inbox | `RG_SM8_INBOX_EMAIL` | Plain text (SM8-parseable) | Every lead (if constant defined) |
| Customer estimate | Customer's email | Rich HTML | Every lead (auto-sent) |

- Customer estimate email always contains the real price range and an amber bar for any items needing site confirmation.
- Customer can also forward the estimate to a different address (builder, partner, architect) via the "Share this estimate" panel on the result screen — this calls `/estimate-email` and requires a WordPress nonce.
- `servicem8_status` column records `sent_to_inbox` or `failed` for each lead.

---

## Known security issues

See `CLAUDE.md` → Security section for the full tracked issue list. Remaining open items:

1. `/estimate-email` has nonce verification but still lacks Turnstile CAPTCHA and honeypot check — a session-authenticated user could spam the endpoint within the 5/hour rate limit
2. Client-supplied estimate values (low/high/subtotal) are bounds-clamped (0–999,999 NZD) but not recalculated server-side — a crafted request could store inflated-but-valid figures

---

## What is intentionally not in this version

- n8n automation (reserved for internal use)
- Server-side estimate recalculation (client-supplied values are clamped but not verified against the pricing engine)
