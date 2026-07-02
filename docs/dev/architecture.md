# Architecture

## Workspace overview

rgtools is a pnpm workspace:

| Path | Purpose |
|------|---------|
| `apps/web` | Internal RG Tools Next.js app |
| `apps/catalog` | Placeholder public catalog app |
| `packages/db` | Shared Drizzle schema and database client |
| `workers/viewer` | Public quote PDF viewer and email gate |
| `workers/tracker` | Quote engagement beacon endpoint |
| `workers/notifier` | Quote-open and high-intent notification cron |
| `workers/cleanup` | Expired quote PDF cleanup and raw IP purge cron |

Root scripts in `package.json` delegate to workspace packages. The internal app imports shared DB code through `@rgtools/db`.

## System overview

The Next.js app handles staff-facing UI and business logic. Cloudflare Workers handle the client-facing quote lifecycle. Neon PostgreSQL is the shared system of record.

```text
apps/web (Vercel)
  Dashboard
  Lead Intake
  Leads
  Clients
  Quote Tracker
  Work Orders
  PS Generator
       |
       v
packages/db -> Neon PostgreSQL
       ^
       |
Cloudflare Workers + R2
  rg-viewer  /q/<code>
  rg-tracker POST /track
  rg-notifier scheduled emails
  rg-cleanup scheduled expiry cleanup
```

## Authentication and access

NextAuth v5 uses a credentials provider. Staff log in with username and password. Sessions are JWTs with admin/staff roles.

Route protection is enforced in:

- `apps/web/proxy.ts` - redirects unauthenticated app routes to `/login`, with public API exceptions.
- `apps/web/app/(dashboard)/layout.tsx` - requires an authenticated session for dashboard routes.
- `apps/web/lib/guard.ts` - page/module-level guards such as `requireModule('ps-generator')`.
- `apps/web/lib/access.ts` and `apps/web/lib/access-db.ts` - module access checks.

Admins see all active modules. Staff see modules where a grant row exists in `user_module_access`. Server actions and route handlers re-check session/module permissions for mutating operations; middleware and layouts are navigation and page-entry guards, not the only security boundary.

## Database schema

Schema files live in `packages/db/src`:

| File | Contents |
|------|----------|
| `schema.ts` | Auth, modules, quote tracking, settings, audit, and error-log tables |
| `schema-leads.ts` | Clients, leads, lead scoring, lead email, calculator submit, and lead outcome tables |
| `schema-ps-generator.ts` | PS Generator configuration, generation events, generated PDF objects, audit, and migration records |
| `schema-workorders.ts` | Work Order records, operational option lists, refresh runs, and timeline events |
| `client.ts` | Neon pool + Drizzle client that loads all schemas |

Migrations are generated and applied from the repo root into `drizzle/migrations/`.

## Staff modules

### Lead Intake

Source path: `apps/web/modules/lead-intake`.

The lead intake module captures enquiries, computes distance, scores the lead using the active scoring config, writes audit records, and sends the lead to the ServiceM8 inbox. Public calculator submissions enter through `POST /api/lead-intake/calculator-submit` and use anti-spam checks before mapping the payload into the lead intake flow.

Key areas:

- `LeadIntakeForm.tsx`, `PlacesAutocomplete.tsx`, `ScorePanel.tsx`
- `actions.ts`, `intake-utils.ts`, `distance.ts`
- `scoring/*`
- `servicem8/*`
- `anti-spam/*`
- `calculator/*`

### Leads

Source path: `apps/web/modules/leads`.

The leads module provides list/detail workflows, filtering, bulk delete, ServiceM8 fetch, and per-user table preferences. ServiceM8 fetch searches for `RGTools Lead {uuid}` in jobs, falls back to inbox messages when needed, stores the job UUID/status, and writes the lead-quality custom field on first link.

### Clients

Source path: `apps/web/modules/clients`.

Client records are deduplicated by normalised phone or email and linked to leads and tracked quotes. Merge planning and cleanup live in the clients module. Admins can review duplicate candidates from `/admin/client-merge-review`; the cleanup script applies approved merge plans with audit records rather than silently deleting history.

### Quote Tracker

Source path: `apps/web/modules/quote-tracker`.

The quote tracker pulls a ServiceM8 quote PDF, stores it in R2, mints a short code, and lets staff track client engagement.

Key files:

| File | Responsibility |
|------|----------------|
| `create-tracked-quote.ts` | Pulls ServiceM8 metadata/PDF, uploads to R2, mints the quote row |
| `actions.ts` | Server actions behind the Track Quote flow |
| `QuoteTableControls.tsx` | List filters, search, and table controls |
| `queries.ts` | List/detail/KPI queries |
| `email-gate.ts` | Recipient allow-list and email-gate matching |
| `viewer-analytics.ts` | Per-session/per-recipient engagement read model |
| `score.ts` | Engagement status and interest score |
| `settings-query.ts` | Tracking, viewer-feature, and notification settings |
| `conversation-snapshot.ts` | ServiceM8 conversation/context snapshot for AI guidance |
| `ai-suggestion.ts` | OpenAI-backed next viable move guidance and email/phone follow-up content |
| `ai-guidance.ts` | Latest AI guidance read model for the quote detail page |

Quote detail pages show engagement, viewer analytics, email gate settings, manual status controls, and AI Guidance when configured. AI guidance is staff-facing only; it does not change quote state or send messages automatically.

### Work Orders

Source path: `apps/web/modules/work-orders`.

The Work Orders module imports active installation work orders from ServiceM8 into RG Tools, reconciles current/non-current records, and lets staff manage internal operational fields such as installer, stage, hardware status, install date, risk, importance, and approach notes.

Timeline events are internal by default. Manage users can mark deliberate timeline entries as future client-visible candidates by storing a separate customer-safe title and message on the event; raw audit fields remain staff-facing and are not published or written back to ServiceM8.

### PS Generator

Source path: `apps/web/modules/ps-generator`.

The PS Generator creates PS1 and PS3 Producer Statement PDF packages from the published configuration.

Key files:

| File | Responsibility |
|------|----------------|
| `generation.ts` | Validates selections, chooses templates, fills PDF AcroForm fields, returns generated PDFs |
| `configuration.ts` | Loads and builds the published configuration read model |
| `seed-config.ts` | Seed model for `wordpress-plugin-v1` systems, options, templates, mappings, and descriptions |
| `config.ts` | Default selections and fixed option categories |

Routes and API:

- `apps/web/app/(dashboard)/ps-generator/page.tsx` - Generate PS page.
- `apps/web/app/(dashboard)/ps-generator/configuration/page.tsx` - admin-only configuration surface.
- `apps/web/app/api/ps-generator/generate/route.ts` - authenticated generate endpoint.
- `apps/web/scripts/seed-ps-generator-config-v1.ts` - published config seed.

The generated PDF flow reads template PDFs from storage keys such as `templates/ps-generator/wordpress/double-disc/ps1-standard.pdf`. Missing published config raises `published_config_missing`; missing template files raise `template_pdf_missing`.

### Admin

Source path: `apps/web/modules/admin`.

Admin features include user management, CSV export, error-log viewing, dashboard table configuration, scoring configuration, tracking settings, lead import, and client merge review.

## Cloudflare workers

### `workers/viewer`

Serves public quote links at `quotes.royalglass.co.nz/q/<code>`, enforces expiry and optional email gate, streams the PDF from R2, and renders PDF.js with tracker beacons. The viewer also serves `/privacy` and in-viewer privacy/cookie notices. Email-gated PDF access uses a signed gate proof created with `GATE_HMAC_SECRET`.

### `workers/tracker`

Receives `POST /track` events for opens, scroll, close, page views, downloads, prints, and CTA clicks. IPs are hashed before storage. Tracking signal collection is controlled by settings.

### `workers/notifier`

Runs on cron, emails staff when a quote is first opened by an external viewer and when it crosses the high-intent threshold. Notification timestamps on `quotes` prevent duplicate sends.

### `workers/cleanup`

Runs on cron, deletes expired quote PDFs from R2, archives quote rows, and purges raw IPs from old quote events.

## Shared app libraries

Source path: `apps/web/lib`.

| File | Responsibility |
|------|----------------|
| `db.ts` | Re-exports the shared `@rgtools/db` client for app imports |
| `auth.ts`, `auth-helpers.ts` | NextAuth setup and session helpers |
| `guard.ts` | Page/module guards |
| `access.ts`, `access-db.ts` | Module access checks |
| `audit.ts`, `audit-db.ts`, `audit-export.ts` | Audit logging and export helpers |
| `admin-navigation.ts` | Dashboard navigation grouping |
| `short-code.ts` | Base62 short-code generation and validation |
| `servicem8/client.ts` | Shared ServiceM8 REST client |
| `storage/*` | Local/R2 storage abstraction |

## ServiceM8 client

Source path: `apps/web/lib/servicem8/client.ts`.

The client centralises `X-API-Key` authentication and `api_1.0` base URL handling. It exposes helpers for job quote metadata, quote attachment PDF download, polling for quote attachment creation, job UUID resolution, and raw attachment download.

The injectable request type keeps modules and scripts unit-testable without real ServiceM8 calls.

## Scripts

Most operational scripts live in `apps/web/scripts` and are exposed through root scripts:

| Root command | Script |
|--------------|--------|
| `pnpm seed` | `apps/web/scripts/seed.ts` |
| `pnpm seed:ps-generator` | `apps/web/scripts/seed-ps-generator-config-v1.ts` |
| `pnpm quote:pull` | `apps/web/scripts/quote-pull-test.ts` |
| `pnpm quote:preview` | `apps/web/scripts/quote-preview.ts` |
| `pnpm quote:share` | `apps/web/scripts/quote-share.ts` |
| `pnpm quote:create` | `apps/web/scripts/create-tracked-quote-test.ts` |
| `pnpm servicem8:webhook:register` | `apps/web/scripts/register-servicem8-attachment-webhook.ts` |
| `pnpm quotes:client-backfill` | `apps/web/scripts/quote-client-link-backfill.ts` |
| `pnpm clients:merge-cleanup` | `apps/web/scripts/client-merge-cleanup.ts` |

Root-level `scripts/migrate-prod.mjs` runs production migrations from `DB_URL_PROD`.

## Security and privacy boundaries

- App authentication uses NextAuth credentials and JWT sessions.
- Admins manage users, module grants, settings, imports, exports, and merge review.
- Staff access is module-grant based and should be checked again in server actions.
- Quote PDFs live in R2 and should not be exposed as raw bucket URLs.
- Public viewer routes are intentionally limited to quote viewing, tracking, and privacy notice surfaces.
- Raw quote-event IP addresses are purged by the cleanup worker; audit logs are archived after their retention window.
- Secrets are split between Vercel env vars, `.env.local` for local work, and Cloudflare Worker secrets. See [security.md](security.md).

## Testing

Test layers:

- Root workspace guardrails: `tests/**/*.test.ts`, run by `pnpm test:workspace`.
- Web app unit tests: `apps/web/**/__tests__`, run by `pnpm --filter @rgtools/web test:run`.
- Web integration tests: `apps/web/tests/integration`.
- Web e2e tests: `apps/web/tests/e2e`.
- Worker tests live under worker packages where present.

The root `pnpm test` command runs workspace guardrails and then the web app test run.
