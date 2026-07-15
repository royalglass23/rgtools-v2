# MT-197 Shakedown

## Slice

Move Installer, Stage, Hardware, Maintenance Program, Install Date, Date Completed, Risk, and Importance ownership from the parent Work Order write surface to independent Work Order Items. Provide Manage-only field autosave with visible feedback and rollback, confirmed one-field bulk apply across active siblings, item-linked audit history, and a combined parent/item detail timeline.

## Automated coverage

- Each active item renders independent controls for all eight operational fields to Manage users.
- View-only users see the same item values without edit or bulk controls.
- Each single-field action enforces Work Orders Manage permission and rejects forged field names or invalid dates before opening a transaction.
- A single save changes only the selected item column and records actor, parent Work Order, affected item, field, previous value, new value, and time.
- A failed UI save restores that field's last persisted value, leaves neighboring controls unchanged, shows the server error, and provides Retry.
- Bulk apply copies only the selected field, skips removed and already-matching items, and creates one event per changed active sibling.
- Bulk apply stores no linkage; later single-item saves use the same independent update path.
- The grouped dashboard renders item-owned operational values and suppresses legacy parent operational values.
- The detail timeline remains chronologically ordered, includes parent events, and identifies item events by item code/label and actor username.
- The old parent operational form and server action are removed.
- Schema coverage proves `work_order_events.work_order_item_id` is nullable, indexed, and linked to `work_order_items`.

## Commands and results

- Work Orders Vitest suite: **PASS**, 19 files / 114 tests.
- Complete web Vitest suite: **PASS**, exit 0 in 159.7 seconds.
- Workspace web lint: **PASS**, zero errors; six existing unrelated warnings remain.
- App-scoped `next build`: **PASS**, compilation, TypeScript, 35-page generation, and both Work Orders routes.
- Standalone web `tsc --noEmit`: MT-197 files are clean; the command remains blocked only by the pre-existing readonly `NODE_ENV` assignment in `lib/storage/__tests__/r2.test.ts`.
- `git diff --check`: **PASS**.

## Security coverage

- Both single and bulk mutation boundaries require Work Orders Manage permission; View access alone renders read-only values.
- Field names are allow-listed at runtime, not trusted from TypeScript or the browser.
- Dates, option identifiers, yes/no values, and risk/importance levels are validated at the server boundary.
- Removed items cannot be edited individually and are excluded from bulk writes.
- Database updates and audit inserts share one transaction so a failed audit cannot leave an untracked item change.
- ServiceM8-owned quantity, item code, original description, and price remain read-only.
- No secrets, live ServiceM8 writes, or production data are used by the tests.

## Deliberately skipped or incomplete

- No Playwright journey: the repository has no Work Orders e2e spec or isolated authenticated Work Orders database fixture. Component and server-action tests cover visible permission, save, rollback, retry, confirmation, and bulk behavior without mutating shared infrastructure.
- No live Neon migration was applied. The scoped migration is registered and the production build/type checks compile against the updated schema; staging must apply migration `0052_work_order_item_audit` before exercising writes.
- No live ServiceM8 refresh was needed because MT-197 changes RGTools-owned item values only.

## Staging verification

1. Apply migration `0052_work_order_item_audit` and open a multi-item current Work Order as a Manage user.
2. Change each of the eight fields on different items and confirm Saving then Saved appears without changing sibling fields.
3. Force one rejected save and confirm the last persisted value returns with an actionable error and Retry.
4. Apply one field from a source item to all active items, confirm the prompt, and verify removed items remain unchanged.
5. Edit one bulk-updated child independently and verify the other children do not follow it.
6. Open the Work Order detail timeline and confirm parent and item events are chronological and item events identify the affected item and actor.
7. Sign in with View-only access and confirm values remain visible with no edit or bulk controls.
8. Confirm the old parent operational form is absent from Work Order detail.
