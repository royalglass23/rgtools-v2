# MT-195 Shakedown

## Slice

Replace the flat Work Orders summary with parent Work Order groups that page by job, start expanded, collapse independently, and show compact read-only ServiceM8 item cells. Preserve the existing Work Orders controls and summary-configuration ownership.

## Automated coverage

- The dashboard defaults to five parent Work Orders and accepts only 5, 10, 20, or 50 jobs per page.
- The parent query applies limit and offset before loading child items, so item-row counts do not consume pagination slots.
- Default ordering uses Lead Score descending with null scores last and a stable Work Order ID tie-breaker.
- Every rendered parent starts expanded and exposes job number, client, address, active item count, and Lead Score even when configurable supplementary fields are hidden.
- One parent can collapse without changing any sibling group; navigation/filter state remounts the grouped surface so the next page load starts expanded.
- Item cells show quantity, item code, and the effective short label with manual override precedence.
- Hover content always retains the immutable ServiceM8 description and line total excluding GST, including an explicit unavailable state.
- The item surface has no edit controls for ServiceM8-owned quantity, item code, source description, or price.
- Existing Sort and Reset controls remain, and sort/page-size forms submit page one.
- Pagination remains bottom-centred and page-size selection bottom-right, with the exact accepted page-size options.
- Existing Work Orders permissions, refresh, persistence, configuration, filters, detail, and server-page tests remain green.

## Commands and results

- `pnpm.cmd exec vitest run modules/work-orders/__tests__` from `apps/web`: **PASS**, 16 files / 82 tests.
- `pnpm.cmd exec vitest --run tests` from the workspace root: **PASS**, 2 files / 4 tests.
- Focused ESLint for all MT-195 web files: **PASS**, no warnings or errors.
- `pnpm.cmd exec next build` from `apps/web`: **PASS**, compilation, TypeScript, and 35-route page generation.
- `git diff --check`: **PASS**.

## Security coverage

- MT-195 adds no mutation endpoint, external-system write, secret handling, or production-data operation.
- Existing Work Orders View/Manage/Configure boundaries remain unchanged.
- ServiceM8-owned quantity, item code, original description, and line total remain rendered without edit controls.
- Pagination and sort inputs continue through the existing validated list-filter boundary; unsupported page sizes fall back to five.

## Deliberately skipped or incomplete

- The standalone web `tsc --noEmit` command remains blocked by the pre-existing readonly `NODE_ENV` assignment in `lib/storage/__tests__/r2.test.ts`; the production Next build TypeScript pass succeeds.
- The complete web Vitest suite progressed into unrelated Leads and Quote Tracker tests but exceeded the five-minute command cap both with normal concurrency and one worker. No MT-195 or Work Orders failures appeared; the focused Work Orders suite and workspace suite pass.
- No Playwright journey against a live Work Orders database: this checkout has no isolated migrated Work Orders test database or authenticated controlled ServiceM8 environment. Component tests exercise the grouped interaction without mutating shared data.
- No live ServiceM8 refresh or shared Neon migration was needed because MT-195 changes presentation, validated URL parsing, and query ordering only.

## Staging verification

1. Open `/work-orders` with at least six current jobs and confirm five parent jobs appear on page one.
2. Confirm all five start expanded and collapsing one job leaves the other four expanded.
3. Confirm each header shows job number, client, address, active item count, and Lead Score; scored jobs precede unscored jobs.
4. Hover representative item cells and compare quantity, item code, short label, original description, and ex-GST total with ServiceM8.
5. Change Sort and Jobs per page and confirm navigation returns to page one.
6. Confirm pagination is centred at the bottom and Jobs per page is aligned bottom-right at desktop width.
