# Developer Setup

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | Use nvm, fnm, or the project-standard Node manager |
| pnpm | 11+ | `npm i -g pnpm` |
| Neon account | - | Free tier is enough for development |
| Google Maps API key | - | Needs Places API and Distance Matrix API enabled |

## Clone and install

```bash
git clone <repo-url>
cd rgtools
pnpm install
```

This repo is a pnpm workspace:

- `apps/web` - the internal RG Tools Next.js app.
- `apps/catalog` - placeholder public catalog app.
- `packages/db` - shared Drizzle schema and database client.
- `workers/*` - Cloudflare Workers deployed separately from the apps.

Run common commands from the repo root. Root scripts delegate to the right package with pnpm filters.

## Environment variables

Copy `.env.example` to `.env.local` and fill in all values. The shared DB client can load `.env.local` from the workspace root even when code runs inside `apps/web`.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL pooled connection string |
| `AUTH_SECRET` | Yes | Random secret for NextAuth JWT signing |
| `AUTH_URL` | Local only | Usually `http://localhost:3000`; do not upload this as a global Vercel value |
| `AUTH_TRUST_HOST` | Vercel | Set to `true` for deployed environments |
| `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` | Yes | Browser key restricted to Places API |
| `GOOGLE_MAPS_SERVER_KEY` | Yes | Server key restricted to Distance Matrix API |
| `SMTP_HOST` | Yes | SMTP server hostname |
| `SMTP_PORT` | Yes | SMTP port, typically `587` or `465` |
| `SMTP_SECURE` | No | Set to `true` to force TLS |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_FROM` | Yes | From address for outbound emails |
| `SERVICEM8_INBOX_EMAIL` | Yes | Comma-separated inbox recipients |
| `SERVICEM8_API_KEY` | Yes | ServiceM8 API key for lead and quote workflows |
| `SERVICEM8_LEAD_QUALITY_FIELD` | Yes | ServiceM8 custom field UUID for lead quality |
| `SERVICEM8_SYNC_SECRET` | Yes | Bearer secret for the ServiceM8 retry endpoint |
| `CALCULATOR_ALLOWED_ORIGIN` | Yes | Exact browser origin allowed to POST calculator leads |
| `TURNSTILE_SECRET` | Production | Cloudflare Turnstile siteverify secret |
| `RESEND_API_KEY` | Production | Resend API key |
| `RESEND_FROM` | Production | Verified sender, e.g. `Royal Glass <support@royalglass.co.nz>` |

The calculator submit path uses Neon directly. In production, use Neon's pooled connection string for `DATABASE_URL`.

## Google Maps API keys

Use two separate keys:

1. `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` - loaded in the browser for Places autocomplete. Restrict this key to app domains and the Places API.
2. `GOOGLE_MAPS_SERVER_KEY` - used server-side for Distance Matrix calls. Restrict this key to server IP ranges and the Distance Matrix API.

## Database setup

Drizzle Kit runs from the repo root and reads schemas from `packages/db/src`.

```bash
pnpm db:migrate
pnpm db:studio
```

To migrate production without changing `.env.local`, set `DB_URL_PROD` to the production Neon pooled URL and run:

```bash
pnpm db:migrate:prod
```

## Seed data

Seed the initial admin user and module rows:

```bash
pnpm seed
```

This runs `apps/web/scripts/seed.ts`, creates/updates the protected `rgadmin` account, and upserts active module rows including `ps-generator` and `ps-generator/configuration`.

Seed PS Generator configuration:

```bash
pnpm seed:ps-generator
```

This inserts the published `wordpress-plugin-v1` PS Generator configuration. Generated PDFs also require the referenced fillable PDF templates to exist in storage under `templates/ps-generator/...`.

Seed scoring config when a scoring version changes:

```bash
pnpm --dir apps/web tsx scripts/seed-scoring-config-v3.ts
```

## Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Log in with a seeded user or an account created in the admin panel.

## Quote pipeline scripts

All quote scripts run from the repo root and require `SERVICEM8_API_KEY`.

```bash
pnpm quote:pull --job 123
pnpm quote:pull --uuid <jobUuid>
pnpm quote:pull --latest

pnpm quote:preview --job 123
pnpm quote:preview --latest --port 4321

pnpm quote:share --job 123
pnpm quote:create --job 123
```

The quote PDF must exist as a `QUOTE`-source attachment on the ServiceM8 job before these scripts can pull it.

## Run tests

```bash
pnpm test             # workspace tests, then web app test run
pnpm test:workspace   # root workspace guardrail tests only
pnpm --filter @rgtools/web test:run
pnpm test:integration # live DB integration tests
pnpm test:e2e         # Playwright e2e tests
```

Tests live in:

- `tests/` - root workspace and script tests.
- `apps/web/lib/__tests__/` - auth, access control, DB integration tests.
- `apps/web/__tests__/` - proxy/auth tests.
- `apps/web/modules/` - module-level tests.
- `apps/web/tests/integration/` - live DB integration tests.
- `apps/web/tests/e2e/` - Playwright e2e tests.
- `workers/*/src/__tests__/` - worker tests where present.

## Generate a migration

After changing a schema file under `packages/db/src`:

```bash
pnpm db:generate
pnpm db:migrate
```

Generated SQL is written to `drizzle/migrations/`.
