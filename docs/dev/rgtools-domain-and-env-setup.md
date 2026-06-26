# rgtools.co.nz — Production Domain & Dev/Prod Environment Setup

**Status:** in progress (2026-06-24). Production domain wired; auth host fix applied;
database separation being finalised after a connection-string mix-up (see Incident Log).

This document records how we put the app live on **rgtools.co.nz** while keeping a separate
**dev** environment that never touches live data — the step-by-step process, the problems we
hit, and how we fixed them. Related: [dns-migration-cloudflare.md](dns-migration-cloudflare.md),
[deployment.md](deployment.md).

---

## 1. Objective

- **`rgtools.co.nz` = production (live).** Served from the `main` branch on Vercel.
- **`rgtools-delta.vercel.app` = dev.** Served from the `dev` branch (Vercel Preview).
- **Separate databases** so dev work can never read/write live customer data.

## 2. Target architecture

Three tiers, **two** databases — `local` and `dev` share the Neon `dev` branch; only
`production` is isolated with live data.

| Layer | Local | Dev | Production (live) |
|-------|-------|-----|-------------------|
| Runs via | `pnpm dev` | Vercel Preview | Vercel Production |
| Git branch | (working tree) | `dev` (and feature branches) | `main` |
| Domain / URL | `localhost:3000` | `rgtools-delta.vercel.app` | `www.rgtools.co.nz` (apex → 308 → www) |
| Database (Neon branch) | `dev` (shared) | `dev` (branch/copy of `production`) | `production` |
| `DATABASE_URL` source | `.env.local` (git-ignored) | Vercel Preview scope | Vercel Production scope |
| Auth host | `AUTH_URL=http://localhost:3000` (local only) | `AUTH_TRUST_HOST=true` | `AUTH_TRUST_HOST=true` |

**Local DB rule:** `.env.local`'s `DATABASE_URL` must be the **`dev` branch pooled** string —
**never** the `production` branch. Local and deployed-dev intentionally share the `dev` branch
(simplest; the only cost is both write the same non-live data). Verify with
`select username, role from users;` on the `dev` branch before pasting.

### 2.1 Confirmed Neon endpoints (no secrets — passwords live only in `.env.local`/Vercel)

Both branches use the **same database name `royal-glass`** — they are told apart **only by the
`ep-…` endpoint id**, never by the db name. This is the #1 source of confusion here.

| Tier | Pooled endpoint | Database |
|------|-----------------|----------|
| **production** (live) | `ep-cool-fire-a7ozruq0-pooler.ap-southeast-2.aws.neon.tech` | `royal-glass` |
| **dev** (local + Preview) | `ep-bitter-mouse-a7lj1vau-pooler.ap-southeast-2.aws.neon.tech` | `royal-glass` |

> **Neon branching gotcha:** a branch created *with data* copies everything that existed in
> prod **at branch-creation time**, so right after branching dev and prod look identical (same
> users/quotes). They are still independent — new writes do **not** cross. Verified 2026-06-24
> by creating a throwaway table on dev and confirming it does not appear on prod.
>
> `.env` comments use `#`, not `//` — dotenv parses `//FOO=` as a junk key, not a comment.

**Key idea:** one Vercel project, split by environment. Vercel automatically serves `main`
deployments as Production and other branches as Preview, and injects the matching
environment-scoped variables. We do **not** build a second project — we scope env vars.

## 3. Stack facts (so the steps make sense)

- **Hosting:** Vercel (Hobby plan), single project.
- **Database:** Neon Postgres, accessed via `@neondatabase/serverless` through `packages/db/src/client.ts` and `apps/web/lib/db.ts`.
  Requires the **pooled** connection string (host contains `-pooler`).
- **Auth:** NextAuth v5 (`apps/web/lib/auth.ts`), JWT sessions, credentials provider. Route
  protection is in `app/(dashboard)/layout.tsx` via `await auth()` → `redirect('/login')`
  (no `middleware.ts`).
- **Registrar:** 1st Domains. **DNS:** moved to Cloudflare (to match `royalglass.co.nz`).

---

## 4. Step-by-step

### Step 1 — Confirm the production branch in Vercel
- Vercel → Project → **Settings → Git**. Production branch should be `main`.
- Newer Vercel dashboards may not show a "Production Branch" selector. If the **Deploy Hook**
  defaults to `main`, then `main` is already production — nothing to change.

### Step 2 — Add the domain in Vercel
- Domains moved **out of Settings** in the new UI. Find it as a **top-level project tab**
  (`Project / Deployments / … / Domains`) or at the **team/account level → Domains**.
- Add `rgtools.co.nz` and `www.rgtools.co.nz`.
- Choose **Connect to an environment → Production**, and **Redirect apex → www**.
- Result: `www.rgtools.co.nz` → Production; `rgtools.co.nz` → 308 redirect → www.

### Step 3 — Get the DNS records from Vercel
Expand **Learn more / Edit** on the domain to reveal the exact records (values are
project-specific). For this project:

| Type | Name | Value |
|------|------|-------|
| `A` | `@` | `216.198.79.1` |
| `CNAME` | `www` | `cdc919e2aa46b64a.vercel-dns-017.com` |

> Vercel is migrating IP ranges. The older `A 76.76.21.21` / `CNAME cname.vercel-dns.com`
> still work, but use the new values shown in your dashboard.

### Step 4 — Point DNS
We chose **Cloudflare** for DNS (consistency with `royalglass.co.nz` + Workers).

1. Add `rgtools.co.nz` as a site in Cloudflare.
2. Set Cloudflare's two nameservers at **1st Domains** (replaces the parking/registrar NS).
3. In Cloudflare DNS add the records from Step 3.
4. **Set them to DNS-only (grey cloud), NOT proxied (orange).** Vercel manages its own SSL;
   proxying on top causes redirect loops / cert errors.

> 1st Domains starts with parking-page records (`A → 210.55.30.93`,
> `CNAME www → rgtools.co.nz`). Those get replaced by the Cloudflare nameserver switch
> (or, if staying at the registrar, edit those two records directly).

5. Back in Vercel → Domains → **Refresh**. "Invalid Configuration" → "Valid" within minutes
   to ~an hour; SSL auto-provisions.

### Step 5 — Fix the auth host (critical)
NextAuth must use the **incoming host**, not a hardcoded URL, or production bounces to the dev
URL. In Vercel → Settings → Environment Variables:

- **Add `AUTH_TRUST_HOST = true`** scoped to **all three** environments
  (Production, Preview, Development).
- **Ensure there is NO `AUTH_URL` / `NEXTAUTH_URL` pinned to a single host** (e.g.
  `https://rgtools-delta.vercel.app`). If present and global, it overrides trust-host and
  hijacks production. Either delete it, or scope `AUTH_URL = https://www.rgtools.co.nz` to
  **Production only**.
- `.env.local` on a dev machine may contain `AUTH_URL=http://localhost:3000` — that is
  **local-only**, never uploaded to Vercel, and is correct for `pnpm dev`. It does **not**
  affect production.
- Confirm **`AUTH_SECRET`** exists for **all** environments with the **same value**.
- **Redeploy** after any env change (env changes only apply to new builds).

### Step 6 — Separate the database (Neon branching)
1. Neon → **Branches → New Branch**: name `dev`, **Parent = `production`**, **include data**.
   This is copy-on-write: instant, isolated, and a full copy of live tables + data.
2. Open the `dev` branch → **Connect** → copy the **Pooled** connection string.
3. Vercel → Env Vars → create **two** `DATABASE_URL` entries:
   - `DATABASE_URL` (production string) → **Production only**.
   - `DATABASE_URL` (dev-branch string) → **Preview only** (Development is fine to leave; it
     only affects the `vercel dev` CLI, which we don't use — we use `.env.local`).
4. **Redeploy** both Production (`main`) and the dev branch.

### Step 7 — Verify the split
1. **Domains/auth:** `rgtools.co.nz` login stays on `rgtools.co.nz`; `rgtools-delta.vercel.app`
   login stays on itself. No cross-bounce.
2. **DB isolation (the real proof):** on **dev**, create a marked record
   (`ZZ-DEV-TEST — DO NOT USE`). Confirm it appears on dev but **NOT** on production.
3. **DB-level confirmation:** in Neon SQL Editor, run on each branch:
   ```sql
   select username, role from users;
   ```
   `production` returns your real users; `dev` returns the copy. New dev-only records must
   never appear in the `production` branch.
4. Clean up the test record afterwards.

---

## 5. Challenges hit & fixes

| # | Symptom | Root cause | Fix |
|---|---------|-----------|-----|
| 1 | Couldn't find "Production Branch" in Vercel | New UI hides it; `main` is default | Confirm via Deploy Hook defaulting to `main`; no change needed |
| 2 | No "Domains" item in Settings sidebar | Vercel moved Domains to a top-level/team tab | Use the project's top tabs or team-level Domains |
| 3 | Domain showed "Invalid Configuration" | DNS not yet pointing at Vercel | Add `A @ 216.198.79.1` + `CNAME www …vercel-dns-017.com`, then Refresh |
| 4 | (Cloudflare) which proxy mode? | Proxying Cloudflare in front of Vercel breaks SSL | Records must be **DNS-only / grey cloud** |
| 5 | Dev login: "clicking Sign in does nothing" | Server Action returned `{redirectTo:'/'}` and set the session cookie, but `/` re-checked `auth()` and bounced — host/secret confusion | `AUTH_TRUST_HOST=true`; ensure `AUTH_SECRET` on all envs |
| 6 | `rgtools.co.nz` redirected to `rgtools-delta.vercel.app/login?callbackUrl=%2F` | An `AUTH_URL`/`NEXTAUTH_URL` (or trust-host absence) made NextAuth use the dev host as canonical | Add `AUTH_TRUST_HOST=true` (all envs); remove/scope `AUTH_URL`; redeploy |
| 7 | Confusion over `.env.local` `AUTH_URL=localhost` | `.env.local` is local-only, not deployed | Leave it; it only affects local `pnpm dev` |
| 8 | Dev-created record appeared on production | `DATABASE_URL` still a single value (shared DB) | Scope `DATABASE_URL` per environment |
| 9 | **Production 500: `relation "users" does not exist`** and "invalid username/password" | Connection strings got **swapped**: Production `DATABASE_URL` ended up pointing at the **empty `dev` branch** | Repoint Production `DATABASE_URL` → `production` branch pooled string; redeploy |
| 10 | `dev` branch had no tables | The `dev` branch wasn't a true data-copy of `production` | Delete and recreate `dev` as a Neon branch with **Parent = `production`, include data** |

---

## 6. Incident log — production outage during DB split (2026-06-24)

**What happened:** while scoping `DATABASE_URL` for dev/prod, the two connection strings were
mixed up. Production ended up pointing at the **empty `dev` Neon branch**, which had no tables.

**Symptoms (in order):**
1. `www.rgtools.co.nz` → `500 Internal Server Error` ("Something went wrong").
2. Vercel runtime logs: `error: relation "users" does not exist` (Postgres `42P01`), same for
   `quotes`.
3. After tables existed but no accounts: login returned **"invalid username or password"**.

**Diagnosis:** ran `select username, role from users;` per Neon branch:
- `production` → 3 rows (`admin`, `rgadmin`, `staff`) = **live data, intact**.
- `dev` → `relation "users" does not exist` = **empty branch**.

**Resolution:**
1. Point **Production `DATABASE_URL`** → the **`production`** branch pooled string. Redeploy
   `main`. Live site + login restored (live data was never lost — only mis-pointed).
2. Recreate **`dev`** as a Neon branch off `production` (include data). Point **Preview
   `DATABASE_URL`** → the new `dev` branch string. Redeploy dev.
3. Re-run the isolation test (Step 7).

**Lesson:** Neon connection strings look nearly identical (same host, different branch
segment). Always confirm by querying `users` on each branch **before** pasting a string into
a Vercel slot, and never point Production at a child/dev branch.

---

## 7. Canonical mapping (source of truth)

| Vercel env var | Value source (Neon branch) | Has live data? |
|----------------|----------------------------|----------------|
| `DATABASE_URL` (Production) | `production` branch, **pooled** | Yes — live |
| `DATABASE_URL` (Preview) | `dev` branch, **pooled** | Copy |
| `AUTH_TRUST_HOST` (all envs) | `true` | — |
| `AUTH_SECRET` (all envs) | same secret everywhere | — |
| `AUTH_URL` | unset, or Production-only = `https://www.rgtools.co.nz` | — |

## 8. Recovery runbook (if production 500s on DB again)

1. Vercel → **Logs** (or the Production deployment → Runtime Logs). Look for the real error
   (`relation … does not exist` = wrong/empty DB; `password authentication failed` = bad
   string; `MissingSecret` = `AUTH_SECRET` gone).
2. Neon → SQL Editor → `select username, role from users;` on each branch to find the branch
   with real data.
3. Set **Production `DATABASE_URL`** to that branch's **pooled** string (Production scope only).
4. Confirm `AUTH_SECRET` present for Production.
5. Redeploy `main`. Verify login at `www.rgtools.co.nz`.

## 9. Outstanding / next session

- [ ] Confirm `www.rgtools.co.nz` login works after repointing Production to the `production`
      branch.
- [ ] Recreate `dev` Neon branch from `production` (with data) and point Preview
      `DATABASE_URL` at it; redeploy dev.
- [ ] Run the Step 7 isolation test (`ZZ-DEV-TEST` on dev only).
- [ ] Delete any `ZZ-DEV-TEST` left in the `production` branch from earlier testing.
- [ ] **Local tier:** confirm `.env.local` `DATABASE_URL` = the **`dev` branch pooled** string
      (decision 2026-06-24: local shares `dev`, never points at `production`). Verify with
      `select username, role from users;` on `dev`, then run a `ZZ-LOCAL-TEST` isolation check
      (must appear on `dev` only, never on `production`).
- [ ] Decide whether worker stack (viewer/tracker) should move to `rgtools.co.nz` subdomains
      or stay on `royalglass.co.nz` (separate decision — see Workers section in
      [deployment.md](deployment.md)).
