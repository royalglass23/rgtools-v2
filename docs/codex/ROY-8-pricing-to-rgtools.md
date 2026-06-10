# ROY-8 — Move pricing matrix to rgtools (Admin → Cost Calculator Price)

> Agent brief. Read this entire file before writing any code. Spans BOTH repos.

## Context

- **rgtools** (this repo): Next.js 15 App Router + Drizzle + Neon + Vitest. Tailwind used here.
- **cost-calculator** (`./cost-calculator/`, SEPARATE git repo): React/Vite SPA + WordPress plugin on royalglass.co.nz (Bluehost). Pricing currently lives in WP: defaults hardcoded in `wordpress-plugin/rg-calculator/includes/api.php` (`rg_get_pricing`), overridable via WP Admin pricing page (`includes/admin-pricing.php`) stored in `wp_options` key `rg_calculator_pricing`. The React app fetches `GET /wp-json/royal-glass/v1/pricing` on mount (`src/hooks/usePricing.ts`) and falls back to `DEFAULT_PRICING` in `src/lib/calculator/config.ts`.
- **Goal:** rgtools becomes the single source of truth for pricing. WP becomes a caching proxy. The public calculator must keep working through any rgtools outage.
- **Pattern to copy:** `scoring_config_versions` table in `drizzle/schema-leads.ts` — versioned JSONB, one active row. If ROY-7 (Lead Scoring UI) is already merged, copy its UI/server-action patterns too; they are deliberately the same shape of problem.

## Pricing config shape (canonical — from `rg_get_pricing` defaults)

```
scenarios: { ground_level | balcony_balustrade | premium_pool_fence | stair_balustrade:
             { ratePerMetre: number, gatePrice: number|null } }
minimumLength: number
cornerSurcharge: number
hardwareFinishSurcharge: { standard_chrome, matte_black, brushed_chrome, powder_coated, not_sure: number }
glassTypeSurcharge: { toughened_12mm, laminated: number }
glassColourSurcharge: { clear, tinted, frosted, low_iron: number }
interlikingRailsSurcharge: number      // note: existing typo "interliking" — KEEP it, the React app reads this key
fixing method surcharges                // check WP admin-pricing.php + React config.ts for the exact key; mirror it
rangeLowPercent / rangeHighPercent: number
```

**Important:** mirror the EXACT JSON keys the React app already consumes (verify against `src/lib/calculator/config.ts` `PricingConfig` type and `usePricing.ts`). Do not "fix" key spellings — the WP proxy must return byte-compatible structure.

## Execution plan

### rgtools side

1. **Schema:** `pricing_config_versions` table in a new `drizzle/schema-pricing.ts` (or appended to `schema-leads.ts` — match repo convention; ask if unsure): id uuid, versionLabel text unique, isActive boolean, config jsonb, createdBy uuid → users, createdAt, archivedAt. Same "one active" rule as scoring (partial unique index is hand-managed there — replicate the approach, and STOP before applying any migration).
2. **Seed script** `scripts/seed-pricing-config-v1.ts`: seeds from a JSON blob of the **current LIVE WP values** — put a `LIVE_VALUES_PLACEHOLDER` constant at top with the structure filled from the defaults, and **flag in your report that the human must paste actual live values from WP Admin → RG Calculator → Pricing before running it**. Do not run it yourself.
3. **Public endpoint** `app/api/pricing/route.ts`: GET, no auth (prices are public — they render in a public calculator), returns the active config JSON. Set `Cache-Control: public, max-age=300`. Return 503 with no body if no active version exists. Add a route test (follow `app/api/lead-intake/servicem8/retry/__tests__/route.test.ts` mocking pattern).
4. **Admin UI** at `app/(dashboard)/admin/calculator-pricing/page.tsx` + `modules/admin/pricing/`: view active version, edit as NEW version + activate (transaction: insert → activate → deactivate previous), version history, activate past version (rollback). Audit-log activations. Server-side admin guard. Same never-mutate-in-place rule as scoring configs. Validation: all numbers finite ≥ 0 (negative allowed ONLY for fixing-method surcharges — cheaper methods are valid per calculator docs), `rangeLowPercent ≤ rangeHighPercent`, all required keys present.

### cost-calculator side (WP plugin)

5. **Proxy with resilience chain** in `includes/api.php` `rg_get_pricing`:
   - Try transient `rg_pricing_cache` (TTL 10 min) → return if present.
   - Else fetch rgtools `GET <RG_TOOLS_PRICING_URL>` (new wp-config constant, e.g. `https://<rgtools-host>/api/pricing`) with 5s timeout via `wp_remote_get`.
   - On success: validate it decodes to an array with `scenarios` key → store transient (10 min) AND store a second never-expiring option `rg_pricing_last_known` → return it.
   - On failure: return `rg_pricing_last_known` if it exists, else the existing hardcoded `$defaults`.
   - If `RG_TOOLS_PRICING_URL` is not defined: behave exactly as today (read `rg_calculator_pricing` option / defaults). This makes deployment safe — nothing changes until the constant is set.
6. **Retire the WP pricing page:** in `admin-pricing.php`, when `RG_TOOLS_PRICING_URL` is defined, render the page read-only with a notice "Pricing is managed in RG Tools" and disable the save handler. Do not delete the file.
7. Rebuild + zip per `cost-calculator/CLAUDE.md` deploy section (do NOT copy .jpg files).

## Hard guardrails

- Read `cost-calculator/CLAUDE.md` first; its constraints bind all WP work (no Tailwind, no webhooks in public submission path, server-side validation never skipped).
- The resilience chain is non-negotiable: the public calculator must never show "no pricing" because rgtools is down.
- No new npm dependencies in either repo.
- Do not run `npm run db:migrate` or any seed script against the DB without asking (live Neon risk).
- Do not change the pricing JSON key names the React app consumes.
- Branches: `roy-8-pricing-source-of-truth` (rgtools), feature branch in cost-calculator. Never commit to `main`.

## Stop and ask when

- Unsure whether ROY-7's scoring UI exists yet to copy patterns from (if it does, reuse; if not, build standalone and note it).
- Where to put the new schema file (new file vs appended) if repo convention is ambiguous.
- The exact fixing-method surcharge key name differs between WP and React config — ask which is canonical rather than guessing.
- Any migration or seed needs running.
- You want to change the public endpoint to require auth (expected answer: no).

## Human-only steps

- Paste current live WP pricing values into the seed script, then approve running it.
- Apply the Neon migration (after your ask).
- Define `RG_TOOLS_PRICING_URL` in live `wp-config.php` (this is the cutover switch).
- Upload the rebuilt plugin zip to WordPress.
- Verify live calculator still prices correctly, then confirm the WP pricing page shows read-only.

## Definition of done

- rgtools: table + seed script (not run), `/api/pricing` endpoint + test, admin UI with versioning + audit logs, all tests/lint/typecheck pass.
- cost-calculator: proxy with full fallback chain, read-only pricing page when constant defined, builds clean, zero behavior change when constant undefined.
- Final report: commits, human-only cutover checklist in order, any concerns.
