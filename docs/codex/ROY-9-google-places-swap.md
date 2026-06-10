# ROY-9 — Swap calculator address autocomplete to Google Places

> Agent brief. Read this entire file before writing any code. This task is in the **cost-calculator repo only** (`./cost-calculator/`, a SEPARATE git repo).

## Context

- **cost-calculator**: React/Vite SPA delivered as a WordPress plugin shortcode on royalglass.co.nz. **Inline styles only — Tailwind is banned in this repo** (WordPress theme CSS overrides Tailwind layers; see its `CLAUDE.md`).
- Current autocomplete: `src/components/wizard/NZAddressAutocomplete.tsx` uses Nominatim (OpenStreetMap) — no API key, but its usage policy effectively prohibits as-you-type autocomplete, and accuracy is worse than Google for NZ addresses.
- Key plumbing already exists: `rg-calculator.php` injects `RG_GOOGLE_MAPS_KEY` via `wp_localize_script` into `window.rgCalculatorConfig.googleMapsKey` — currently unused. Access via `getConfig()` from `src/hooks/usePricing.ts`.
- Consumer: `LeadCapture.tsx` renders `<NZAddressAutocomplete value onChange error />`. **Keep this props contract unchanged** so `LeadCapture.tsx` needs zero edits.
- Why this matters downstream: rgtools re-geocodes the address with Google to compute distance bands — Google-formatted input improves that.

## Objective

Replace Nominatim with Google Places autocomplete inside `NZAddressAutocomplete.tsx`, same external behavior, no other file changes (except none expected at all beyond this component).

## Execution plan

1. Read `cost-calculator/CLAUDE.md` and the current `NZAddressAutocomplete.tsx` in full.
2. Load the Google Maps JS API with Places library at component mount **only if `getConfig().googleMapsKey` is non-empty** — inject the script tag dynamically (pattern reference: the Turnstile script polling in `LeadCapture.tsx`). **Do not add the `@googlemaps/js-api-loader` npm package** — this repo avoids dependency growth; a ~15-line script injector is fine.
3. Use the Places Autocomplete **service** (AutocompleteService + session tokens) rendering suggestions in your own dropdown styled with inline styles matching the current component's look — do NOT use the Google-supplied widget (`google.maps.places.Autocomplete` attached to the input), because its dropdown styling clashes with WP themes and you can't control it with inline styles. Restrict: `componentRestrictions: { country: 'nz' }`, request only what's needed (address predictions).
4. On suggestion select: set the full formatted address string via the existing `onChange(value)` — the rest of the app treats address as a plain string; keep it that way.
5. **Fallback behavior:** if `googleMapsKey` is empty or the script fails to load, degrade to a plain text input (still satisfies "address is required" validation). Do NOT keep Nominatim as fallback — remove all Nominatim code.
6. Session tokens per autocomplete session (create on first keystroke, discard after selection) — this is the billing-efficient pattern; skipping it multiplies cost.
7. Debounce keystrokes ≥300ms (the current component likely does similar — match or improve).
8. Build + deploy bundle per CLAUDE.md: `npm run build`, copy `dist/rg-calculator.js` and `dist/rg-calculator.css` to `wordpress-plugin/rg-calculator/assets/` (NEVER copy .jpg files), re-zip.

## Hard guardrails

- **Inline styles only.** No Tailwind, no CSS modules, no styled-components.
- **No new npm dependencies.**
- **Props contract unchanged** (`value`, `onChange`, `error`) — `LeadCapture.tsx` must not need edits.
- The API key is browser-visible by design; its security model is Google-console restrictions (human step). Never hardcode a key in source.
- Do not touch the WP plugin PHP, the pricing engine, or any other component.
- There are no automated tests in this repo — verify by running `npm run dev` and exercising the field manually (describe what you tested in the report).
- Branch: feature branch in cost-calculator repo. Never commit to `main`.

## Stop and ask when

- `window.rgCalculatorConfig.googleMapsKey` turns out not to be wired the way CLAUDE.md describes.
- You believe a new dependency is genuinely required (expected answer: it isn't).
- The dev environment has no API key to test with — ask for a dev key rather than shipping untested.

## Human-only steps — list in final report

- Google Cloud console: create/restrict the key — HTTP referrer restriction to `royalglass.co.nz/*`, API restriction to Maps JavaScript API + Places API, set a billing budget alert.
- Define/confirm `RG_GOOGLE_MAPS_KEY` in live `wp-config.php`.
- Upload the rebuilt plugin zip.
- Live verification: suggestions appear for NZ addresses, selection fills the field, lead submits, address arrives correctly in the lead email/record.

## Definition of done

- Nominatim fully removed; Google Places suggestions working in `npm run dev` with a test key; graceful plain-input fallback without a key.
- `npm run build` and `npm run lint` pass; bundle copied; zip rebuilt.
- Final report: what was manually tested, commits, human-only checklist.
