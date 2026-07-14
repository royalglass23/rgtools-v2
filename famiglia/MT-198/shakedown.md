# MT-198 Shakedown

## Slice

Extend Work Order Summary Configuration with the composite Item field and Editable choices, then apply configuration and Manage permission together on the grouped dashboard and mutation boundaries. Move dashboard search, filters, child matching, matching counts, and agreed operational sorts onto Work Order Item data while preserving parent job context, pagination, Search, Sort, Reset, and configurable filter visibility.

## Automated coverage

- Older saved summary configurations retain administrator visibility, filterability, editability, and relative order choices while gaining missing catalog fields and defaults.
- Missing fields are inserted in catalog order when the saved configuration still follows catalog order.
- Client, ServiceM8-owned, and context fields are normalised and serialised as read-only even if a forged saved value says otherwise.
- The composite Item field hides or shows quantity, item code, and effective label together; its Editable choice affects only the short-label controls.
- Operational item fields render in configured order and are editable only when both Manage permission and the field's Editable configuration allow it.
- Label and operational mutation actions re-check Editable configuration server-side, so a stale or forged client cannot bypass a newly disabled field.
- Search covers parent client/company, address, job number, and job description plus child item code, effective label, and original description.
- A parent-context search hit retains every otherwise eligible child; an item-only search or configured item filter narrows children while preserving the parent.
- Filtered groups report matching active children against total active children, and clearing search/filters restores the full eligible child set.
- Search remains permanent; Importance, Risk, Stage, Hardware, and Maintenance Program controls render only when their fields are Filterable; Sort and Reset remain permanent.
- Importance and Risk sorts aggregate the highest effective active-item level. Install Date ascending uses the earliest active-item date and descending uses the latest. Stable Work Order ID tie-breakers make every supported ordering deterministic.
- Search, auto-applied filters, Sort, and page-size forms submit page one.
- The transitional parent-only CSV excludes the new Item field so MT-199 can add item-row export without exposing a blank Item column in this slice.

## Commands and results

- Clean baseline Work Orders suite before MT-198 changes: **PASS**, 19 files / 114 tests.
- Focused MT-198 behavior set: **PASS**, 8 files / 71 tests.
- Final Work Orders suite: **PASS**, 20 files / 126 tests.
- Complete web Vitest suite: **PASS**, 131 files passed and 2 skipped; 775 tests passed and 16 skipped.
- Workspace Vitest suite: **PASS**, 2 files / 4 tests.
- Modified-file ESLint: **PASS**, no warnings or errors.
- Complete web ESLint: **PASS**, zero errors; six existing unrelated warnings remain.
- App-scoped `next build`: **PASS**, compilation, TypeScript, 35-page generation, `/work-orders`, `/admin/work-orders`, and `/api/work-orders/export`.
- Standalone web `tsc --noEmit`: all MT-198 files are clean; the command remains blocked only by the pre-existing readonly `NODE_ENV` assignment in `lib/storage/__tests__/r2.test.ts`.
- `git diff --check`: **PASS**.

## Security coverage

- Manage permission remains necessary for label and operational edits but is no longer sufficient when Editable configuration is off.
- Server actions fetch and enforce current summary configuration before reading or mutating the item, covering stale pages and forged requests.
- Editable configuration is allow-listed: only Item short labels and the eight RG-owned operational fields can be enabled; client and externally owned/context fields remain read-only.
- Existing field-name, date, option, level, active-item, and audit-boundary validation remains covered by the Work Orders regression suite.
- Search and filter values remain parameterised through Drizzle expressions; no raw user input is interpolated into SQL text.
- No secrets, production data, live ServiceM8 writes, or OpenAI calls are used by MT-198 tests.

## Deliberately skipped or incomplete

- No Playwright journey: this checkout still has no isolated authenticated Work Orders database fixture or controlled ServiceM8/OpenAI adapters. Component, query-boundary, pure matching, server-action, and production-build checks cover the changed public seams without mutating shared infrastructure.
- No live Neon or ServiceM8 verification: MT-198 adds no schema migration and changes saved JSON normalisation, query behavior, and dashboard controls only.
- Item-row CSV export remains MT-199. This slice preserves the existing parent-only export without adding a blank Item column.
- The standalone TypeScript command still reports only the unrelated `lib/storage/__tests__/r2.test.ts` readonly `NODE_ENV` assignment; the production build TypeScript gate succeeds.

## Staging verification

1. Open `/admin/work-orders`, confirm Item plus Visible, Filterable, Editable, and drag ordering are present, and verify read-only fields cannot be made editable.
2. Save a reordered configuration with Item hidden, one operational field hidden, selected filters disabled, and selected editable fields disabled; reload and confirm choices persist.
3. Open `/work-orders` as a Manage user and confirm only configured visible/editable item controls appear in the saved order.
4. Open the same page as a View-only user and confirm configured values remain visible with no edit controls.
5. Search by client/company, address, job number, and job description and confirm all eligible active children remain beneath matching parents.
6. Search by item code, effective label, and original description; then apply each configured item filter and confirm only matching children remain with `matching of total active items` shown.
7. Clear filters and use Reset; confirm all eligible active children return and pagination resets to page one after search, filter, sort, or page-size changes.
8. Compare Importance, Risk, and ascending/descending Install Date sorts against representative multi-item jobs, including a job with no active items.
