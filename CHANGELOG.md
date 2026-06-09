# Changelog

All notable changes to rgtools are recorded here, grouped by release.

---

## [Unreleased]

---

## [0.5.0] — 2026-06-09

### Added
- Leads dashboard at `/leads` — paginated list with tier, SM8, and date filters; columns for date, client, job address, project, tier badge, score, SM8 status, completeness
- Lead detail page at `/leads/[id]` — read-only view of all scored fields, score summary (tier, score, completeness, flag note, score reason), and ServiceM8 section
- "Fetch from ServiceM8" button — searches ServiceM8 jobs for the `RGTools Lead {uuid}` reference, stores job UUID and status, sets the Leads Quality custom field on first link only
- Bulk delete from the leads list (admin only, with confirmation)
- Soft-delete per-lead from the detail page (admin only)
- Edit button on detail page routes to `/lead-intake?leadId=...` with the form pre-filled and "Reason for edit" required
- `servicem8_status` column added to `leads` table (migration 0005)

### Fixed
- SM8 "Pending" filter now correctly returns leads whose email was sent but job UUID not yet fetched (`syncStatus = 'synced'` + no `servicem8JobUuid`); previously queried `pending_sync` which is only set for milliseconds during creation
- Invalid (non-UUID) `[id]` path segments now return a clean 404 instead of crashing with a PostgreSQL type error
- ServiceM8 fetch API route status code now properly narrows the union type before accessing `result.reason`
- `batchDeleteLeadsAction` auth failure now throws (consistent with `deleteLeadAction`) instead of returning a silently-discarded error object

---

## [0.4.0] — 2026-06-09

### Added
- ServiceM8 sync: lead intake now pushes new leads directly to the ServiceM8 inbox via SMTP
- Amber blocker flag note displayed on `ScorePanel`, result banner, and persisted to DB
- Strike layer in scoring engine: selecting a "blocker low" option (complex install, high price sensitivity, multi-layer board) soft-demotes or caps the tier
- Scoring config v3 seeded with updated point values and strike weights

---

## [0.3.0] — 2026-06-08

### Added
- Driving distance auto-computed via Google Distance Matrix API when a job address is selected
- Distance band displayed in the intake form with point preview (+6 / +4 / +2 pts)
- Distance category (cat7) added to scoring engine and scoring config v2
- `ScorePanel` reflects computed distance in real time

### Fixed
- Distance resets correctly when Job Address is cleared
- Dropdown option order preserved via `optionOrder` array in config
- Google Maps loader lazy-loaded to prevent SSR `window` errors
- Separate server key (`GOOGLE_MAPS_SERVER_KEY`) used for Distance Matrix to avoid client-key exposure

---

## [0.2.0] — 2026-05-30

### Added
- Lead intake v1: staff form to capture client details, project info, and 6-category scoring answers
- Real-time `ScorePanel` showing live score and tier as fields are filled
- Config-driven scoring engine (`score-lead.ts`) — categories, tiers, bonuses, penalties loaded from DB
- Versioned scoring config stored in `scoring_config_versions` table
- Google Places autocomplete for job address field (NZ addresses only)
- Lead deduplication by normalised phone or email
- Audit log entry on every lead create/update
- Scoring config v1 seeded

### Changed
- Codebase reorganised into `modules/` feature folders (`lead-intake`, `admin`)

---

## [0.1.0] — 2026-05

### Added
- Next.js 16 app with NextAuth v5 credential login (admin/staff roles)
- Dashboard: KPI row (pipeline value, open quotes, hot leads, win rate), urgent actions table, pipeline snapshot by stage
- Quote pipeline: stages estimate → pending → sent → scoring → closed, status tags hot/warm/cold/dead
- Quote engagement tracker (`workers/tracker`) — Cloudflare Worker receiving open/scroll/close beacon events, writing to `quote_events` and `quote_engagement` aggregate
- Drizzle ORM schema with Neon PostgreSQL (users, sessions, quotes, quote events/engagement, audit log, error log)
- Role-based module access control (admin sees all modules; staff sees granted modules only)
- Admin module: user management, CSV export, error log viewer
