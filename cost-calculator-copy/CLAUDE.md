# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What this repo is

A **React/Vite SPA** delivered as a **WordPress plugin shortcode** (`[rg_calculator]`). Customers visit `royalglass.co.nz/estimate`, fill in a 9-step wizard describing their frameless glass balustrade or pool fence project, receive a client-side price estimate, and submit their lead. The WordPress plugin saves the lead to a custom DB table (`wp_rg_leads`), sends three emails asynchronously (admin notification, ServiceM8 inbox, customer estimate), and returns a success response.

There is no Node.js server, no Cloudflare Workers, and no Supabase in the production path.

---

## Commands

```bash
npm run dev          # Vite dev server (hot reload, runs in browser at localhost:5173)
npm run build        # Production build → dist/rg-calculator.js + dist/rg-calculator.css
npm run build:dev    # Build with development mode (source maps, no minification)
npm run lint         # ESLint
npm run format       # Prettier
```

Full deploy sequence (build → copy assets → zip for WP upload):

```bash
npm run build
cp dist/rg-calculator.js  wordpress-plugin/rg-calculator/assets/
cp dist/rg-calculator.css wordpress-plugin/rg-calculator/assets/
```

```powershell
Compress-Archive -Path wordpress-plugin\rg-calculator -DestinationPath wordpress-plugin\rg-calculator.zip -Force
```

> Do NOT run `cp dist/*.jpg` — images are not bundled by Vite. They live permanently in
> `wordpress-plugin/rg-calculator/assets/` and must not be overwritten on each deploy.

There are no automated tests.

---

## Architecture

### React app (`src/`)

Entry: `src/main.tsx` mounts directly on `#rg-calculator-root`. No router is used at runtime — `main.tsx` imports `App` directly and calls `ReactDOM.createRoot`. Hash/TanStack routing artefacts from the original template have been removed.

The `@` path alias resolves to `src/` (configured in `vite.config.ts`).

**Wizard flow (App.tsx):**

```
CalculatorForm (up to 9 steps depending on project type)
  -> LeadCapture (contact details, address, notes, consent)
    -> ResultScreen (estimate + send-to-email)
```

State lives entirely in `App.tsx` local React state. No global state library is used.

**Steps (all in `CalculatorForm.tsx`):**
| # | Title | Conditional? |
|---|---|---|
| 1 | What's your project? (scenario) | Always |
| 2 | Total length of glass run | Always |
| 3 | How many corners? | Hidden for `stair_balustrade` |
| 4 | How many gates? | Only for `premium_pool_fence` |
| 5 | Glass type | Hidden for `ground_level` and `premium_pool_fence` |
| 6 | Glass colour | Always |
| 7 | How will the glass be fixed? (fixing method) | Always |
| 8 | What is the substrate? | Always — **mandatory before Continue** |
| 9 | Hardware finish | Always |

### Pricing engine (`src/lib/calculator/`)

| File | Role |
|---|---|
| `config.ts` | **Only place prices live.** Edit `DEFAULT_PRICING` here to change pricing. Also exports `IMAGES` map and `getPluginBase()`. |
| `engine.ts` | Pure function `calculateEstimate(answers, pricing) -> EstimateResult`. No side effects. |
| `types.ts` | TypeScript interfaces for `WizardAnswers`, `LeadData`, `EstimateResult`, `PricingConfig`. |

**Estimate always shows a price.** The engine computes a low/high range for every input combination. `consultationFlags` is a list of strings flagging unknowns or special cases (shown as an amber bar below the price on screen and in the customer email). These never block the price — they are informational only.

**Current consultation triggers** (flags only — do not hide price):
- Fixing method `not_sure` — to be confirmed on site
- Fixing method `sed` — Special Engineer Design required (always flagged regardless of surcharge)
- Hardware finish `not_sure` — to be confirmed
- Substrate `not_sure` — to be confirmed on site

**Hardware surcharge** applies only to `matte_black`, `brushed_chrome`, `powder_coated` finishes.

**Fixing method surcharge** applies per effective metre for each of the 9 methods. All default to 0 but are editable from WP admin. Negative values are valid (cheaper methods).

**Fixing methods:** `spigot_round`, `standoff_posts`, `viking`, `jh_clamps`, `side_channel`, `top_channel`, `aluminium_1`, `aluminium_2`, `sed`.

**To change prices:** Edit only `config.ts`. Run `npm run build` and redeploy. Or use WP Admin → RG Calculator → Pricing (live, no rebuild).

### Hooks (`src/hooks/`)

| File | Role |
|---|---|
| `usePricing.ts` | Fetches live pricing from `GET /wp-json/royal-glass/v1/pricing` on mount. Falls back to `DEFAULT_PRICING` if the fetch fails or on local dev. Also exports `getConfig()` which returns `window.rgCalculatorConfig`. |

### UI components (`src/components/wizard/`)

All components use **inline `style` props only** — no Tailwind classNames, no shadcn. Tailwind has been fully removed from the project. This is intentional: WordPress themes output unlayered CSS which always overrides Tailwind's `@layer`-wrapped utilities. Inline styles are immune to the cascade.

| File | Role |
|---|---|
| `steps/shared.tsx` | `SelectionCard`, `SliderInput`, `StepNote`, `ComplianceWarning`, `StepHero` — shared primitives used by `CalculatorForm` |
| `LeadCapture.tsx` | Contact form (name, email, phone, customer type, timeframe, address, notes, consent). Cloudflare Turnstile invisible CAPTCHA. |
| `NZAddressAutocomplete.tsx` | Address autocomplete using Nominatim (OpenStreetMap). No API key required. Uses inline styles. |
| `ResultScreen.tsx` | Estimate display, breakdown, project summary, assumptions, next steps, "Share this estimate" forwarding card |

`CalculatorForm.tsx` (in `src/components/`) owns the full step flow — all step content, canContinue logic, and navigation. It is not inside `wizard/`.

### Styles (`src/index.css`)

Minimal CSS. Contains a scoped reset under `#rg-calculator-root` to neutralise WordPress theme defaults (margin, padding, list-style, box-sizing). All component styling is inline.

### Image assets

Images live at `wordpress-plugin/rg-calculator/assets/*.jpg` and are served from the WordPress plugin URL. The asset base URL is injected by WordPress as `window.rgCalculatorConfig.assetsUrl` via `wp_localize_script`. `config.ts` reads this first; the DOM script-tag query is a fallback only.

Never rely on `base` in `vite.config.ts` for image URLs — images are not imported as modules, so Vite does not process them.

### WordPress plugin (`wordpress-plugin/rg-calculator/`)

| File | Role |
|---|---|
| `rg-calculator.php` | Plugin bootstrap. Registers shortcode, enqueues assets, calls `wp_localize_script` to inject `window.rgCalculatorConfig` (`restUrl`, `nonce`, `googleMapsKey`, `turnstileSiteKey`, `assetsUrl`). |
| `includes/database.php` | Creates `wp_rg_leads` table on activation. CRUD helpers. |
| `includes/validation.php` | `rg_validate_lead`, `rg_validate_answers`, `rg_sanitize_*`. |
| `includes/api.php` | REST routes. Lead submit handler: time gate → rate limit → honeypot → Turnstile → validate → save → async emails (admin + SM8 + customer) → respond. Estimate email handler: nonce → rate limit → validate → async email → respond. **Known gap:** `/estimate-email` is missing Turnstile verification and honeypot check — see Security section. |
| `includes/email.php` | `rg_send_lead_email()` — plain-text admin notification. `rg_send_estimate_email_to_customer()` — rich HTML email to customer (price always shown, amber bar if concerns exist). |
| `includes/servicem8.php` | ServiceM8 inbox integration. `rg_sm8_send_immediate()` fires in the shutdown hook and sends a plain-text email to `RG_SM8_INBOX_EMAIL` for "Convert to Job" parsing. Quality scoring and cron retry logic retained but currently unused. |
| `includes/admin-pricing.php` | WordPress admin page for editing pricing values (base rates, surcharges for glass, colour, fixing method, hardware finish, interlinking rails). |
| `includes/admin-leads.php` | WordPress admin page listing submitted leads. |

**All emails are asynchronous.** Admin notification, ServiceM8 inbox email, and customer estimate email are all dispatched together via `add_action('shutdown', ...)` with `fastcgi_finish_request()`. The API responds to the browser immediately; emails send in the background. This eliminates the 2-5 second `wp_mail()` delay the user would otherwise see.

**Customer estimate email is auto-sent on submit.** A copy is emailed to the customer's address (from the lead form) every time a lead is submitted. The customer can also forward the estimate to a different address via the "Share this estimate" panel on the result screen, which calls `/estimate-email`.

**Turnstile enforcement** activates only when BOTH `RG_TURNSTILE_SITE_KEY` (frontend) AND `RG_TURNSTILE_SECRET` (backend) are defined in `wp-config.php`. A partial setup is treated as disabled.

**Rate limits:**
- Lead submissions: 10 per IP per hour (admin users bypass)
- Estimate emails: 5 per IP per hour (admin users bypass)

**IP detection** (`rg_get_client_ip()`) uses `REMOTE_ADDR` only. The site is hosted on Bluehost (no Cloudflare proxy), so `REMOTE_ADDR` is the actual client IP. `HTTP_CF_CONNECTING_IP` is intentionally not read — it would be fully attacker-controlled without a Cloudflare proxy in front.

**Lead status flow:** `NEW` -> `REVIEWED` -> `ACCEPTED` or `REJECTED`.

---

## `wp-config.php` constants

```php
define('RG_GOOGLE_MAPS_KEY',   'AIza...');       // Retained in wp_localize_script output but unused — address autocomplete now uses Nominatim (no key required)
define('RG_TURNSTILE_SITE_KEY','0x...');         // Cloudflare Turnstile site key (frontend widget)
define('RG_TURNSTILE_SECRET',  '0x...');         // Cloudflare Turnstile secret (backend verification)
define('RG_LEAD_NOTIFY_EMAIL', 'roxy@royalglass.co.nz'); // Who receives admin lead notifications
define('RG_SM8_INBOX_EMAIL',   'de9f86@inbox.servicem8.com'); // ServiceM8 inbox email (comma-separated list OK; leave undefined to disable)
```

> Both Turnstile constants must be defined for enforcement to activate. Defining only one is treated as disabled.

---

## Security

### Known issues (to fix, in priority order)

| # | Severity | File | Issue |
|---|---|---|---|
| 1 | ~~HIGH~~ FIXED | `includes/api.php` | `HTTP_CF_CONNECTING_IP` removed — site is on Bluehost (no Cloudflare proxy), so the header was attacker-controlled. `REMOTE_ADDR` is now the sole IP source. |
| 2 | ~~HIGH~~ PARTIAL | `includes/api.php` | `/estimate-email` now requires WordPress nonce (`wp_verify_nonce`). Still missing Turnstile, honeypot, and time gate — rate limit + nonce only. Low practical risk on Bluehost. |
| 3 | ~~MED~~ FIXED | `includes/database.php` | `consent_given` and `consented_at` columns added. Stored in `rg_save_lead()` via `rg_sanitize_lead()`. Shown in admin lead detail view. Requires plugin reactivation on live site to apply DB migration. |
| 4 | ~~MED~~ PARTIAL | `includes/validation.php` | Client-supplied `estimate` values are now bounds-clamped (`0–999,999 NZD`, `low ≤ high`) in `rg_sanitize_estimate()`. Still not recalculated server-side — inflated-but-valid values can be stored. |
| 5 | ~~MED~~ FIXED | `includes/api.php` | `rg_validate_answers()` now called in `/estimate-email` handler before sending. |
| 6 | LOW | `includes/api.php` | Rate limit check/set is non-atomic — concurrent requests can exceed the limit by 1. |
| 7 | ~~LOW~~ FIXED | `includes/email.php` | Email subject uses `sanitize_text_field()`. HTML body uses `esc_html($name)` via `$name_html`. `$from_email` wrapped in `sanitize_email()`. |
| 9 | INFO | `src/components/wizard/LeadCapture.tsx` | `marketingConsent` captured in state but never sent to the server or stored. |
| 10 | ~~INFO~~ FIXED | `src/components/wizard/NZAddressAutocomplete.tsx` | Converted to inline styles. Tailwind removed entirely from the project (vite.config.ts, package.json, index.css). CSS bundle: 14.3 kB → 1.4 kB. |

### Security model

- Turnstile CAPTCHA (Cloudflare): active only when both `RG_TURNSTILE_SITE_KEY` and `RG_TURNSTILE_SECRET` are defined. A partial setup is treated as disabled.
- Honeypot field (`websiteUrl`): hidden from users, checked server-side on `/leads` only.
- Time gate: rejects submissions under 3 seconds on `/leads` only.
- Rate limits are stored as WordPress transients (MySQL-backed) — not atomic, minor over-run is possible.
- All data written to the DB goes through `rg_sanitize_lead()`, `rg_sanitize_answers()`, and `rg_sanitize_estimate()` before `$wpdb->insert()` with format specifiers — no raw query interpolation.
- Admin pages are gated by `current_user_can('manage_options')` and nonce-verified (`wp_verify_nonce`).

---

## Non-negotiable constraints

**Never reintroduce:**
- `@tanstack/react-start`, `@cloudflare/vite-plugin`, or any Cloudflare Worker config
- Supabase in the lead submission path
- n8n or any external webhook called during public form submission
- Automatic ServiceM8 **job** creation from a public form submission (inbox email is fine; direct API call to SM8 is not)
- Tailwind `className` props anywhere — Tailwind is fully removed from the project. Use inline `style` props.

**Never expose to the browser bundle:**
- ServiceM8 API keys, n8n webhook URLs, Supabase service-role keys, or any private credential

**Server-side validation in `api.php` must never be skipped** because frontend validation exists — both run independently.

**`rg_validate_answers()` must be called on every endpoint that accepts an `answers` payload**, including `/estimate-email`. Do not add new endpoints that skip it.

**Turnstile must be verified on every public POST endpoint** when credentials are configured. Do not add new endpoints that skip it.

**Database save must complete before email is scheduled.** If the DB insert fails, return a 500 and do not schedule the email.

**Images are not bundled by Vite.** Do not import `.jpg` files as ES modules in wizard components. Reference them via the `IMAGES` map in `config.ts`, which resolves from `window.rgCalculatorConfig.assetsUrl`.
