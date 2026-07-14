# MT-193 Shakedown

## Slice

Persist and display active ServiceM8 `jobmaterial` lines as durable Work Order Items beneath their parent Work Order. Preserve the legacy job-level operational columns as a rollback seam.

## Automated coverage

- ServiceM8 normalization maps stable job/item UUIDs, resolves material catalog item codes, preserves quantity and original description, and computes line total excluding GST.
- Duplicate ServiceM8 item UUIDs normalize to one child input; the database schema also enforces a unique item UUID.
- The public refresh function imports two active item lines beneath one persisted parent and does not copy job-level RG tracking fields into item writes.
- A refresh with no item lines persists the parent and writes zero placeholder items.
- The persistence schema exposes label lifecycle fields and independent item-level installer, stage, hardware, maintenance, date, risk, and importance fields.
- Parent-page grouping attaches every active child after parent pagination and retains parents with zero items.
- Rendered UI tests verify the active item count, both children, and the exact `No items synced from ServiceM8 yet` empty state.
- Existing Work Orders permissions, queries, detail, configuration, filtering, actions, and page tests remain green.

## Commands and results

- `pnpm.cmd exec vitest run modules/work-orders/__tests__` from `apps/web`: **PASS**, 13 files / 59 tests.
- Focused ESLint for all MT-193 web files: **PASS**, no warnings or errors.
- `pnpm.cmd exec tsc --noEmit -p packages/db/tsconfig.json --pretty false`: **PASS**.
- `pnpm.cmd exec next build` from `apps/web`: **PASS**, compilation, TypeScript, and 35-route page generation.
- `pnpm.cmd test` from the workspace root with network access: **PASS**, workspace 4 tests plus web 702 tests; 16 web tests intentionally skipped by the existing suite.
- `git diff --check`: **PASS**.

## Security coverage

- Existing Work Orders refresh authorization tests confirm Manage access is required before the refresh boundary can run.
- MT-193 adds no new public mutation endpoint or user-controlled write input; ServiceM8 records are normalized before persistence and database identity constraints prevent duplicate children.

## Deliberately skipped

- No live ServiceM8 refresh: the slice was verified with controlled adapter responses and did not use production credentials or production data.
- No migration execution against shared dev or production Neon: migration `0050_work_order_items.sql` is additive and registered, but applying it to shared infrastructure is a release step.
- No Playwright journey against a real database: this checkout has no isolated migrated Work Orders test database or controlled ServiceM8 environment. Rendered UI tests and the production build cover the new presentation boundary; staging should run the manual refresh journey after migration.

## Remaining rollout verification

After migration in staging, run one manual refresh and compare a known multi-item job and a known zero-item job against ServiceM8. Confirm item count, item code, quantity, description hover detail, ex-GST line total hover detail, and the empty-state message before production promotion.
