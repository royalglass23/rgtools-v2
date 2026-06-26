# rgtools

Internal operations toolkit for Royal Glass, covering lead intake and scoring, quote pipeline tracking, quote engagement analytics, and Producer Statement generation.

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
| **Leads** | Paginated lead list and detail view with tier, SM8, and date filters |
| **Quote Tracker** | Pull a ServiceM8 quote into a tracked short link, share it, and see how clients engage |
| **PS Generator** | Generate PS1 and PS3 Producer Statement PDF packages from published system, option, template, mapping, and wording configuration |

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **Tailwind CSS 4**
- **pnpm workspace** for apps, workers, and shared packages
- **Drizzle ORM** + **Neon PostgreSQL** (serverless)
- **NextAuth v5** - credential-based auth, JWT sessions, admin/staff roles
- **Google Maps** - Places autocomplete + Distance Matrix
- **Cloudflare Workers + R2** - `rg-viewer`, `rg-tracker`, `rg-notifier`, and `rg-cleanup`
- **Resend** - transactional email
- **Vitest** and **Playwright** - unit, integration, workspace, and e2e tests

## Developer docs

- [Local setup](docs/dev/setup.md) - prerequisites, env vars, DB migration, seeding, testing
- [Architecture](docs/dev/architecture.md) - system design, modules, auth, scoring engine
- [Deployment](docs/dev/deployment.md) - Vercel + Cloudflare Worker deployment
- [Quote tracking privacy note](docs/dev/quote-tracking.md) - what is collected, retention, access

## User docs

- [Getting started](docs/user/getting-started.md) - login, dashboard, roles
- [Lead intake form](docs/how-to/lead-intake.md) - field-by-field guide
- [Leads dashboard](docs/how-to/leads.md) - list, filters, detail view, ServiceM8 fetch
- [Scoring guide](docs/user/scoring-guide.md) - categories, tiers A-D, strike flags
- [Quote Tracker how-to](docs/how-to/quotes.md) - create tracked quotes, share links, read engagement, troubleshooting
- [PS Generator how-to](docs/how-to/ps-generator.md) - generate PS packages, understand configuration, and seed prerequisites

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## Quick start (dev)

```bash
pnpm install
cp .env.example .env.local   # fill in values - see docs/dev/setup.md
pnpm db:migrate
pnpm seed                    # creates initial admin user and module rows
pnpm seed:ps-generator       # seeds published PS Generator config
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
pnpm quote:create --job R260210 # create a tracked quote in the DB
```

## Tests

```bash
pnpm test             # workspace tests, then web app test run
pnpm test:run         # alias for the full test command
pnpm test:workspace   # root workspace guardrail tests only
pnpm test:integration # live DB integration tests
pnpm test:e2e         # Playwright e2e tests
```
