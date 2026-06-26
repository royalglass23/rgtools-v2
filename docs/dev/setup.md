# Developer Setup

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) |
| pnpm | 11+ | `npm i -g pnpm` |
| Neon account | — | [neon.tech](https://neon.tech) — free tier is enough for dev |
| Google Maps API key | — | Needs Places API + Distance Matrix API enabled (see below) |

## Clone and install

```bash
git clone <repo-url>
cd rgtools
pnpm install
```

The repo is a pnpm workspace. The internal app lives in `apps/web`, the public
catalog placeholder lives in `apps/catalog`, and shared Drizzle schema/client
code lives in `packages/db`.

## Environment variables

Copy `.env.example` to `.env.local` and fill in all values.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string (`postgresql://...`) |
| `AUTH_SECRET` | Yes | Random secret for NextAuth JWT signing — generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` | Yes | Google Maps API key with **Places API** enabled (client-side, exposed to browser) |
| `GOOGLE_MAPS_SERVER_KEY` | Yes | Google Maps API key with **Distance Matrix API** enabled (server-side only) |
| `SMTP_HOST` | Yes | SMTP server hostname |
| `SMTP_PORT` | Yes | SMTP port — typically `587` (STARTTLS) or `465` (SSL) |
| `SMTP_SECURE` | No | Set to `true` to force TLS; auto-detected as `true` if `SMTP_PORT=465` |
| `SMTP_USER` | No | SMTP username (omit if server does not require auth) |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_FROM` | Yes | From address for outbound emails, e.g. `noreply@royalglass.co.nz` |
| `SERVICEM8_INBOX_EMAIL` | Yes | Comma-separated email address(es) that receive ServiceM8 inbox submissions |
| `SERVICEM8_API_KEY` | Yes | ServiceM8 API key — used by the "Fetch from ServiceM8" button to search jobs and update the Leads Quality custom field |
| `SERVICEM8_LEAD_QUALITY_FIELD` | Yes | UUID of the ServiceM8 custom field to write the lead tier into (e.g. "Leads Quality A") — find it in ServiceM8 → Settings → Custom Fields |

> **ServiceM8 MCP server:** the official OAuth MCP server (`go.servicem8.com/mcp`)
> is wired in via [`.mcp.json`](../../.mcp.json) for ad-hoc job/client lookups in
> Claude Code — no API key needed (OAuth). See
> [servicem8-mcp.md](./servicem8-mcp.md) for setup and its (narrow) tool list, and
> [servicem8-sync-architecture.md](./servicem8-sync-architecture.md) for the REST→DB sync that the
> roadmap features are built on.

Calculator submit and customer estimate email:

| Variable | Required | Description |
|----------|----------|-------------|
| `SERVICEM8_SYNC_SECRET` | Yes | Bearer secret for the ServiceM8 retry endpoint |
| `CALCULATOR_ALLOWED_ORIGIN` | Yes | Exact browser origin allowed to POST calculator leads, e.g. `https://www.royalglass.co.nz` |
| `TURNSTILE_SECRET` | Production | Cloudflare Turnstile siteverify secret. If unset, verification is skipped for local/dev |
| `RESEND_API_KEY` | Production | Resend API key for customer estimate emails |
| `RESEND_FROM` | Production | Verified sender, e.g. `Royal Glass <support@royalglass.co.nz>` |

The calculator submit path uses the Neon database directly. In production, use Neon's pooled connection string for `DATABASE_URL`.

### Google Maps API keys

Two separate keys are used to limit exposure:

1. **`NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`** — loaded in the browser for Places autocomplete. Restrict this key in the Google Cloud Console to your app's domain(s) and to the **Places API** only.
2. **`GOOGLE_MAPS_SERVER_KEY`** — used server-side only for Distance Matrix calls. Restrict to server IP ranges and the **Distance Matrix API**.

## Database setup

The database is managed with Drizzle Kit. After setting `DATABASE_URL`:

```bash
# Apply all pending migrations
pnpm db:migrate

# (Optional) Open Drizzle Studio to browse the DB
pnpm db:studio
```

To migrate production without changing `.env.local`, set `DB_URL_PROD` to the
production Neon pooled URL and run:

```bash
pnpm db:migrate:prod
```

## Seed the scoring config

Scoring rules are stored in the `scoring_config_versions` table. Seed the current v3 config:

```bash
pnpm --dir apps/web tsx scripts/seed-scoring-config-v3.ts
```

This deactivates any existing active config and inserts v3 as active.

## Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Log in with a user created via the seed script or the admin panel.

## Seed an initial admin user

```bash
pnpm seed
```

This runs `scripts/seed.ts`, which creates a default admin account. Check the script for the default credentials. **Change the seed password before sharing access to any shared or production environment.**

## Quote pipeline scripts

Three scripts for testing the quote delivery pipeline. All require `SERVICEM8_API_KEY` to be set.

```bash
# Pull job metadata + PDF to tmp/ (no server)
pnpm quote:pull --job 123
pnpm quote:pull --uuid <jobUuid>
pnpm quote:pull --latest

# Pull + serve a local viewer, open in browser
pnpm quote:preview --job 123
pnpm quote:preview --latest --port 4321

# Pull + serve + open a public Cloudflare quick-tunnel
pnpm quote:share --job 123
```

`quote:share` downloads `cloudflared.exe` (~50 MB) to `tmp/` on the first run. Press Ctrl+C to shut down the tunnel and server.

The PDF must exist as a `QUOTE`-source attachment on the ServiceM8 job. Finalise/send the quote in ServiceM8 first, then run the script.

## Run tests

```bash
pnpm test          # Vitest in watch mode
pnpm test:run      # Single run (for CI)
```

Tests live in:
- `apps/web/lib/__tests__/` - auth, access control, DB integration tests
- `apps/web/__tests__/` - middleware tests
- `apps/web/modules/` - module-level tests (where present)
- `tests/workspace-boundaries.test.ts` - workspace boundary guardrails
- `workers/tracker/src/__tests__/` - tracker worker payload validation

Integration tests hit a real database and are kept out of the default unit test
run. Set `DATABASE_URL` in your environment, then run `pnpm test:integration`.

## Generate a new migration

After changing `packages/db/src/schema.ts` or `packages/db/src/schema-leads.ts`:

```bash
pnpm db:generate   # generates a new SQL file in drizzle/migrations/
pnpm db:migrate    # applies it
```
