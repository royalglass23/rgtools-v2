# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Workflow: planning vs execution (mandatory)

This repo splits **planning** from **execution**. Claude Code plans; Codex executes. Do not blur these roles unless the user explicitly asks Claude Code to implement.

Claude Code's default job:

1. Brainstorm and produce a plan.
2. Create a Linear ticket in the `rgtools` project.
3. Write a Codex execution brief in `docs/codex/<module>/`.
4. Hand execution to Codex.

Every Codex brief must contain numbered checkpoints, verification commands and expected outcomes per checkpoint, the Linear ticket reference, and explicit scope boundaries.

## Commands

Run commands from the repo root unless noted.

```bash
pnpm dev              # @rgtools/web dev server at localhost:3000
pnpm build            # Build web and catalog workspace apps
pnpm lint             # Lint web and catalog workspace apps
pnpm test             # Workspace guardrails, then web app test run
pnpm test:workspace   # Root workspace guardrail tests only
pnpm test:integration # Web live DB integration tests
pnpm test:e2e         # Web Playwright tests

pnpm db:generate      # Generate migration from packages/db schema changes
pnpm db:migrate       # Apply pending migrations
pnpm db:migrate:prod  # Apply production migrations from DB_URL_PROD
pnpm db:studio        # Browse DB in Drizzle Studio

pnpm seed             # Create/update admin user and module rows
pnpm seed:ps-generator # Seed published PS Generator config
pnpm --dir apps/web tsx scripts/seed-scoring-config-v4.ts

pnpm quote:pull --latest
pnpm quote:preview --latest
pnpm quote:create --job R260210
```

Run a single web test file:

```bash
pnpm --filter @rgtools/web test:run -- modules/lead-intake/__tests__/actions.test.ts
```

## Architecture

### Workspace

| Path | Purpose |
|------|---------|
| `apps/web` | Internal RG Tools Next.js app |
| `apps/catalog` | Placeholder public catalog app |
| `packages/db` | Shared Drizzle schema and database client |
| `workers/*` | Cloudflare Workers deployed separately |

### Next.js app

`apps/web/app/` contains routes. Business logic lives in `apps/web/modules/`, grouped by domain:

| Module | Description |
|--------|-------------|
| `lead-intake` | Staff intake form, scoring engine, ServiceM8 sync, anti-spam |
| `leads` | Paginated lead list/detail, ServiceM8 job fetch, AI suggestion |
| `clients` | Client records, dedupe, and merge review |
| `quote-tracker` | Tracked quote creation, short links, engagement analytics |
| `ps-generator` | PS1/PS3 Producer Statement generation from published config |
| `dashboard` | KPI aggregates and configurable tables |
| `admin` | User management, module grants, scoring/config settings |

`apps/web/lib/` contains shared app infrastructure: auth, guards, access, audit, admin navigation, ServiceM8 REST client, short codes, storage adapters, and the app DB re-export.

### Database

Schema files live in `packages/db/src`:

- `schema.ts` - auth, modules, quotes, quote events, settings, audit/error logs.
- `schema-leads.ts` - clients, leads, scoring, calculator submit, lead email logs.
- `schema-ps-generator.ts` - PS Generator config, generation events, generated PDFs, audit, migration records.

After any schema change, run `pnpm db:generate` and `pnpm db:migrate`.

### Auth and access

NextAuth v5 uses credential login and JWT sessions. Route protection is in `apps/web/proxy.ts`, dashboard layout checks, and module guards in `apps/web/lib/guard.ts`.

Module access is grant-based: admins always have access; staff need explicit grants in `user_module_access`.

### Cloudflare Workers

| Worker | Role |
|--------|------|
| `viewer` | Public PDF.js viewer with optional email gate |
| `tracker` | Engagement beacon endpoint |
| `notifier` | Cron for open/high-intent email alerts |
| `cleanup` | Cron for quote expiry cleanup and IP purge |

### Path aliases

Inside `apps/web`, `@/*` maps to the app package. `@rgtools/db` maps to `packages/db/src`.

## Documentation

Docs live under `docs/`, split by audience:

| Folder | What goes here |
|--------|----------------|
| `docs/dev/` | Technical/system documentation |
| `docs/how-to/` | Staff-facing task tutorials |
| `docs/user/` | Non-technical concepts and reference |
| `docs/codex/` | Local Codex execution briefs; gitignored |
| `docs/superpowers/` | Local plans and design specs; gitignored |

When a feature ships, update the relevant how-to/dev/user docs, `README.md`, and `CHANGELOG.md`.
