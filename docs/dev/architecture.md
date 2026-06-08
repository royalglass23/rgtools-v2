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

ServiceM8 is the field-service management system. rgtools sends new leads to ServiceM8 via SMTP to the ServiceM8 inbox address. The flow:

1. `submitLeadIntake` completes lead creation and scoring
2. `markLeadPendingServiceM8Sync` sets `sync_status = 'pending_sync'`
3. `syncLeadToServiceM8` builds an email payload and sends via nodemailer
4. On success: `sync_status = 'synced'`, `servicem8_job_uuid` is written
5. On failure: `sync_status = 'sync_failed'`, error stored in `sync_error`
6. A retry endpoint exists at `POST /api/lead-intake/servicem8/retry`
