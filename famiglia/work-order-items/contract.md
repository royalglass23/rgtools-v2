## Problem Statement

Royal Glass needs the Work Orders dashboard to show what is actually being produced and installed for each ServiceM8 job. A ServiceM8 job number can contain many item or service lines, but RGTools currently stores and displays only one Work Order row with one shared set of operational fields. Staff cannot see at a glance which items belong to a job or monitor each item independently.

The operational fields already in RGTools must belong to individual items because items under the same job can have different installers, stages, hardware states, maintenance-program settings, dates, risk, and importance. ServiceM8 remains the source of truth for job and item identity, while RGTools remains the source of truth for these operational tracking values.

## Solution

Introduce Work Order Items as children of a Work Order. A Work Order remains the RGTools representation of one current ServiceM8 job; every active ServiceM8 `jobmaterial` line becomes exactly one Work Order Item linked by stable ServiceM8 UUIDs.

The Work Orders summary will be a grouped, two-level dashboard. Each parent job header shows job number, client, address, item count, and the linked Lead Intake score. Jobs are ordered by Lead Score from highest to lowest by default. All jobs start expanded so staff can immediately see their items, but each job can be collapsed.

Each item appears in one compact Item column containing ServiceM8 quantity, ServiceM8 item code, and an OpenAI-generated short label. Hovering the item always shows the unchanged original ServiceM8 description and line total excluding GST. Only the short label is editable; quantity, item code, original description, and price remain read-only.

The existing RGTools operational fields are retained and moved to item level: Installer, Stage, Hardware, Maintenance Program, Install Date, Date Completed, Risk, and Importance. Eligible fields can be edited directly in the summary when enabled by configuration. Each change auto-saves with visible progress and error feedback and creates an item-level audit event.

The accepted visual structure is represented by the Work Order Summary planning mockup in the planning folder for this contract.

## User Stories

1. As a Royal Glass staff member, I want each current ServiceM8 job shown as one parent Work Order, so that the dashboard matches the job numbers used by the business.
2. As a Royal Glass staff member, I want every ServiceM8 item line shown beneath its job number, so that I can see the complete production scope at a glance.
3. As a Royal Glass staff member, I want all five jobs on the first page expanded by default, so that I do not need to open each job to see its items.
4. As a Royal Glass staff member, I want to collapse an individual job, so that I can reduce visual noise when reviewing other jobs.
5. As a Royal Glass staff member, I want each parent header to show job number, client, address, item count, and Lead Score, so that I retain job context while reviewing items.
6. As a Royal Glass staff member, I want jobs ordered by highest Lead Intake score by default, so that the most important sales context remains visible first.
7. As a Royal Glass staff member, I want jobs without a Lead Score placed after scored jobs, so that missing context does not outrank known high-scoring work.
8. As a Royal Glass staff member, I want one compact Item column containing quantity, item code, and short label, so that the dashboard remains readable.
9. As a Royal Glass staff member, I want the full original ServiceM8 description available on hover, so that I can verify an abbreviated or manually edited label.
10. As a Royal Glass staff member, I want the ServiceM8 line total excluding GST available on hover, so that pricing context is available without occupying a dashboard column.
11. As a Royal Glass staff member, I want quantity and item code to remain read-only, so that RGTools cannot conflict with ServiceM8.
12. As a Royal Glass staff member, I want OpenAI to generate a concise production label for a new item, so that long ServiceM8 descriptions are easy to scan.
13. As a Royal Glass staff member, I want to edit an unsatisfactory short label, so that the production wording can be corrected.
14. As a Royal Glass staff member, I want my manual label to survive future refreshes, so that AI or ServiceM8 cannot silently overwrite it.
15. As a Royal Glass staff member, I want a source-change warning when ServiceM8 changes the original description behind a manual label, so that I can review whether my label is still accurate.
16. As a Royal Glass staff member, I want to deliberately regenerate a label with OpenAI, so that I can replace the current label when appropriate.
17. As a Royal Glass staff member, I want an item to remain visible with a safe fallback when OpenAI fails, so that an AI outage never hides production work.
18. As a Royal Glass staff member, I want every item to have independent Installer, Stage, Hardware, Maintenance Program, Install Date, Date Completed, Risk, and Importance values, so that different parts of one job can progress separately.
19. As a Royal Glass staff member, I want configured fields editable directly in the summary, so that routine updates do not require opening the job detail page.
20. As a Royal Glass staff member, I want every edit to show Saving, Saved, or actionable error feedback, so that I know whether RGTools accepted the change.
21. As a Royal Glass staff member, I want to apply one field value to all active items in a job, so that common assignments do not require repetitive edits.
22. As a Royal Glass staff member, I want bulk-applied items to remain independent afterward, so that exceptions can be changed separately.
23. As a Royal Glass staff member, I want the existing Search field retained, so that I can find jobs using familiar controls.
24. As a Royal Glass staff member, I want Search to include client, address, job number, item code, short label, and original item description, so that either job or item information can locate the work.
25. As a Royal Glass staff member, I want the existing Importance, Risk, Stage, Hardware, and Maintenance Program filters retained when enabled in configuration, so that established workflows continue to work.
26. As a Royal Glass staff member, I want an item-level filter to show only matching items while retaining their parent job header, so that results stay focused without losing job context.
27. As a Royal Glass staff member, I want a matching job to report how many of its items match, so that I can distinguish filtered results from the job's full scope.
28. As a Royal Glass staff member, I want clearing filters to restore all active items, so that filtering never changes stored data.
29. As a Royal Glass staff member, I want the existing Reset and Sort controls retained, so that the summary remains familiar.
30. As a Royal Glass staff member, I want five job numbers per page by default, so that expanded item groups remain manageable.
31. As a Royal Glass staff member, I want page-size choices of 5, 10, 20, and 50 job numbers, so that I can choose the amount of work shown.
32. As a Royal Glass staff member, I want navigation centred at the bottom and the page-size control at the bottom right, so that pagination is predictable.
33. As a Royal Glass manager, I want one manual refresh to synchronise both ServiceM8 jobs and items, so that the two levels cannot drift.
34. As a Royal Glass manager, I want a failed or incomplete refresh to leave the last successful dashboard unchanged, so that partial ServiceM8 responses cannot hide work.
35. As a Royal Glass manager, I want the last successful sync time and refresh errors shown, so that I can judge dashboard freshness.
36. As a Royal Glass staff member, I want jobs that leave ServiceM8's `Work Order` status hidden from the active dashboard, so that the team focuses only on current Work Orders.
37. As a Royal Glass staff member, I want a returning Work Order to regain its previous labels, operational values, and history, so that temporary status changes do not destroy RGTools data.
38. As a Royal Glass staff member, I want removed ServiceM8 items archived rather than deleted, so that their tracking and audit history remain available.
39. As a Royal Glass staff member, I want removed items hidden by default and available through Show removed items, so that current work stays uncluttered without losing history.
40. As a Royal Glass staff member, I want an active job with no ServiceM8 items to show a clear empty state, so that I know the job synced successfully but has no items yet.
41. As a Royal Glass manager, I want invoice, partial-invoice, and deposit lines excluded from production items, so that billing lines do not clutter the operational dashboard.
42. As an administrator, I want billing-line exclusion terms configurable, so that the rule can evolve without a code change.
43. As an administrator, I want refresh results to report excluded-line counts, so that exclusions are visible rather than silent.
44. As an administrator, I want summary configuration to control field visibility, filterability, order, and editability, so that the dashboard matches Royal Glass operations.
45. As an administrator, I want only RG-owned operational fields eligible for general inline editing, with Client and ServiceM8/context fields read-only, so that system ownership is clear.
46. As an administrator, I want the Item column's editability setting to control only its short label, so that its ServiceM8 quantity and code stay protected.
47. As a viewer without Manage permission, I want to see the same configured summary without edit controls, so that access remains read-only.
48. As a manager with Manage permission, I want edits allowed only when the field is also configured as editable, so that permissions and configuration both apply.
49. As an administrator with Configure permission, I want to manage fields and exclusions without gaining those abilities merely from ordinary Work Order access, so that configuration remains separately protected.
50. As a reviewer, I want every item edit and bulk update recorded with actor, field, previous value, new value, and time, so that the operational history is trustworthy.
51. As a Royal Glass staff member, I want CSV export to respect current search and filters and represent each item on its own row with repeated parent job context, so that exported data does not lose item-level tracking.

## Implementation Decisions

### Domain and persistence

Add a Work Order Item entity beneath Work Order. Each item uses an internal UUID and stores the stable ServiceM8 item UUID and parent ServiceM8 job UUID. A uniqueness constraint prevents the same ServiceM8 item from being attached more than once.

Persist ServiceM8-owned item data separately from RG-owned tracking data. ServiceM8-owned data includes item code, quantity, original description, line total excluding GST, active state, and source edit metadata. RG-owned data includes generated label, manual label override and label state, Installer, Stage, Hardware, Maintenance Program, Install Date, Date Completed, AI/manual Risk, and AI/manual Importance.

Track enough label metadata to distinguish pending, generated, manually edited, failed, and source-changed states. Retain a source-description fingerprint so a changed ServiceM8 description can be detected without overwriting a manual label.

Add item-level audit events. Every event identifies its Work Order and Work Order Item and records actor, field, previous value, new value, and timestamp. Bulk updates emit one event per changed item. Job detail timeline queries combine job and item events in chronological order and identify the affected item by its display label and stable identity.

Existing job-level operational columns contain no business data and require no backfill. Keep them during the first rollout as a rollback seam, stop writing them from the UI, and remove them only in a later cleanup after item tracking is stable.

### ServiceM8 synchronisation

The existing manual Refresh Work Orders action becomes one orchestration boundary for job and item synchronisation. It fetches the complete active ServiceM8 `Work Order` job set, company context, and active `jobmaterial` set before changing RGTools.

Validate every required ServiceM8 response before opening the reconciliation transaction. If any required fetch or validation fails, write a failed refresh run, retain the previous successful snapshot unchanged, keep the previous last-successful-sync time, and show a safe refresh error.

On success, reconcile jobs and items by ServiceM8 UUID in one database transaction. Jobs with ServiceM8 status `Work Order` are current. Jobs no longer in that status become non-current and disappear from the active summary without deletion. If they later return, the same records become current again with all RG-owned data preserved.

Active ServiceM8 item lines become active Work Order Items. A previously known item that is inactive or absent from the complete successful item truth set becomes removed and is hidden by default. A returning item reactivates its existing record and history.

Do not create placeholder item records for jobs with no items. The parent job remains visible with the agreed empty-state message.

Apply configurable, case-insensitive billing-line exclusions during normalisation. Initial terms are invoice, partial invoice, and deposit. The refresh result reports excluded count. A later configuration change takes effect on the next complete refresh.

Automated scheduled refresh is not part of this release. Preserve the manual refresh button and expose last successful sync time, successful job/item counts, excluded count, and safe failure feedback.

### Short-label generation

Use RGTools' existing OpenAI configuration behind a Work Order label-generator adapter. Keep provider and model selection outside the Work Order domain so the model can change without changing item persistence or dashboard code.

Generate a label for a new, unlabelled item after the successful ServiceM8 transaction. OpenAI failure must not roll back or fail ServiceM8 sync. A pending or failed item displays quantity, code, and a truncated original description with a Label pending state. Retry on a later manual refresh and allow an authorised user to edit immediately.

Expect exactly one concise label for one ServiceM8 line. Do not split one ServiceM8 line into multiple RGTools items. Validate that generated output is non-empty and single-label before saving it.

The effective label is the manual override when present, otherwise the generated label, otherwise the safe original-description fallback. Routine refresh never overwrites a generated or manual label. If the original ServiceM8 description changes, regenerate automatically only when no manual override exists. When a manual override exists, retain it and mark Source description changed. Explicit Regenerate with AI requires confirmation and deliberately replaces the current label.

### Summary configuration and permissions

Extend summary-field configuration with an Editable property. Normalisation must merge new catalog fields and new properties into previously saved configurations without discarding administrator choices.

Add one Item summary field. It renders quantity, item code, and effective short label in one cell. Its visibility controls the composite cell; its editability controls only the label portion.

General inline edit eligibility is limited to RG-owned operational item fields. Client is never editable. ServiceM8-owned and context fields are never editable. A user can edit only when both the field configuration enables editing and the existing Work Order Manage permission is granted.

Preserve the existing separation among View, Manage, and Configure permissions. Configure controls summary settings and billing-line exclusions. Manage controls item edits, bulk apply, manual labels, AI regeneration, and manual refresh. View remains read-only.

### Dashboard queries and presentation

Page by parent Work Orders, never by the joined item row count. First select the ordered parent page, then load the relevant active or filtered child items. This prevents jobs with many items from consuming extra pagination slots and avoids duplicate parent data.

Show five parent jobs per page by default. Allow 5, 10, 20, or 50. Place navigation at bottom centre and page-size selection at bottom right. Reset to page one when search, filters, sort, or page size changes.

Default ordering is Lead Score descending with null scores last and stable secondary ordering. Preserve the existing Sort control. Job-level sorts operate on parent fields. Item-level Importance and Risk sorts use the highest effective level among active items; Install Date ascending uses the earliest active-item date and descending uses the latest.

All parent groups start expanded on every page load. Each group can be collapsed independently. Collapse state is presentation-only and is not persisted in this release.

The parent header shows Job Number, Client, Address, item count, and Lead Score. The item grid uses the configured visible field order. The ServiceM8 line total excluding GST appears only in the immutable hover detail, never as a normal table column.

Retain Search, Importance, Risk, Stage, Hardware, Maintenance Program, Sort, and Reset. Filter controls for configurable fields appear only when Filterable is enabled. Search is always available and searches client, company, address, job number, job description, item code, effective short label, and original item description.

Parent-level search matches keep all otherwise eligible child items visible. Item-level search or item filters include the parent when at least one child matches, show only matching children, and display `matching count of total active items`. Clearing filters restores all active children. Show removed items is an explicit opt-in and never changes active counts.

### Editing and bulk changes

Render eligible item values as inline controls. Each field saves independently. During save, show Saving. On success, show Saved and record an audit event. On failure, restore the last persisted value, show a concise error, and provide retry without disturbing other item fields.

Bulk Apply to all items copies one selected field value to all active items in the current parent job after confirmation. It never affects removed items, never creates an ongoing linkage, respects field editability and Manage permission, and reports how many items changed.

Retire the job-level Manage Work Order form for these operational fields because it would create a second conflicting source of truth. The job detail page retains job summary, client context, contacts, and timeline, and shows the same item records and item events for detailed review.

### Export

Preserve CSV export and its current query parameters. Export one row per included Work Order Item, repeating parent Job Number, Client, Address, Lead Score, and other configured parent context. Include effective item label and operational item values. Respect active search, filters, sort, and Show removed items. A zero-item job exports one parent row with blank item fields so the active Work Order is not lost.

## Testing Decisions

The primary acceptance seam is one Playwright journey using controlled ServiceM8 and OpenAI adapters and a real test database:

1. Refresh a ServiceM8 `Work Order` job containing multiple item lines.
2. Confirm one parent job appears with every item expanded and the job is ordered by Lead Score.
3. Confirm the composite Item cell shows quantity, item code, and short label, with original description and total excluding GST in hover detail.
4. Change an editable item field and label, confirm auto-save feedback, reload, and confirm persistence and audit events.
5. Bulk-apply one field, then separate one item again and confirm values are independent.
6. Search and filter by an item value, confirm only matching children appear, confirm match count, then reset.
7. Move the ServiceM8 job out of `Work Order`, refresh, and confirm it leaves the active summary without deletion.
8. Return the job to `Work Order`, refresh, and confirm its manual label, item values, and audit history return.

Focused automated tests support that acceptance seam:

- ServiceM8 normalisation maps stable job/item UUIDs and read-only item fields.
- Billing-line exclusions are configurable, case-insensitive, counted, and do not suppress valid production lines.
- Atomic refresh leaves the last successful snapshot untouched when jobs, companies, or items fail or return invalid data.
- Reconciliation activates, removes, hides, and restores jobs and items without losing RG-owned fields.
- Empty jobs produce no placeholder item and remain visible.
- OpenAI label generation saves a valid first label, rejects malformed output, falls back safely, and never fails refresh.
- Manual label overrides survive routine refresh; source changes raise a review flag; deliberate regeneration replaces the label.
- Item update actions enforce Manage permission, field editability, valid option IDs, valid dates/levels, and audit writes.
- Bulk apply changes only active items, is atomic, and writes one audit event per actual change.
- Summary configuration normalisation preserves saved choices while adding Item and Editable defaults.
- Parent pagination counts jobs, not joined item rows, and uses 5/10/20/50 page sizes.
- Default sorting uses Lead Score descending with nulls last; item-derived sort aggregation is deterministic.
- Search and configured filters use the agreed parent-versus-child visibility rules.
- CSV export emits one row per item and respects active query state.
- Viewer, manager, and configurator permission combinations render and enforce the correct controls.
- Existing Work Order job detail, client context, contacts, timeline, refresh error, and access-control tests continue to pass.

Verification should run the focused Work Order Vitest suites, TypeScript/lint checks, the app-scoped web build, and the primary Playwright acceptance journey.

## Out of Scope

- Automatic or scheduled ServiceM8 refresh.
- Adding the spreadsheet V1 operational columns such as Product Type, Design Status, Glass Status, Site Ready, Overall Status, or Remarks.
- Editing ServiceM8 quantity, item code, original description, price, job number, client, address, or job status from RGTools.
- Showing item pricing as a normal dashboard column.
- Splitting one ServiceM8 item line into multiple RGTools Work Order Items.
- Migrating job-level RG operational values, because the current fields contain no business data.
- Permanently persisting job collapse state or personal filter presets.
- Writing item changes back to ServiceM8.
- Recreating spreadsheet backup sheets; database history and deployment rollback replace that mechanism.
- New Work Order AI Guidance beyond short-label generation.

## Risks & Rollout Notes

The largest data risk is treating a partial ServiceM8 response as truth and hiding valid work. The refresh boundary must validate all required datasets before one atomic reconciliation. Missing or invalid data produces a failed refresh and leaves the last successful dashboard unchanged.

The largest identity risk is matching by mutable job number or description. Match jobs and items by ServiceM8 UUID. Job number, item code, quantity, description, and price are refreshable attributes, not identities.

The largest AI risk is blocking refresh or overwriting staff wording. Commit ServiceM8 data before label generation, keep fallback labels, persist manual overrides, detect source changes, and require an explicit regeneration action to replace a manual label.

The largest query risk is row multiplication from joining parents and items before pagination. Page parent IDs first, then load children, and keep deterministic aggregation for configured item filters and sorts.

The largest UI risk is density. Default to five expanded jobs, use one composite Item column, honour configuration, and retain collapse, filters, search, and pagination. The accepted planning mockup is the visual regression reference.

Roll out through a schema-first migration that adds item and item-event persistence plus backward-compatible configuration properties. Keep legacy job-level operational columns during the first release for rollback, but stop exposing or writing them.

Deploy to staging, run a complete manual refresh, compare job/item/excluded counts with ServiceM8, inspect representative multi-item and zero-item jobs, exercise label generation and manual override, and run the agreed acceptance journey. Production rollout then starts with one manual refresh and operator verification of counts, last-sync time, score ordering, and a sample of item hover details.

If rollback is needed, restore the previous summary and refresh paths while retaining the new item tables. Because legacy job columns remain and item data is additive, application rollback does not require deleting item history. A later cleanup can remove legacy columns only after production stability is established.
