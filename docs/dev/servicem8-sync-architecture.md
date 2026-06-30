# ServiceM8 sync architecture (roadmap foundation)

> **Status: sketch / not yet built.** This is the proposed foundation for work-order tracking, staff allocation, invoices, weekly reports, and unified client/job dashboards.

This sync is not built on the official ServiceM8 MCP server. The MCP server remains useful for ad-hoc lookups and light notes, but dashboards and reports need deterministic data in Neon.

## Why a sync, not live MCP/REST calls

Dashboards and reports must be fast, deterministic, paginated, and aggregable. Calling ServiceM8 live on every page load is slow, rate-limited, and harder to test.

The standard pattern is:

```text
ServiceM8 api_1.0 -> scheduled pull -> Neon local mirror -> rgtools UI/reports
        ^                                                   |
        |-------------- light writes and reconcile ----------|
```

Pull the data we need into Neon on a schedule. Writes go back to ServiceM8 through the REST client, with the local mirror updated optimistically and reconciled on the next pull.

## Where this fits

This extends [architecture.md](./architecture.md):

- Reuse [`apps/web/lib/servicem8/client.ts`](../../apps/web/lib/servicem8/client.ts) and add paginated list helpers such as `listJobs`, `listJobActivities`, `listJobMaterials`, `listStaff`, and `listInvoices`.
- Add `apps/web/modules/servicem8-sync/`, mirroring the existing `apps/web/modules/lead-intake/servicem8/` shape.
- Add shared schema in `packages/db/src/schema-servicem8.ts`, separate from the existing `schema.ts`, `schema-leads.ts`, and `schema-ps-generator.ts`.
- Run sync from a Cloudflare cron worker, or from a secured API route plus external cron if the pull is small enough.

## RG Leads lifecycle boundary

The RG Leads workflow treats ServiceM8 status `Quote` as the only current lead-intake state. The label is singular: `Quote`, not `Quotes`. Code should trim and case-normalize before comparison, but it should not broaden the match to Work Order, completed, unsuccessful, or other statuses.

Current Quote Leads are unlinked lead-intake records plus linked ServiceM8 jobs whose status normalizes to `Quote`. Non-Quote linked leads remain available for client history and downstream modules, but lead-intake edits and lead-intake AI actions are disabled. Fetch from ServiceM8 remains available as the refresh path because a job can move back to `Quote` outside RG Tools.

Import and re-link paths must resolve by job number or UUID, fetch the current ServiceM8 job, and reject non-Quote jobs before mutating the lead. Imported Quote leads start unscored unless RG Tools has real scoring inputs; do not push a ServiceM8 Leads Quality value for an unscored imported lead.

## Proposed local schema

Proposed file: `packages/db/src/schema-servicem8.ts`.

| Table | Purpose | Key fields |
|-------|---------|------------|
| `sm8_jobs` | Mirror of jobs | `uuid`, `job_number`, `status`, `company_uuid`, `generated_job_id`, `total_invoice_amount`, `created_date`, `edit_date`, `raw`, `synced_at` |
| `sm8_job_activities` | Scheduling and staff allocation | `uuid`, `job_uuid`, `staff_uuid`, `start_date`, `end_date`, `activity_type`, `raw`, `synced_at` |
| `sm8_job_materials` | Line items | `uuid`, `job_uuid`, `name`, `sku`, `qty`, `price`, `active`, `category`, `raw` |
| `sm8_staff` | Staff directory | `uuid`, `name`, `email`, `active`, `raw`, `synced_at` |
| `sm8_invoices` | Invoice and payment status | `job_uuid`, `invoice_number`, `amount`, `paid`, `paid_date`, `raw`, `synced_at` |
| `sm8_sync_runs` | Per-sync observability | `id`, `entity`, `started_at`, `finished_at`, `pulled`, `upserted`, `status`, `error` |

Reconcile each entity by upserting on ServiceM8 `uuid`, using `edit_date` to skip unchanged rows. Exclude inactive line items when computing values.

## Roadmap mapping

| Roadmap item | Pulls | Writes back | Notes |
|--------------|-------|-------------|-------|
| Work-order tracking | `sm8_jobs`, `sm8_job_materials` | - | Dashboard reads from Neon |
| Task allocation | `sm8_job_activities`, `sm8_staff` | create/update job activity | REST can write allocations; official MCP cannot |
| Invoices | `sm8_invoices` | - | Read-only first |
| Weekly work-order report | aggregates over jobs and activities | - | SQL aggregate rendered/emailed on cron |
| Unified client jobs | join SM8 mirror to `clients`/`leads` | - | Uses existing `leads.servicem8_job_uuid` link |

## Suggested build order

1. Extend `apps/web/lib/servicem8/client.ts` with paginated list helpers and tests.
2. Add `packages/db/src/schema-servicem8.ts` and a migration for `sm8_jobs` plus `sm8_sync_runs`.
3. Build the jobs-only sync orchestrator and run it from cron.
4. Add `sm8_job_materials` and the work-order tracking view.
5. Add `sm8_staff` and `sm8_job_activities` for allocation.
6. Add `sm8_invoices` and outstanding invoice views.
7. Build weekly reports and unified client/job dashboards.
