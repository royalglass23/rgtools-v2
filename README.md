# rgtools

Internal operations toolkit for Royal Glass — covering lead intake and scoring, quote pipeline tracking, and quote engagement analytics.

## What it does

| Module | Description |
|--------|-------------|
| **Dashboard** | KPI overview — pipeline value, open quotes, hot leads, win rate, urgent actions |
| **Lead Intake** | Staff form to capture and score inbound enquiries, auto-syncs to ServiceM8 |
| **Leads** | Paginated lead list and detail view — filter by tier/SM8/date, manual ServiceM8 job fetch |
| **Quote Tracker** | Cloudflare Worker that records how clients interact with sent quotes |

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **Tailwind CSS 4**
- **Drizzle ORM** + **Neon PostgreSQL** (serverless)
- **NextAuth v5** — credential-based auth, JWT sessions, admin/staff roles
- **Google Maps** — Places autocomplete + Distance Matrix
- **Cloudflare Workers** — `rg-tracker` beacon endpoint
- **Vitest** — unit and integration tests

## Developer docs

- [Local setup](docs/dev/setup.md) — prerequisites, env vars, DB migration, seeding, testing
- [Architecture](docs/dev/architecture.md) — system design, modules, auth, scoring engine
- [Deployment](docs/dev/deployment.md) — Vercel + Cloudflare Worker

## User docs

- [Getting started](docs/user/getting-started.md) — login, dashboard, roles
- [Lead intake form](docs/user/lead-intake.md) — field-by-field guide
- [Leads dashboard](docs/user/leads.md) — list, filters, detail view, ServiceM8 fetch
- [Scoring guide](docs/user/scoring-guide.md) — categories, tiers A–D, strike flags

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## Quick start (dev)

```bash
pnpm install
cp .env.example .env.local   # fill in values — see docs/dev/setup.md
pnpm db:migrate
pnpm seed                    # creates initial admin user
pnpm tsx scripts/seed-scoring-config-v3.ts
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quote pipeline scripts

```bash
pnpm quote:pull --latest        # pull metadata + PDF from ServiceM8 to tmp/
pnpm quote:preview --latest     # local viewer in browser
pnpm quote:share --latest       # public Cloudflare tunnel link
```

## Tests

```bash
pnpm test          # watch mode
pnpm test:run      # single run (CI)
```
