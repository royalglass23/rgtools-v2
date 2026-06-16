# Architecture

## System overview

```
┌─────────────────────────────────┐     ┌──────────────────────────┐
│  Next.js app (Vercel)           │     │  Cloudflare Worker       │
│                                 │     │  rg-tracker              │
│  ┌──────────┐  ┌─────────────┐  │     │                          │
│  │ Dashboard │  │ Lead Intake │  │     │  POST /track             │
│  └──────────┘  └─────────────┘  │     │  (open / scroll / close) │
│  ┌──────────┐  ┌─────────────┐  │     └────────────┬─────────────┘
│  │  Admin   │  │Quote Tracker│  │                  │
│  └──────────┘  └─────────────┘  │                  │
└────────────────┬────────────────┘                  │
                 │                                    │
                 ▼                                    ▼
        ┌─────────────────────────────────────────────────┐
        │           Neon PostgreSQL                        │
        │  users · sessions · quotes · quote_events        │
        │  quote_engagement · leads · clients              │
        │  scoring_config_versions · audit_log · error_log │
        └──────────────────────────────────────────────────┘
```

The Next.js app handles all staff-facing UI and business logic. The `rg-tracker` Cloudflare Worker handles quote engagement beacons from clients — it is a separate deploy with its own `wrangler.toml` and shares only the database.

## Authentication

NextAuth v5 with a credentials provider. Staff log in with username + password (bcrypt hashed). Sessions are JWTs, 4-hour expiry. The JWT carries `id` and `role` (`admin` | `staff`).

Role-based module access:
- **Admin** — sees all active modules
- **Staff** — sees modules where a grant row exists in `user_module_access`

Guards are enforced in `middleware.ts` (route-level redirect) and `lib/guard.ts` (page-level server check). Tests live in `__tests__/middleware.test.ts` and `lib/__tests__/access.test.ts`. The `(dashboard)` route group requires an authenticated session; unauthenticated requests redirect to `/login`.

## Database schema

Two schema files in `drizzle/`:

**`schema.ts`** — core tables:
- `users`, `sessions` — auth
- `quotes`, `quote_events`, `quote_engagement`, `tag_overrides` — quote pipeline and engagement tracking
- `settings`, `modules`, `user_module_access` — configuration and access control
- `audit_log`, `error_log` — observability

**`schema-leads.ts`** — lead management:
- `clients` — deduplicated client records (matched by normalised phone or email)
- `leads` — individual enquiries linked to a client
- `lead_category_scores` — per-category scoring answers and points
- `scoring_config_versions` — versioned scoring config stored as JSONB
- `lead_outcomes`, `lead_status_changes` — outcome tracking
- `lead_submit_attempts` - public calculator rate limiting
- `lead_submit_failures` - dead-letter rows for valid calculator payloads that fail mapping or save
- `lead_email_log` - customer estimate email send results

Migrations are managed with Drizzle Kit (`drizzle/migrations/`).

## Module breakdown

### `modules/lead-intake/`

The lead intake module is the main staff workflow. Key files:

| File | Responsibility |
|------|---------------|
| `LeadIntakeForm.tsx` | Client-side form, real-time score panel, distance display |
| `PlacesAutocomplete.tsx` | Google Places address autocomplete (lazy-loads Maps SDK) |
| `ScorePanel.tsx` | Live scoring display — reads active config, renders category bars |
| `actions.ts` | Server actions: `submitLeadIntake`, `computeLeadDistance`, `getLeadIntakeForEdit` |
| `distance.ts` | Calls Google Distance Matrix API, returns a distance band |
| `intake-utils.ts` | Input normalisation, validation, category answer building |
| `scoring/score-lead.ts` | Pure scoring function — takes answers + config, returns score/tier/strike result |
| `scoring/config-options.ts` | Loads the active scoring config from DB, formats options for the form |
| `scoring/persist-score.ts` | Runs scoring and writes results back to the `leads` row |
| `servicem8/client.ts` | SMTP client that sends leads to the ServiceM8 inbox |
| `servicem8/payload.ts` | Builds the ServiceM8 email payload from a lead record |
| `servicem8/sync.ts` | Orchestrates ServiceM8 sync — mark pending, attempt, handle retry |
| `calculator/map-calculator-submission.ts` | Maps the browser calculator payload into lead intake input |
| `anti-spam/*` | Public calculator protections: client IP, Turnstile, and rate limiting |
| `email/customer-estimate.ts` | Sends/logs the calculator customer estimate email via Resend |

### Public calculator submit

`POST /api/lead-intake/calculator-submit` is the public lead front door for the WordPress-hosted calculator. It is excluded from auth middleware but only accepts the configured `CALCULATOR_ALLOWED_ORIGIN`.

The hot path is intentionally short:

1. CORS, honeypot, time-gate, Turnstile, and IP rate-limit checks run first.
2. The browser payload is mapped to `LeadIntakeInput`.
3. `submitLeadIntakeForUser(input, null, { syncServiceM8: false })` saves to Neon and scores the lead.
4. The route returns `{ ok: true, leadId }`.
5. Customer email runs in the background; ServiceM8 remains `pending_sync` for the retry route/cron to drain.

Valid prospect payloads that pass anti-spam but fail mapping or saving are written to `lead_submit_failures` with the raw payload and correlation id.

### `modules/leads/`

The leads module provides the read-side dashboard for reviewing and triaging leads. Key files:

| File | Responsibility |
|------|---------------|
| `queries.ts` | `getLeadsList` (paginated, filtered) and `getLeadDetail` (full record with scored fields) |
| `LeadsTableControls.tsx` | Client component — filter bar, table, pagination, bulk-delete form |
| `ServiceM8FetchButton.tsx` | Client component — calls the fetch API route and updates the displayed UUID/status |
| `DeleteLeadButton.tsx` | Confirmation wrapper for the per-lead delete action |
| `actions.ts` | `batchDeleteLeadsAction` — soft-deletes selected leads (admin only) |
| `servicem8-fetch.ts` | `fetchLeadFromServiceM8` — searches ServiceM8 for a job matching `RGTools Lead {uuid}`, stores the UUID and status, sets the Leads Quality custom field on first link |

The ServiceM8 fetch uses a dependency-injectable `request` parameter so it can be tested without real API calls.

### `modules/admin/`

User management (create/list/delete users), CSV export of quotes, error log viewer. Admin-only.

### `modules/quote-tracker/`

Stub — reserved for a future staff-facing view of quote engagement data.

### `workers/tracker/`

Cloudflare Worker deployed separately. Receives POST `/track` beacon events from quote pages:
- `open` — increments `total_opens`, `unique_sessions`, `unique_devices`
- `scroll` — updates `max_scroll_depth`
- `close` — accumulates `total_time_ms`

IPs are SHA-256 hashed before storage. Device type (mobile/desktop) is detected from User-Agent.

## Shared libraries (`lib/`)

Utilities used across multiple modules and scripts live in `lib/`:

| File | Responsibility |
|------|---------------|
| `access.ts` / `access-db.ts` | Module access checks (in-memory and DB-backed) |
| `admin-navigation.ts` | Navigation registry for admin sidebar |
| `audit.ts` | Typed audit log writer |
| `auth.ts` / `auth-helpers.ts` | NextAuth session helpers |
| `db.ts` | Drizzle + Neon database client |
| `error-message.ts` | Safe error-to-string helper |
| `guard.ts` | Page-level auth/role guard |
| `logger.ts` | Structured server logger |
| `short-code.ts` | Base62 short code generator (`generateShortCode`) and validator (`isValidShortCode`) — 7-char URL-safe codes used as public quote link identifiers |
| `servicem8/client.ts` | Shared ServiceM8 REST client — see below |

### ServiceM8 client (`lib/servicem8/client.ts`)

Centralises authentication and base-URL handling so both the leads module and the quote scripts talk to ServiceM8 identically. Uses `X-API-Key` header auth against the `api_1.0` base URL.

Key exports:

| Export | What it does |
|--------|-------------|
| `createServiceM8RequestFromEnv()` | Returns a `ServiceM8FetchRequest` bound to `SERVICEM8_API_KEY` |
| `getJobQuoteMeta(jobUuid, request)` | Fetches job metadata + resolves client name via `company_uuid` |
| `getQuoteAttachmentPdf(jobUuid, request)` | Finds the `QUOTE`-source PDF attachment and downloads it |
| `waitForQuoteAttachmentPdf(jobUuid, request, opts)` | Polls until the quote PDF appears (for watch mode) |
| `resolveJobUuid(opts, request)` | Resolves a job UUID from a job number, explicit UUID, or "latest quote" |
| `downloadAttachmentFile(attachmentUuid, apiKey)` | Downloads raw attachment bytes (follows 302 CDN redirect) |

The injectable `ServiceM8FetchRequest` type allows tests to pass a mock instead of hitting the real API.

## Quote pipeline scripts (`scripts/`)

Developer scripts for testing the quote delivery pipeline before the full staff UI is built. All accept `--job <number>`, `--uuid <jobUuid>`, or `--latest` to select a ServiceM8 job.

| Script | npm alias | What it does |
|--------|-----------|-------------|
| `quote-pull-test.ts` | `pnpm quote:pull` | Pulls job metadata + quote PDF, saves PDF to `tmp/`. For verifying a job is pullable without serving it. |
| `quote-preview.ts` | `pnpm quote:preview` | Pulls the quote, starts the local viewer at `localhost:<port>/q/<code>`, and opens the browser. |
| `quote-share.ts` | `pnpm quote:share` | Same as preview, plus opens a Cloudflare quick-tunnel and prints a temporary public URL. Downloads `cloudflared.exe` to `tmp/` on first run. |

The scripts share `scripts/lib/quote-server.ts`, which starts a Node HTTP server that:
- Serves the PDF at `/q/<code>/pdf`
- Serves a PDF.js viewer HTML page at `/q/<code>`
- Generates the short code via `lib/short-code.ts`
- Supports a `--watch` flag to poll until ServiceM8 generates the quote PDF

## Scoring engine

The scoring engine is config-driven. The active config is a JSONB blob in `scoring_config_versions`. It defines:

- **Categories** (1–7) — each has a `max` point value and a map of answer keys → points
- **Tiers** — score thresholds for A, B, C (D is the fallback below C threshold)
- **Strikes** — "blocker low" answer keys that trigger tier demotion regardless of raw score

The `scoreLead()` function in `scoring/score-lead.ts` is pure (no DB calls). It takes `LeadAnswers` and `ScoringConfig` and returns a `ScoreResult` including tier, score, category breakdown, and strike result.

Scoring config is versioned. Seeding a new version deactivates the old one. `config_version_id` is stored on each `lead` and `lead_category_score` row so historical scores can always be re-interpreted.

### Strike layer

Certain answer keys are designated "blocker low" in the config's `strikes.weights` map. When selected:

1. The answer contributes **0 points** to the raw score
2. The strike weight is accumulated
3. If total weight ≥ `softDemoteAt` (1.0): tier is soft-demoted one step (A→B, B→C, C→D)
4. If total weight ≥ `capAt` (2.0): tier is capped at `capCeiling` (C) — the worse of soft-demote and cap applies

An amber flag note is shown on the score panel and result banner when any strike fires.

## ServiceM8 integration

ServiceM8 is the field-service management system. rgtools integrates in two stages:

### Stage 1 — Inbox sync (on lead creation)

When a lead is submitted via the intake form:

1. Lead is inserted with `sync_status = 'pending_sync'`
2. An email is built by `servicem8/payload.ts` — includes client details, score, tier, and an `RGTools Lead {uuid}` reference line in the body
3. The email is sent via nodemailer to `SERVICEM8_INBOX_EMAIL`
4. On success: `sync_status = 'synced'`
5. On failure: `sync_status = 'sync_failed'`, error stored in `sync_error`

After Stage 1 the lead has no ServiceM8 job UUID — ServiceM8 creates a job from the inbox email asynchronously.

### Stage 2 — Job fetch (manual, on demand)

Staff click **Fetch from ServiceM8** on the lead detail page (`/leads/[id]`). This calls `POST /api/leads/[id]/servicem8-fetch`, which runs `fetchLeadFromServiceM8` in `modules/leads/servicem8-fetch.ts`:

1. Queries `GET /job.json` with a date filter (`date gt <leadCreatedAt - 1 day>`) — the one-day margin guards against timezone skew
2. Searches the result for a job whose `job_description` contains `RGTools Lead {leadId}`
3. **Inbox fallback**: if no matching job is found by date, searches `GET /inboxmessage.json` for a message containing the reference in `message_text`, `message_html`, or `subject`, then follows `converted_to_job_uuid` to the job record
4. Stores `servicem8_job_uuid` and `servicem8_status` on the lead row
5. On the **first** link only: writes the lead tier to the `SERVICEM8_LEAD_QUALITY_FIELD` custom field via `POST /job/{uuid}.json`
6. An audit log entry (`lead.servicem8_fetch`) is written

`modules/leads/servicem8-fetch.ts` re-exports `createServiceM8RequestFromEnv` and `ServiceM8FetchRequest` from `lib/servicem8/client` so existing importers and tests do not need path changes.

`sync_status` badges on the list: **Linked** = job UUID exists; **Pending** = email sent, UUID not yet fetched; **Failed** = inbox email failed.
