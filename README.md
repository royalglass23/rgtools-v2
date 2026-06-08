# rgtools

Internal operations toolkit for Royal Glass — covering lead intake and scoring, quote pipeline tracking, and quote engagement analytics.

## What it does

| Module | Description |
|--------|-------------|
| **Dashboard** | KPI overview — pipeline value, open quotes, hot leads, win rate, urgent actions |
| **Lead Intake** | Staff form to capture and score inbound enquiries, auto-syncs to ServiceM8 |
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
- [Scoring guide](docs/user/scoring-guide.md) — categories, tiers A–D, strike flags

## Quick start (dev)

```bash
pnpm install
cp .env.example .env.local   # fill in values — see docs/dev/setup.md
pnpm db:migrate
pnpm tsx scripts/seed-scoring-config-v3.ts
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tests

```bash
pnpm test          # watch mode
pnpm test:run      # single run (CI)
```
