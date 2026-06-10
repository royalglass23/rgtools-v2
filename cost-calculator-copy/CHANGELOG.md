# Changelog — RG Cost Calculator

All notable changes, fixes, and decisions for this project from origin to current.

---

## v2.3.0 — 2026-05-26 (current)

### Expanded fixing method options with per-method pricing

- **9 distinct fixing methods** now supported: Round Spigot (`spigot_round`), Stand-off Posts (`standoff_posts`), Viking System (`viking`), JH Clamps (`jh_clamps`), Side Channel (`side_channel`), Top Channel (`top_channel`), Aluminium 1 (`aluminium_1`), Aluminium 2 (`aluminium_2`), SED (`sed`).
- `fixingMethodSurcharge` map added to `PricingConfig` — each method carries a configurable $/m surcharge editable from WP admin.
- Pricing engine updated: `fixingMethodSurcharge` applied per effective metre in `calculateEstimate()` and included in `EstimateResult.breakdown`.
- Admin pricing page has a new **Fixing Method Surcharges** table for all 9 methods; inputs accept **negative values** to represent methods cheaper than the base rate.
- `SED` always triggers a consultation flag ("Special Engineer Design required — our team will be in touch") regardless of surcharge value.
- Images added for all 9 fixing methods in the `IMAGES` map and plugin assets directory.

### Automatic customer estimate email on lead submit

- Customer estimate email is now **auto-sent asynchronously on lead submit** (inside the shutdown hook alongside admin notification and SM8) — customer no longer needs to click "Get this estimate in your inbox" to receive it.
- **ServiceM8 email moved back to async** — was briefly synchronous (for Bluehost reliability); all three emails (admin, SM8, customer) now fire together in the shutdown hook.
- `ResultScreen.tsx` updated: send-to-email panel now reads **"Share this estimate"** with copy confirming the email is already on its way; the email input is retained so the customer can forward to a builder, partner, or architect at a different address.
- `/estimate-email` endpoint is retained for forwarding requests.

### Security fixes

- **`/estimate-email` nonce verification** — `wp_verify_nonce($request->get_header('X-WP-Nonce'), 'wp_rest')` now required on every request. Unauthenticated requests return `403`. Addresses security issue #2 (partial — Turnstile/honeypot still absent but nonce prevents unauthenticated bulk abuse).
- **Estimate value bounds clamping** — `rg_sanitize_estimate()` now clamps `low`, `high`, and `subtotal` to `0–999,999 NZD`; automatically corrects `low > high`. Addresses security issue #4.

### Bug fixes

- **Duplicate sections in admin email** — `email.php` was emitting a section separator twice; fixed.
- **Negative surcharges blocked in admin UI** — fixing method surcharge inputs previously had `min="0"` preventing negative values. Removed; negative values are now accepted (e.g. a cheaper method can carry a −$100/m discount).

### Image updates

- `finish-brass.jpg` removed (Brass hardware option retired); `finish-powder.jpg` added for Powder Coated finish.
- `fix-alu2.png` renamed/replaced with `fix-alu1.jpg`.
- All wizard images re-compressed.

---

## v2.2.0 — 2026-05-22

### ServiceM8 inbox integration
- Leads are emailed to `RG_SM8_INBOX_EMAIL` immediately after save, via the shutdown hook alongside the admin notification. No cron delay.
- Email format uses labelled plain-text fields (`Name:`, `Mobile:`, `Email:`, `Address:`, `Client:`) so ServiceM8's "Convert to Job" can auto-fill client details.
- `RG_SM8_INBOX_EMAIL` accepts a comma-separated list — set both the SM8 address and a test address to monitor delivery side-by-side.
- Each recipient receives a separate `wp_mail` call (not a single multi-recipient `To:` header) so ServiceM8's mail server accepts it.
- DB column `servicem8_status` updated to `sent_to_inbox` or `failed` immediately; no cron queue.

### Lead capture improvements
- **Full name field** relabelled to "Full name / Company name" with updated placeholder.
- **Customer type options** updated: Homeowner, Builder, Developer, Architect, Pool Builder, Other.
- `customerType` is now included in the lead POST payload and stored in the DB (`customer_type` column, DB version bumped to `2.4.0`).
- `customer_type` shown in the admin notification email (Contact section).
- "Other" is silently omitted from the SM8 email body (no `Client:` line sent).
- `pool_builder` added to the `CustomerType` union type.

### Email fixes
- Customer estimate email is now sent asynchronously via shutdown hook — "Send →" button responds instantly instead of waiting for `wp_mail`.
- `Reply-To: support@royalglass.co.nz` hardcoded on customer estimate email.
- `From: Royal Glass Limited` header set; overridden to `info@royalglass.co.nz` by WP Mail SMTP (Force From Email ON).
- Admin notification email now shows `Type:` (customer type) in the Contact section.
- `Mobile:` label used in SM8 email (maps to ServiceM8's Mobile field, not Phone).

---

## v2.1.2 — 2026-05-22

### Bug fixes
- **Viking system missing from fixing method step** — `CalculatorForm.tsx` had only 4 fixing options (spigots, standoff, hidden channel, not sure). Viking was defined in types, had an image in the WP plugin assets, and existed in the old `Steps.tsx`, but was never added to `CalculatorForm.tsx` when that file was written. Added.
- **Viking label blank on result screen** — `FIXING_LABELS` in `ResultScreen.tsx` was missing the `viking` key, causing it to fall back to an empty string via `?? ''`. Added `viking: 'Viking System'`.
- **Substrate step not blocking Continue** — `INITIAL_ANSWERS` in `App.tsx` omitted `substrate`, so `answers.substrate` was `undefined`. `undefined !== null` evaluates to `true` in JavaScript, making `canContinue` always true on the substrate step. Added `substrate: null` to `INITIAL_ANSWERS` so the Continue button is disabled until a selection is made.
- **Plugin version out of sync** — `rg-calculator.php` header and `RG_CALC_VERSION` constant were never updated past `2.0.1` despite changelog reaching `v2.1.1`. Both updated to `2.1.2`.

### Dead code removed
- `src/components/wizard/steps/Steps.tsx` — old 7-step wizard component file, not imported anywhere. `CalculatorForm.tsx` replaced it entirely and contains all step definitions inline.
- `src/components/wizard/WizardShell.tsx` — old progress-bar shell that went with `Steps.tsx`, not imported anywhere.
- `src/assets/` — entire directory of ~40 images from the v1.x wizard (access types, glass conditions, working heights, handrail options, shapes). All images actually used by the `IMAGES` map in `config.ts` live in `wordpress-plugin/rg-calculator/assets/` and are served from the WordPress plugin URL. `src/assets/` was never imported.
- `rgv2changes.patch` — stale scratch patch file.

### Next planned: ServiceM8 integration
Leads submitted via the calculator will be pushed to ServiceM8 as new jobs. Implementation TBD.

---

## v2.1.1 — 2026-05-11

### Codebase cleanup

**Dead files removed:**
- `AGENTS.md` — stale duplicate of CLAUDE.md for OpenAI Codex (wrong tool, outdated content)
- `includes/admin-page.php` — old admin page superseded by `admin-leads.php`; called `rg_calc_get_leads()` which no longer exists; not `require_once`'d anywhere
- `src/components/wizard/ConfirmationScreen.tsx` — orphaned component not imported anywhere; replaced by `ResultScreen.tsx`
- `src/components/wizard/shared.tsx` — orphaned file not imported anywhere (`Steps.tsx` imports from `steps/shared.tsx`)

**37 orphaned image assets removed** from `wordpress-plugin/rg-calculator/assets/` — leftover from old wizard steps (glass type, shape, substrate, access, clarity, handrail, working height). The 15 images actually used by the IMAGES map in `config.ts` are retained.

**`package.json` stripped of 35 unused dependencies** inherited from the original TanStack/shadcn template: all `@radix-ui/*` packages, `@supabase/supabase-js`, `@tanstack/react-query`, `@tanstack/react-router`, `react-router-dom`, `react-hook-form`, `@hookform/resolvers`, `lucide-react`, `recharts`, `zod`, `clsx`, `class-variance-authority`, `sonner`, `vaul`, `cmdk`, `date-fns`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `tailwind-merge`, `tw-animate-css`, `vite-tsconfig-paths`. Tailwind itself retained (needed for `NZAddressAutocomplete.tsx`). Build confirmed working post-cleanup.

**`package.json` renamed** from `tanstack_start_ts` → `rg-calculator`.

**`tailwindcss` / `@tailwindcss/vite` moved to devDependencies** (build-time tools, not runtime).

### Security audit & documentation

Full codebase security scan. No code changed yet — findings documented for prioritised fixes.

**Issues found (10 total, none exploited):**

| # | Severity | Location | Issue |
|---|---|---|---|
| 1 | HIGH | `api.php:143` | `HTTP_CF_CONNECTING_IP` trusted without verifying REMOTE_ADDR is a Cloudflare IP — rate limits bypassable if origin is accessed directly |
| 2 | HIGH | `api.php:179` | `/estimate-email` has no Turnstile, honeypot, or time gate — branded HTML email can be spammed |
| 3 | MED | `database.php` | Consent validated but never stored — no audit trail for NZ Privacy Act |
| 4 | MED | `api.php:102` | Client-supplied estimate values stored/emailed without server-side recalculation |
| 5 | MED | `api.php:185` | `/estimate-email` skips `rg_validate_answers()` — arbitrary data flows into customer email |
| 6 | LOW | `api.php:167` | Rate limit check/set non-atomic — concurrent requests can exceed limit by 1 |
| 7 | LOW | `email.php:129` | `esc_html()` used in email subjects — wrong escaping function, HTML entities appear literally |
| 8 | LOW | `email.php:128` | `$from_email` inserted into headers without `sanitize_email()` |
| 9 | INFO | `LeadCapture.tsx` | `marketingConsent` captured in state but never sent to server or stored |
| 10 | INFO | `NZAddressAutocomplete.tsx` | Uses Tailwind `className` props — violates inline-style constraint |

**CLAUDE.md updated:**
- Fixed `NZAddressAutocomplete` description (was "Google Maps Places" — actually uses Nominatim/OpenStreetMap, no API key)
- `RG_GOOGLE_MAPS_KEY` constant documented as retained but currently unused
- `/estimate-email` API description flagged with known security gaps
- IP detection behaviour documented with Cloudflare caveat
- New **Security** section added: issue table + current security model summary
- Non-negotiable constraints expanded: `rg_validate_answers()` and Turnstile required on all public POST endpoints

---

## v2.1.0 — 2026-05-01

### Features added
- **Send-to-email on result screen** — "Get this estimate in your inbox" card on the result screen. Pre-fills with the submitted email address. User can change it to send to a builder, partner, or architect. Calls `POST /wp-json/royal-glass/v1/estimate-email`.
- **Optional notes field** — free-text "Anything else we should know?" textarea added to the lead capture form. Stored in `wp_rg_leads.notes` and included in the admin notification email.
- **Consultation concerns panel (amber bar)** — replaces the old "Pricing on enquiry" block. The price range always shows. If any wizard answers trigger a flag (unknown height, fixing method TBC, etc.), an amber panel attaches below the price band listing them as "things we'll confirm at the site visit." Matches between the on-screen UI and the customer email exactly.
- **Async email sending** — both the admin notification and the customer email now dispatch via `add_action('shutdown', ...)` + `fastcgi_finish_request()`. The API returns `201` to the browser immediately; email sends in the background. Eliminated the 2–5 second submit delay caused by synchronous `wp_mail()`.
- **`assetsUrl` injected by WordPress** — `wp_localize_script` now includes `assetsUrl: RG_CALC_URL . 'assets/'`. `config.ts` uses this as the primary image base URL, falling back to DOM script-tag detection only if it's missing. Fixes images not loading on mobile/incognito when a caching plugin renames or combines scripts.

### Behaviour changes
- **Price always shows** — removed `needsConsultation` as a price-blocking mechanism. The engine still populates `consultationReasons` for flagging, but the result screen always renders the low–high range.
- **Customer email is on-demand only** — the auto-confirmation email that previously fired on form submit has been removed. It was sending $0/$0 stubs. The customer now only receives an email when they explicitly request it via the result screen button, ensuring real pricing data is always in the email.
- **Admin email** — removed "Best time: anytime" line (field was hardcoded, never collected from user). Consultation block now reads "To confirm at site visit:" with `·` bullets instead of "⚠ NEEDS CONSULTATION".
- **Rate limit raised** — lead submissions increased from 5 to 10 per IP per hour. Admin users bypass rate limiting entirely (prevents testing friction for site owners).

### Bug fixes
- **"Too many submissions" error during testing** — rate limit of 5/hour was too low and had no admin bypass. Fixed.
- **"Security check failed" error** — Turnstile backend check previously required only `RG_TURNSTILE_SECRET`, not the site key. A site that had the secret but not the site key would pass the frontend silently and fail the backend. Fixed to require both constants before enforcement activates.
- **Turnstile timing race** — the Turnstile `useEffect` ran once on mount and silently failed if `window.turnstile` hadn't loaded yet (async script). Fixed with a 200ms polling loop.
- **Images not showing on mobile / incognito** — the image URL was resolved by querying `document.querySelector('script[src*="rg-calculator.js"]')`. Caching plugins (WP Rocket, Autoptimize, LiteSpeed, etc.) rename or combine scripts, making this query return `null` and falling back to a hardcoded path. Desktop users were unaffected because their browser had images cached. Fixed by injecting the canonical URL via `wp_localize_script`.
- **Price not showing with `not_sure` / `custom` answers** — `fixingMethod === 'not_sure'`, `hardwareFinish === 'not_sure'`, and `hardwareFinish === 'custom'` were all consultation triggers that hid the price. None of these affect the price calculation (no surcharge applies). Removed them as price-blocking triggers; they now appear as informational flags only.

### Codebase cleanup
Removed ~60 unused files left over from the original TanStack/shadcn template:
- `src/routes/calculator.tsx` — old TanStack route, never imported by `main.tsx`
- `src/components/calculator/` — old StepShell, VisualChoice, SliderField
- `src/components/ui/` — all 40 shadcn/Radix components (unused; wizard uses inline styles)
- `src/lib/utils.ts` — only used by the removed shadcn components
- `src/lib/calculator/pricing.ts`, `schema.ts`, `submit.ts`, `wizardData.ts`, `calculator.config.ts` — old engine files superseded by `engine.ts`, `types.ts`, `config.ts`
- `src/styles.css` — not imported anywhere
- `components.json` — shadcn CLI config, obsolete without the ui/ folder
- `supabase/` — entire directory (Supabase removed from production path)
- Old build artefacts: `rg-calculator-check/`, `rg-calculator-fixed.zip`, `wordpress-.zip`

---

## v2.0.1 — 2026-04-30

### WordPress premium styling fix
**Problem:** The calculator looked polished on local dev but degraded on WordPress — wrong fonts, colours overridden, layout broken.

**Root cause:** Tailwind v4 wraps all utility classes in `@layer` blocks. WordPress themes output unlayered CSS. Per the CSS cascade spec, unlayered styles always win over layered ones regardless of specificity. The theme was silently overriding every Tailwind class.

**Fix:** Converted all `className` usage in wizard step components (`steps/Steps.tsx`, `steps/shared.tsx`) to inline `style` props. Inline styles are the highest-priority CSS declarations and cannot be overridden by external stylesheets. Added a scoped CSS reset in `src/index.css` under `#rg-calculator-root` with ID-level specificity to neutralise theme defaults (margin, padding, box-sizing, list-style).

### WordPress plugin created (v2.0.0 baseline)
- `wp_rg_leads` custom DB table via `dbDelta`
- REST API: `POST /leads`, `GET /pricing`
- Admin notification via `wp_mail()`
- Bot protection: time gate, honeypot, Cloudflare Turnstile, IP rate limiting
- Pricing editable from WordPress admin (`admin-pricing.php`)
- Lead management table in WordPress admin (`admin-leads.php`)
- SEO: `application/ld+json` schema markup (LocalBusiness, Service, FAQPage) injected in `<head>`

---

## v1.x — Pre-WordPress (Cloudflare Workers + Supabase)

The original build used:
- **Cloudflare Workers** as the API layer
- **Supabase** for lead storage
- **TanStack Router** with hash routing
- **shadcn/ui** (Radix primitives + Tailwind) for all UI components
- **n8n** considered for post-submit automation

### Why it was replaced

| Decision | Reason |
|---|---|
| Removed Cloudflare Workers | Royal Glass runs on shared WordPress hosting. Workers added deployment complexity with no benefit over WP REST API. |
| Removed Supabase | External database dependency for a single table. `wp_rg_leads` is simpler, keeps all data in one place, and is managed with familiar WP admin tooling. |
| Removed TanStack Router | The router was not used at runtime — `main.tsx` bypassed it. The route tree added dead code. Removed entirely. |
| Removed shadcn/ui | All 40 components were unused after the inline-style rewrite. Removing them reduced the CSS bundle from ~54 KB to ~17 KB. |
| Kept `@supabase/supabase-js`, `@tanstack/react-query` in package.json | Listed in `package.json` but never imported. Left to avoid breaking changes if referenced elsewhere. Do not use for new features. |

---

## Known constraints and decisions

**Why inline styles instead of Tailwind in wizard components?**
WordPress themes are unlayered CSS. Tailwind v4 uses `@layer`. Unlayered always beats layered per the cascade spec. Inline styles cannot be overridden by any stylesheet. This is a permanent architectural decision for this project.

**Why is customer email on-demand?**
The auto-confirmation email that fired on submit used stub data (low/high = 0) because the actual estimate is computed client-side and was not passed through `rg_send_lead_email()`. On-demand send via the result screen button passes the real estimate data directly to the email function.

**Why async email with shutdown hook?**
`wp_mail()` blocks the HTTP connection for 2–5 seconds while the SMTP server accepts the message. By dispatching email in the `shutdown` action after `fastcgi_finish_request()`, the browser sees the response immediately. On PHP-FPM hosts (WP Engine, Kinsta, SiteGround) this is a true background send. On older mod_php hosts the email still sends synchronously at shutdown, but the REST response has already been sent to the client so the user sees no delay.

**Why only height triggers full consultation?**
Height is the only field with a genuine NZ Building Code implication (`less_than_1m` requires a compliance check; custom height needs design input). Fixing method and hardware finish unknowns can be baselined cheaply (spigots, standard chrome) and confirmed at site visit — hiding the price for these added no value.

**Why is `assetsUrl` injected by PHP instead of detected in JS?**
`RG_CALC_URL` is WordPress's canonical URL for the plugin directory. It handles subdirectory installs, CDN rewrites, and SSL correctly. DOM-based detection (`querySelector('script[src*="rg-calculator.js"]')`) fails silently when caching plugins rename scripts — causing blank images on fresh loads.
