# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow: planning vs execution (MANDATORY)

This repo splits **planning** from **execution**. Claude Code plans; Codex executes. Do not
blur these roles.

**Claude Code's job — plan, do NOT write feature code:**
1. Brainstorm and produce a plan (design in `docs/superpowers/specs/`, implementation steps).
2. Create a **Linear ticket** in the **rgtools** project (Linear `MT-<nn>`). The ticket is the
   source of truth for scope and acceptance criteria.
3. Write a **Codex execution brief** in `docs/codex/<module>/` (naming: `YYYY-MM-DD-MT<nn>-short-title.md`)
   and hand execution to Codex.

Claude Code only writes code itself when the user **explicitly** says so (e.g. "you do it",
"skip Codex"). Otherwise: plan, ticket, brief — then stop.

**Every Codex brief MUST contain, with no exceptions:**
- **Step-by-step instructions broken into numbered checkpoints.** Each checkpoint is a small,
  independently verifiable unit of work — not "build the feature."
- **A verification block per checkpoint AND at the end:** the exact command(s) to run
  (`pnpm test:run …`, `pnpm lint`, `pnpm build`, manual steps) and the **expected outcome**
  (what passing looks like). A checkpoint is not "done" until its test passes.
- **The Linear ticket reference** (`MT-<nn>`) and a link back to the spec.
- Explicit scope boundaries: files Codex may touch, and what it must NOT change.

If a brief lacks numbered checkpoints or per-checkpoint test instructions, it is incomplete —
do not hand it off.

## Commands

```bash
pnpm dev              # Next.js dev server at localhost:3000
pnpm build            # Production build
pnpm lint             # ESLint
pnpm test             # Vitest watch mode
pnpm test:run         # Vitest single run (CI)

pnpm db:generate      # Generate migration from schema changes
pnpm db:migrate       # Apply pending migrations
pnpm db:studio        # Browse DB in Drizzle Studio

pnpm seed             # Create initial admin user
pnpm tsx scripts/seed-scoring-config-v4.ts  # Seed lead-scoring rules (required after fresh DB)

# Quote pipeline (requires SERVICEM8_API_KEY)
pnpm quote:pull --latest
pnpm quote:preview --latest
pnpm quote:create --job R260210
```

Run a single test file: `pnpm test:run lib/__tests__/access.test.ts`

Workers are excluded from the root Vitest config — run their tests separately inside `workers/<name>/`.

## Architecture

### Next.js App (App Router)

`app/` — routes only; no business logic lives here.  
`modules/` — all feature code (actions, queries, components, utils) co-located by domain:

| Module | Description |
|--------|-------------|
| `lead-intake` | Staff intake form, scoring engine, ServiceM8 sync, anti-spam |
| `leads` | Paginated lead list/detail, ServiceM8 job fetch, AI tier suggestion |
| `quote-tracker` | Tracked quote creation, short links, engagement analytics |
| `dashboard` | KPI aggregates |
| `admin` | User management, module grants, scoring config |

`lib/` — shared infrastructure: `db.ts` (Drizzle client), `auth.ts` (NextAuth config), `access.ts` (pure access-control functions), `guard.ts` (Server Action auth guards), `servicem8/` (REST client), `storage/` (R2 + local adapters).

### Database

Two schema files:
- `drizzle/schema.ts` — quotes, users, sessions, events, modules, module grants
- `drizzle/schema-leads.ts` — leads, scoring config versions, scoring results

Both are imported together in `lib/db.ts`. After any schema change, run `db:generate` then `db:migrate`.

### Auth & Access Control

NextAuth v5 with credential provider + JWT sessions (4h). Two roles: `admin` and `staff`.

Module access is grant-based: admins always have access; staff need explicit grants stored in `module_grants`. `lib/access.ts` contains pure functions (no DB) for access decisions — used in `lib/guard.ts` to protect Server Actions.

### Cloudflare Workers

Four workers in `workers/` (deployed separately via Wrangler):

| Worker | Role |
|--------|------|
| `viewer` | PDF.js viewer with optional email gate (R2-served PDF) |
| `tracker` | Beacon endpoint — receives engagement events, writes to DB via REST |
| `notifier` | Cron — sends open/high-intent email alerts via Resend |
| `cleanup` | Cron — expires old quotes, purges IP data |

Workers communicate with the Next.js app's `/api` routes over HTTPS, not directly with the DB.

### Lead Scoring

Rules are stored in `scoring_config_versions` (active config fetched at runtime). The engine lives in `modules/lead-intake/scoring/`. Tiers A–D are computed from weighted category scores; strike flags can downgrade or reject a lead.

### Key env vars

`DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`, `GOOGLE_MAPS_SERVER_KEY`, `SERVICEM8_API_KEY`, `SERVICEM8_LEAD_QUALITY_FIELD`, `SERVICEM8_SYNC_SECRET`, `RESEND_API_KEY`, `CALCULATOR_ALLOWED_ORIGIN`. See `docs/dev/setup.md` for the full list.

### Path alias

`@` maps to the repo root — use `@/lib/db` not relative paths across module boundaries.

## Documentation

Docs live under `docs/`, split by audience and purpose. Put new docs in the right folder:

| Folder | What goes here | Naming / notes |
|--------|----------------|----------------|
| `docs/codex/` | Codex execution briefs (strict task specs handed to an agent) | `YYYY-MM-DD-MT<nn>-short-title.md` (e.g. `2026-06-19-MT-31-lead-bulk-import.md`). Group by module in a subfolder (`docs/codex/lead-intake/`, `docs/codex/quotes/`). **Gitignored — local only.** |
| `docs/superpowers/` | Plans & design specs (brainstorming output in `specs/`, implementation plans in `plans/`) | `YYYY-MM-DD-topic-design.md`. **Gitignored — local only.** |
| `docs/dev/` | Technical/system documentation — architecture, setup, deployment, integration internals | For developers building the system. |
| `docs/how-to/` | User-facing tutorials & step-by-step instructions (task-oriented: "how to do X") | Non-technical, written for staff. |
| `docs/user/` | Non-technical / business documentation — concepts, reference, what things mean | Overviews and reference, not step-by-step tasks. |

When a feature ships, it typically produces: a plan in `docs/superpowers/specs/`, a Codex brief
in `docs/codex/<module>/`, a tutorial in `docs/how-to/`, and (if it adds business concepts) a
reference page in `docs/user/`. Cross-link between docs with relative paths and keep `README.md`'s
doc index in sync. `docs/codex/` and `docs/superpowers/` are gitignored, so don't rely on them
being present in CI or for other contributors.
