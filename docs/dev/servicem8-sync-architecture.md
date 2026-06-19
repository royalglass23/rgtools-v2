# ServiceM8 sync architecture (roadmap foundation)

> **Status: sketch / not yet built.** This is the proposed foundation for the
> roadmap items — work-order tracking, staff allocation, invoices, weekly reports,
> and unified client/job dashboards. It is **not** built on the official MCP server
> (see [servicem8-mcp.md](./servicem8-mcp.md) for why the official server only
> covers ad-hoc lookups). It reuses the existing REST client and the lead-sync
> patterns already in the codebase.

## Why a sync, not live MCP/REST calls

Dashboards and reports must be **fast, deterministic, paginated, and aggregable**.
Calling ServiceM8 live on every page load (or via an LLM) is slow, rate-limited
(the jobcard CLI already throttles to ~300ms/call and backs off on HTTP 429), and
non-deterministic. The standard pattern — already proven by the lead pipeline — is:

```
ServiceM8 (api_1.0)  ──scheduled pull──▶  Neon (local mirror)  ──▶  rgtools UI / reports
        ▲                                                              │
        └──────────────── light writes (note, allocation) ◀───────────┘
```

Pull the data we need into Neon on a schedule; the app reads only from Neon.
Writes go back to ServiceM8 through the REST client (same as today's custom-field
write), with the local mirror updated optimistically and reconciled on next pull.

## Where this fits the existing system

This extends the architecture in [architecture.md](./architecture.md):

- Reuse [`lib/servicem8/client.ts`](../../lib/servicem8/client.ts) — extend it with
  paginated list helpers (`listJobs`, `listJobActivities`, `listJobMaterials`,
  `listStaff`, `listInvoices`) following the existing `ServiceM8FetchRequest`
  injectable-request pattern so everything stays unit-testable.
- New sync module `modules/servicem8-sync/` mirroring the shape of
  `modules/lead-intake/servicem8/` (client → payload/mapper → sync orchestrator).
- New Neon tables in a new `drizzle/schema-servicem8.ts` (keeps it separate from
  `schema.ts` / `schema-leads.ts`, consistent with the existing split).
- A scheduled trigger. Two options, matching patterns already in the repo:
  - **Cloudflare cron worker** (like `rg-notifier` / `rg-cleanup`) — preferred,
    keeps long pulls off the Next.js/Vercel request path.
  - or a **secured API route + external cron** (like the existing
    `/api/lead-intake/servicem8/retry` bearer-token route).

## Proposed local schema (`drizzle/schema-servicem8.ts`)

Sketch — mirror only the fields each feature needs, store the raw object in JSONB
for forward-compat, and key everything on the ServiceM8 UUID.

| Table | Purpose | Key fields |
|-------|---------|-----------|
| `sm8_jobs` | Mirror of jobs (work orders, quotes, completed) | `uuid` (unique), `job_number`, `status`, `company_uuid`, `generated_job_id`, `total_invoice_amount`, `created_date`, `edit_date`, `raw` (jsonb), `synced_at` |
| `sm8_job_activities` | Scheduling / staff allocation | `uuid`, `job_uuid`, `staff_uuid`, `start_date`, `end_date`, `activity_type`, `raw`, `synced_at` |
| `sm8_job_materials` | Line items (reuses jobcard category rules) | `uuid`, `job_uuid`, `name`, `sku`, `qty`, `price`, `active`, `category` (computed), `raw` |
| `sm8_staff` | Staff directory | `uuid`, `name`, `email`, `active`, `raw`, `synced_at` |
| `sm8_invoices` | Invoice / payment status | `job_uuid`, `invoice_number`, `amount`, `paid`, `paid_date`, `raw`, `synced_at` |
| `sm8_sync_runs` | Observability per sync (like `lead_email_log`) | `id`, `entity`, `started_at`, `finished_at`, `pulled`, `upserted`, `status`, `error` |

Reconcile each entity by **upsert on `uuid`** using `edit_date` to skip unchanged
rows. Soft-deleted ServiceM8 line items are excluded via `active = 1` (the jobcard
export already documents the R260210 case where ignoring `active` inflated a
subtotal by ~$17k).

## Roadmap items mapped to this foundation

| Roadmap item | Pulls | Writes back | Notes |
|---|---|---|---|
| **Work-order tracking** | `sm8_jobs` (status `Work Order`), `sm8_job_materials` | — | Dashboard reads from Neon; "open work orders" view, aging, value. |
| **Task allocation to staff** | `sm8_job_activities`, `sm8_staff` | create/update job activity (REST) | The official MCP can't write allocations; the REST `jobactivity` object can. Optimistic local update + reconcile. |
| **Invoices** | `sm8_invoices` | — (read-only first) | Paid/unpaid, outstanding totals per client/job. |
| **Weekly work-order report** | aggregate `sm8_jobs` + `sm8_job_activities` over the week | — | Deterministic SQL aggregate → render/email (reuse the Resend + cron pattern from `rg-notifier`). MCP may *narrate* it, never compute it. |
| **Unified client jobs + dashboards** | join `sm8_jobs` → existing `clients`/`leads` on `company_uuid` / `servicem8_job_uuid` | — | The `leads.servicem8_job_uuid` link already exists; this closes the loop client → leads → jobs → invoices in one view. |

## Where MCP still plays a role (later)

Once jobs live in Neon, a **custom local MCP server** (or in-app assistant) can sit
on top of the *mirror* — "how many work orders are unallocated this week?" answered
against our own DB, fast and deterministic. That is a separate, optional layer
built after the sync, not a dependency of it. The official `go.servicem8.com/mcp`
server remains useful only for ad-hoc human lookups and light notes.

## Suggested build order

1. Extend `lib/servicem8/client.ts` with paginated list helpers + tests.
2. Add `drizzle/schema-servicem8.ts` (start with `sm8_jobs` + `sm8_sync_runs`) and a migration.
3. Build the sync orchestrator for jobs only; wire a cron worker. Verify counts vs ServiceM8.
4. Add `sm8_job_materials` (reuse `jobcard-export/jobcard-categories.ts` rules) → work-order tracking view.
5. Add `sm8_staff` + `sm8_job_activities` → allocation (first read, then write-back).
6. Add `sm8_invoices` → outstanding view; then the weekly report (cron + Resend).
7. Unified client/job dashboard joining the mirror to `clients`/`leads`.
