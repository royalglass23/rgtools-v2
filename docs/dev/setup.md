# Developer Setup

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) |
| pnpm | 9+ | `npm i -g pnpm` |
| Neon account | — | [neon.tech](https://neon.tech) — free tier is enough for dev |
| Google Maps API key | — | Needs Places API + Distance Matrix API enabled (see below) |

## Clone and install

```bash
git clone <repo-url>
cd rgtools
pnpm install
```

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
| `SERVICEM8_API_KEY` | No | ServiceM8 API key (reserved for future direct API integration) |
| `SERVICEM8_SYNC_SECRET` | No | Shared secret for ServiceM8 webhook verification |
| `SERVICEM8_LEAD_QUALITY_FIELD` | No | Custom field UUID in ServiceM8 to write lead tier into |

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

## Seed the scoring config

Scoring rules are stored in the `scoring_config_versions` table. Seed the current v3 config:

```bash
pnpm tsx scripts/seed-scoring-config-v3.ts
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

## Run tests

```bash
pnpm test          # Vitest in watch mode
pnpm test:run      # Single run (for CI)
```

Tests live in:
- `lib/__tests__/` — auth, access control, DB integration tests
- `__tests__/` — middleware tests
- `modules/` — module-level tests (where present)
- `workers/tracker/src/__tests__/` — tracker worker payload validation

Integration tests hit a real database. Set `DATABASE_URL` in your environment before running them.

## Generate a new migration

After changing `drizzle/schema.ts` or `drizzle/schema-leads.ts`:

```bash
pnpm db:generate   # generates a new SQL file in drizzle/migrations/
pnpm db:migrate    # applies it
```
