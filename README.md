# rgtools

Internal operations toolkit for Royal Glass — covering lead intake and scoring, quote pipeline tracking, and quote engagement analytics.

## Workspace layout

This repo is a pnpm workspace:

- `apps/web` - the internal RG Tools Next.js app.
- `apps/catalog` - placeholder public catalog app for `catalog.royalglass.co.nz`.
- `packages/db` - shared Drizzle schema and database client.
- `workers/*` - Cloudflare Workers deployed separately from the apps.

## What it does

| Module | Description |
|--------|-------------|
| **Dashboard** | KPI overview for active tracked quotes, plus configurable operational tables |
| **Lead Intake** | Staff form to capture and score inbound enquiries, auto-syncs to ServiceM8 |
| **Leads** | Paginated lead list and detail view — filter by tier/SM8/date, manual ServiceM8 job fetch |
| **Quote Tracker** | Pull a ServiceM8 quote into a tracked short link, share it, and see how clients engage (opens, scroll, time, forwarding) — with an optional email gate and open notifications |

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **Tailwind CSS 4**
- **Drizzle ORM** + **Neon PostgreSQL** (serverless)
- **NextAuth v5** — credential-based auth, JWT sessions, admin/staff roles
- **Google Maps** — Places autocomplete + Distance Matrix
- **Cloudflare Workers + R2** — `rg-viewer` (PDF.js viewer + email gate), `rg-tracker` (beacon endpoint), `rg-notifier` (open/high-intent emails, cron), `rg-cleanup` (expiry + IP purge, cron)
- **Resend** — transactional email (customer estimates, quote-open notifications)
- **Vitest** — unit and integration tests

## Developer docs

- [Local setup](docs/dev/setup.md) — prerequisites, env vars, DB migration, seeding, testing
- [Architecture](docs/dev/architecture.md) — system design, modules, auth, scoring engine
- [Deployment](docs/dev/deployment.md) — Vercel + Cloudflare Worker

## User docs

- [Getting started](docs/user/getting-started.md) — login, dashboard, roles
- [Lead intake form](docs/how-to/lead-intake.md) — field-by-field guide
- [Leads dashboard](docs/how-to/leads.md) — list, filters, detail view, ServiceM8 fetch
- [Scoring guide](docs/user/scoring-guide.md) — categories, tiers A–D, strike flags
- [Quote Tracker how-to](docs/how-to/quotes.md) — create tracked quotes, share links, read engagement, troubleshooting
- [Quote tracking privacy note](docs/dev/quote-tracking.md) — what is collected, retention, access (internal engineering note)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## Quick start (dev)

```bash
pnpm install
cp .env.example .env.local   # fill in values — see docs/dev/setup.md
pnpm db:migrate
pnpm seed                    # creates initial admin user
pnpm --dir apps/web tsx scripts/seed-scoring-config-v3.ts
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

For a one-off production migration without changing `.env.local`, set `DB_URL_PROD`
to the production Neon pooled URL and run:

```bash
pnpm db:migrate:prod
```

## Quote pipeline scripts

```bash
pnpm quote:pull --latest        # pull metadata + PDF from ServiceM8 to tmp/
pnpm quote:preview --latest     # local viewer in browser
pnpm quote:share --latest       # public Cloudflare tunnel link
pnpm quote:create --job R260210 # create a tracked quote in the DB (mints short link)
```

## Tests

```bash
pnpm test          # watch mode
pnpm test:run      # single run (CI)
pnpm test:integration # live DB integration tests
pnpm test:e2e      # Playwright e2e tests
```
