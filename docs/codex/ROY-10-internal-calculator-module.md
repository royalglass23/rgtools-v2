# ROY-10 — Build internal cost-calculator module in rgtools

> Agent brief. Read this entire file before writing any code.
> **BLOCKED BY ROY-8** — verify `pricing_config_versions` exists in `drizzle/` and has an active seeded row before starting. If it doesn't, STOP: this task is not ready.

## Context

- **rgtools** (this repo): Next.js 15 App Router + Drizzle + Neon + Vitest. Tailwind used here. Module pattern: business logic in `modules/<name>/`, routes in `app/(dashboard)/<slug>/`, nav driven by `getAccessibleModules(userId)` (`lib/access-db.ts`).
- **cost-calculator** (`./cost-calculator/`, separate repo): the public calculator. Its pricing engine is a **pure function** with zero WordPress/React dependencies: `src/lib/calculator/engine.ts` exports `calculateEstimate(answers, pricing) -> EstimateResult`; types in `src/lib/calculator/types.ts` (`WizardAnswers`, `EstimateResult`, `PricingConfig`).
- **Purpose:** staff on a phone call produce an estimate during lead intake instead of telling the caller to use the website. Estimate output feeds the lead-intake form.
- Existing pieces to reuse: `modules/lead-intake/PlacesAutocomplete.tsx` (Google address field), `modules/lead-intake/LeadIntakeForm.tsx` (the form the estimate feeds into).

## Objective

Internal calculator at `app/(dashboard)/cost-calculator/` + `modules/cost-calculator/`: staff fills a single-page form (scenario, length, corners, gates, glass type/colour, fixing method, substrate, hardware finish), sees the live estimate range + consultation flags, and can carry the estimate into a new lead-intake with one click.

## Execution plan

1. **Port the engine** (copy, don't import across repos): `cost-calculator/src/lib/calculator/engine.ts` + the needed types from `types.ts` → `modules/cost-calculator/engine.ts` + `types.ts`. Copy verbatim except imports. Do NOT port `config.ts`'s `DEFAULT_PRICING` values — pricing comes from the DB (see guardrails). Port the engine's existing behavior including `consultationFlags` (informational, never hides price).
2. **Port/adapt the engine's tests** if the public repo has any (it has none — so write characterization tests: feed known answer combos through `calculateEstimate` with a fixture pricing config and assert the low/high/flags; lock in current behavior).
3. **Pricing loader** `modules/cost-calculator/pricing.ts`: read the active `pricing_config_versions` row (same query shape as `getActiveScoringOptionLists` in `modules/lead-intake/scoring/config-options.ts`). Throw a clear error if no active version. NEVER hardcode price values in rgtools.
4. **UI** `app/(dashboard)/cost-calculator/page.tsx` (server: load pricing, guard access) + a client form component in `modules/cost-calculator/`. Single page, all fields visible (staff knows the products — no 9-step wizard). Estimate recomputes client-side on every change (`calculateEstimate` is pure — pass the loaded pricing down). Show: low–high range, consultation flags, breakdown if the engine provides it.
5. **Hand-off to lead intake**: a "Start lead intake with this estimate" button that navigates to the lead-intake form with the estimate summary prefilled into the free-text field (check how `LeadIntakeForm.tsx` receives initial values — follow whatever mechanism exists; if none exists, query-param or sessionStorage hand-off, ask if ambiguous). Summary format: project type, dimensions, options, `$low – $high`, flags — mirror the freeText block format used by the calculator import mapper if ROY-5 landed (`modules/lead-intake/calculator/map-wp-lead.ts` `buildFreeText`).
6. **Address field**: only if the form needs one for context — reuse `PlacesAutocomplete.tsx`. (The estimate itself doesn't need an address; it's needed at intake time. Prefer leaving address to the intake form — less duplication. Note this choice in the report.)
7. **Register the module** so it appears in nav via the access system: find how existing modules (`lead-intake`, `leads`, `quote-tracker`) are registered in `lib/access-db.ts` / seed scripts, and follow that pattern exactly. If registration requires a DB insert, write the seed/SQL but STOP before running it.
8. Tests: engine characterization tests, pricing loader (no-active-version error), and a render/logic test for the estimate recompute if the repo has component-test precedent (check `modules/lead-intake/__tests__/` first; if there's no component-testing precedent, don't introduce a new testing approach — server-action and pure-logic tests suffice).

## Hard guardrails

- **Pricing values exist in exactly one place: the `pricing_config_versions` active row.** No `DEFAULT_PRICING` constant, no fallback prices in code. If pricing is unavailable, the module shows an error — it does not guess.
- **Do not call the WP `/wp-json/royal-glass/v1/pricing` endpoint.** That's the public calculator's path; this module reads Neon.
- Copy the engine faithfully — do not "improve" pricing math while porting. Any engine change desynchronizes internal vs public estimates. If you spot a bug in the engine, report it; fix it in BOTH repos only after the human agrees.
- No new npm dependencies.
- Do not modify lead-intake logic beyond the minimal prefill hand-off.
- Do not run migrations/seeds without asking.
- Branch: `roy-10-internal-calculator`. Never commit to `main`.

## Stop and ask when

- `pricing_config_versions` doesn't exist or has no active row (ROY-8 not done — task is blocked).
- `LeadIntakeForm.tsx` has no initial-values mechanism and you must choose a hand-off approach.
- Module registration in the access system requires schema changes.
- You find a discrepancy between the ported engine's output and the public calculator's for identical inputs.

## Human-only steps

- Approve + run any module-registration DB insert.
- Grant module access to staff users.
- Spot-check: same inputs on the public calculator and the internal module produce identical estimates.

## Definition of done

- Staff with access see "Cost Calculator" in nav; form produces estimates matching the public calculator for identical inputs; one click starts a prefilled lead intake.
- Engine characterization tests + pricing loader tests pass; `npm run test:run`, `npm run lint`, `npx tsc --noEmit` all pass.
- Final report: commits, the address-field decision, any engine discrepancies found, human-only checklist.
