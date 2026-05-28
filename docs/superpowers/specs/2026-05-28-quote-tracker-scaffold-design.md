# Quote Tracker — Week 1 Scaffold Design

**Date:** 2026-05-28
**Scope:** Week 1 scaffold only — platform foundation, auth, DB schema, Cloudflare Worker skeleton
**Platform:** rgtools.co.nz (Module 1 of N)

---

## 1. Project Context

Royal Glass has no visibility after a quote is sent. The Quote Tracker is Module 1 of the rgtools.co.nz internal platform. It tracks client engagement on every quote automatically, scores intent, and tells staff who to call and when.

This spec covers the Week 1 scaffold: everything that can be built before real quote data exists.

---

## 2. Approach

**Option C — Platform-aware scaffold** was chosen.

The README is explicit that this is a platform (Calculator, PS1/PS3 generator, Work Orders, Invoice Automation share the same Vercel deployment, Neon DB, auth, and Mac Mini). Building the folder structure to reflect that from day one avoids a painful restructure when Module 2 arrives.

---

## 3. Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 15, App Router | Vercel-hosted, TypeScript |
| Styling | Tailwind CSS | |
| ORM | Drizzle ORM + drizzle-kit | Type-safe, migration-friendly |
| Database | Neon Postgres | Free tier, existing account |
| Auth | NextAuth v5 (Auth.js) | Credentials provider, sessions in Neon |
| Package manager | pnpm | Faster installs |
| Tracking endpoint | Cloudflare Worker | Zero cold starts, free tier sufficient |
| Worker deploy | Wrangler CLI | |

---

## 4. Folder Structure

```
quote-tracker/                   ← repo root (also the Next.js app)
├── app/
│   ├── (auth)/
│   │   └── login/               ← platform login page
│   ├── (dashboard)/
│   │   └── quote-tracker/       ← Module 1 routes
│   └── api/
│       └── auth/                ← NextAuth route handler
├── modules/
│   ├── quote-tracker/           ← QT business logic, components, types
│   └── _shared/                 ← shared UI components, hooks, utilities
├── lib/
│   ├── db.ts                    ← single Neon/Drizzle client (platform-wide)
│   └── auth.ts                  ← NextAuth config (platform-wide)
├── workers/
│   └── tracker/
│       ├── src/index.ts         ← Cloudflare Worker handler
│       ├── wrangler.toml
│       └── package.json
├── drizzle/
│   ├── schema.ts                ← all 7 tables
│   └── migrations/              ← generated migration files
├── templates/
│   └── servicem8-email.html     ← tracked link email template
├── scripts/
│   └── seed.ts                  ← seeds first admin user
├── .env.local                   ← real values (gitignored)
├── .env.example                 ← committed placeholder
├── drizzle.config.ts
└── middleware.ts                ← route protection
```

**Key principle:** `/(dashboard)/` is the authenticated shell for the entire platform. Every future module drops a folder inside it and inherits auth automatically.

---

## 5. Database Schema

### users
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| username | text unique | |
| password_hash | text | bcrypt |
| role | enum(admin, staff) | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### sessions
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid → users | |
| expires_at | timestamptz | |
| created_at | timestamptz | |

NextAuth stores sessions here.

### quotes
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| servicem8_uuid | text | Pre-cached from ServiceM8 by n8n. Not unique — one SM8 quote can have multiple rows for per-recipient builder tokens |
| token | uuid unique | Used in tracked URL `/q/[token]` |
| client_name | text | |
| company_name | text | |
| job_description | text | |
| quote_value | numeric(10,2) | |
| pipeline_stage | enum | estimate, pending_quote, quote_sent, intent_scoring, closed |
| outcome | enum(won, lost) nullable | Set when pipeline_stage = closed |
| work_order_id | text nullable | ServiceM8 work order reference |
| converted_at | timestamptz nullable | |
| closed_at | timestamptz nullable | |
| status_tag | enum(hot, warm, cold, dead) nullable | Intent score classification |
| client_type | enum(builder, homeowner, architect) nullable | AI-inferred |
| ai_score | int nullable | 0–100, drives status_tag thresholds |
| ai_confidence | numeric(4,3) nullable | |
| ai_complexity | enum(low, medium, high) nullable | |
| internal_notes | text nullable | Admin-only |
| sent_at | timestamptz nullable | |
| archived_at | timestamptz nullable | Soft delete |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### quote_events
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| quote_id | uuid → quotes | |
| event_type | enum(open, scroll, close) | |
| device_type | text | |
| session_id | uuid | |
| scroll_depth | int nullable | |
| duration_ms | int nullable | |
| ip_hash | text | SHA-256, never raw IP |
| created_at | timestamptz | |

Append-only raw beacon log written by Cloudflare Worker.

### quote_engagement
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| quote_id | uuid unique → quotes | |
| total_opens | int default 0 | |
| total_time_ms | bigint default 0 | |
| max_scroll_depth | int default 0 | |
| unique_sessions | int default 0 | |
| unique_devices | int default 0 | |
| forwarding_suspected | boolean default false | Device/location change detection |
| last_opened_at | timestamptz nullable | |
| updated_at | timestamptz | |

One row per quote. Updated by the Cloudflare Worker on each beacon batch. Powers dashboard queries and the scoring engine without scanning raw events.

### tag_overrides
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| quote_id | uuid → quotes | |
| overridden_by | uuid → users | |
| previous_tag | enum(hot, warm, cold, dead) | |
| new_tag | enum(hot, warm, cold, dead) | |
| created_at | timestamptz | |

Full AI override audit log. Used to calibrate the scoring model over time.

### settings
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| key | text unique | |
| value | text | |
| updated_by | uuid → users | |
| updated_at | timestamptz | |

Key/value store for Telegram chat ID, notification email addresses, alert frequencies.

---

## 6. Authentication

- **Provider:** NextAuth v5, Credentials (username + password)
- **Session storage:** Neon `sessions` table via Drizzle adapter
- **Password hashing:** bcrypt
- **Route guard:** `middleware.ts` protects all `/(dashboard)/*` routes — platform-wide, not just quote tracker
- **Public routes:** `/login`, `/q/[token]` (client quote pages, Week 2), `/api/auth/*`
- **Role in session:** `role` field included in JWT — available in every server component via `auth()` without extra DB calls
- **Admin enforcement:** Role checked at server action level, not just UI

**Seed user (first admin):**
- Username: `rgadmin`
- Password: `*royalglass23`
- Run via: `pnpm seed`

---

## 7. Cloudflare Worker

**Purpose:** Receive beacon events from client quote pages. Zero cold starts — events cannot be dropped.

**Endpoint:** `POST /track`

**Request payload:**
```json
{
  "token": "uuid",
  "event": "open|scroll|close",
  "session": "uuid",
  "depth": 80,
  "duration": 4200
}
```

**Flow:**
1. Validate token exists in Neon
2. Hash client IP (SHA-256)
3. Detect device type from User-Agent
4. Write row to `quote_events`
5. Upsert `quote_engagement` (increment totals)
6. Return `204 No Content`

**Infrastructure:**
- Free Cloudflare account (100,000 req/day — well above Royal Glass volume)
- `DATABASE_URL` bound as a Cloudflare encrypted secret via `wrangler secret put`
- Deployed to a subdomain e.g. `tracker.rgtools.co.nz`
- Local dev via `wrangler dev`

---

## 8. Environment Variables

```bash
# Neon Postgres
DATABASE_URL=

# NextAuth
AUTH_SECRET=           # generate: openssl rand -base64 32
AUTH_URL=              # http://localhost:3000 locally, https://rgtools.co.nz in production

# ServiceM8
SERVICEM8_API_KEY=

# Claude API
ANTHROPIC_API_KEY=

# Notifications
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
NOTIFICATION_EMAIL=    # e.g. support@royalglass.co.nz
```

Cloudflare Worker receives `DATABASE_URL` via `wrangler secret put` — not from `.env`.

---

## 9. What This Scaffold Does NOT Include

The following are Week 2+ and explicitly out of scope for this scaffold:

- Client-facing quote page (`/q/[token]`) — Week 2
- Dashboard UI components — Week 4
- AI enrichment (Claude API calls) — Week 3
- n8n / OpenClaw integration — Week 3
- Notification system — Week 3
- ServiceM8 API calls — Week 2/3
- Calculator integration — future module

---

## 10. Open Items (Pre-Build)

- [ ] Neon connection string confirmed
- [ ] Vercel project created and linked
- [ ] Cloudflare account created (free)
- [ ] `rgtools.co.nz` DNS — Bluehost pointed to Vercel
- [ ] Tracker subdomain (`tracker.rgtools.co.nz`) pointed to Cloudflare Worker
