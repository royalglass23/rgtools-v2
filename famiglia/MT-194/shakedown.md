# MT-194 Shakedown

## Slice

Make manual ServiceM8 Work Orders refresh one atomic job-and-item reconciliation boundary. Preserve the last successful snapshot on failure, archive and restore jobs/items by stable identity, exclude configurable billing lines, expose removed items on demand, and show refresh freshness and counts.

## Automated coverage

- Required ServiceM8 datasets must be arrays of objects before reconciliation can start.
- Active Work Order rows require a stable ServiceM8 UUID or trusted job number.
- Active item rows require stable item/job UUIDs and a non-negative quantity.
- Fetch, source-validation, and transaction failures record a failed run without recording success.
- Complete successful refreshes mark missing jobs non-current and missing items inactive rather than deleting them.
- Stable item UUID upserts reactivate returning items while leaving RG-owned operational values out of the ServiceM8 update set.
- Configured billing terms match item code or description case-insensitively; unrelated jobs do not inflate Work Orders exclusion counts.
- Successful refresh records persist job, item, and excluded-line counts.
- Removed rows are hidden by default, can be revealed with `Show removed items`, are visibly marked, and do not change active-item counts.
- Last-success freshness/counts remain visible when a later refresh fails.
- Billing exclusions are normalized, deduplicated, configurable only through the existing Work Orders Configure permission boundary, and default to invoice, partial invoice, and deposit.

## Commands and results

- `pnpm.cmd exec vitest run modules/work-orders/__tests__` from `apps/web`: **PASS**, 15 files / 77 tests.
- Focused ESLint for all MT-194 web files: **PASS**.
- `pnpm.cmd exec tsc --noEmit -p packages/db/tsconfig.json --pretty false`: **PASS**.
- `pnpm.cmd exec next build` from `apps/web`: **PASS**, compilation, TypeScript, and 35-route page generation.
- `pnpm.cmd test` from the workspace root with network access: **PASS**, workspace 4 tests plus web 719 tests; 2 web files / 16 tests intentionally skipped by the existing suite.
- `git diff --check`: **PASS**.

## Security coverage

- Existing Manage authorization still gates manual refresh.
- A new negative authorization test proves ordinary Work Orders access cannot change billing exclusions without Configure permission.
- ServiceM8 data is validated before the write transaction; invalid data cannot partially replace the dashboard snapshot.
- User-visible refresh errors keep ServiceM8 validation context but replace internal reconciliation errors with a safe snapshot-preserved message.
- Exclusion input is normalized and limited to 25 terms of 80 characters or fewer before persistence.

## Deliberately skipped

- No live ServiceM8 refresh: this task did not use production credentials or production data.
- No migration execution against shared dev or production Neon: migration `0051_work_order_refresh_item_counts.sql` is additive and registered for release application.
- No Playwright journey against a real database: this checkout has no isolated migrated Work Orders test database or controlled ServiceM8 environment. Component, action, query, full-suite, and production-build coverage exercise the local slice without mutating shared infrastructure.
- The standalone web `tsc --noEmit` command remains blocked by the pre-existing unrelated assignment to readonly `NODE_ENV` in `lib/storage/__tests__/r2.test.ts`; the production Next build TypeScript pass succeeds.

## Staging verification

1. Apply migration `0051_work_order_refresh_item_counts.sql`.
2. Configure or confirm billing exclusion terms under `/admin/work-orders`.
3. Refresh a known current multi-item Work Order and confirm job/item/excluded counts plus last successful sync time.
4. Remove or deactivate one test item in ServiceM8, refresh, and confirm it disappears by default but appears as Removed when `Show removed items` is enabled.
5. Restore the same ServiceM8 item UUID, refresh, and confirm its previous RG-owned values remain.
6. Force a controlled ServiceM8 failure and confirm the prior dashboard snapshot and last-success time remain unchanged while safe failure feedback appears.
