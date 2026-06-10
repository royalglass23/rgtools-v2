# ROY-6 — Add Admin menu with sub-navigation to rgtools

> Agent brief. Read this entire file before writing any code.

## Context

- **rgtools** (this repo): Next.js 15 App Router + Drizzle + Neon + NextAuth + Vitest. Internal ops tool for Royal Glass.
- The dashboard nav lives in `app/(dashboard)/layout.tsx`. Module links are **DB-driven**: `getAccessibleModules(session.user.id)` from `lib/access-db.ts` returns `{ id, slug, name }` rows per user, rendered as flat top-nav links.
- An admin page already exists at `app/(dashboard)/admin/page.tsx` — user management (create users, roles) using components in `modules/admin/` (`CreateUserForm.tsx`, `UserRow.tsx`, `actions.ts`).
- Sessions expose `session.user.role` (`'admin'` visible in the layout already).

## Objective

Add an "Admin" menu to the dashboard nav, visible only to admins, with three sub-items:

1. **Administration** — the existing user-management page, relocated
2. **Lead Scoring** — placeholder page (real UI is issue ROY-7)
3. **Cost Calculator Price** — placeholder page (real UI is issue ROY-8)

## Decision required — ASK BEFORE STARTING

The nav is DB-driven via `getAccessibleModules`, but the Admin menu could instead be hardcoded for the admin role. **Stop and ask the human which approach to use:**

- **Option A (recommended): hardcoded admin dropdown.** Admin items are role-gated, not per-user-permission-gated. Simpler, no DB rows, no migration. Render the dropdown when `session.user.role === 'admin'`.
- **Option B: module rows in the access system.** Consistent with existing nav, allows per-user granularity later, but requires inserting module rows + access grants and possibly schema/seed changes.

Do not proceed past this decision without an answer.

## Execution plan (after the decision)

1. Read `lib/access-db.ts`, `lib/access.ts`, `lib/guard.ts`, and `app/(dashboard)/admin/page.tsx` to learn the existing guard pattern. Follow it exactly — do not invent a new authorization helper.
2. Routes:
   - `app/(dashboard)/admin/page.tsx` → keep as Administration (user management), or move to `app/(dashboard)/admin/administration/page.tsx` with a redirect from `/admin` — prefer whichever keeps existing links working.
   - `app/(dashboard)/admin/lead-scoring/page.tsx` → placeholder: page title + "Coming soon" + the same admin guard.
   - `app/(dashboard)/admin/calculator-pricing/page.tsx` → same placeholder pattern.
3. Nav in `app/(dashboard)/layout.tsx`: Admin menu with the three sub-links. Keep the existing visual language (dark `#142B3A` navbar, `text-slate-100/85` links). A simple hover/click dropdown is fine; no new dependencies — use plain React/CSS, this layout is a server component so prefer a CSS-only dropdown or a small client component.
4. **Server-side guards on every new route.** UI hiding is not access control. Every admin page must verify the admin role server-side (copy the existing admin page's guard).
5. Tests: follow the existing test patterns (`modules/admin/__tests__/`, vitest). At minimum: non-admin is denied on each new route; admin passes.

## Hard guardrails

- No new npm dependencies.
- Tailwind is used in THIS repo (rgtools) — that's fine here. (The opposite rule applies only in the cost-calculator repo.)
- Do not change `getAccessibleModules` behavior for existing modules.
- Do not touch anything outside: `app/(dashboard)/layout.tsx`, `app/(dashboard)/admin/**`, and (only if Option B chosen) the access-db seed/schema files.
- Do not run `npm run db:migrate` without asking (live DB risk) — only relevant if Option B.
- Branch: `roy-6-admin-menu`. Never commit to `main`.

## Stop and ask when

- The Option A/B decision (mandatory, see above).
- Existing tests fail before you start, or fail after your change in files you didn't touch.
- Moving the existing admin page would break any inbound link/redirect you can't preserve.
- The session object doesn't expose role where you need it.

## Human-only steps

- None expected. If Option B is chosen, applying the DB migration/seed to production is human-only.

## Definition of done

- Admin sees the Admin menu with 3 working sub-items; non-admin sees nothing and gets denied server-side on direct URL access.
- `npm run test:run`, `npm run lint`, `npx tsc --noEmit` all pass.
- One commit per logical step; final report lists commits and any concerns.
