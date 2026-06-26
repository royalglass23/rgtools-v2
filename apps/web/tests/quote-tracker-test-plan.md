# Quote Tracker Test Plan

## Feature Overview

`/quote-tracker` is an authenticated dashboard module for creating tracked ServiceM8 quote links, viewing quote engagement, filtering tracked quotes, opening quote details, managing manual status overrides, and configuring optional email-gate recipients.

Primary route files:

- `app/(dashboard)/quote-tracker/page.tsx`
- `app/(dashboard)/quote-tracker/[id]/page.tsx`
- `app/(dashboard)/quote-tracker/layout.tsx`

Primary module files:

- `modules/quote-tracker/QuoteTableControls.tsx`
- `modules/quote-tracker/TrackQuoteButton.tsx`
- `modules/quote-tracker/EmailGateSettingsForm.tsx`
- `modules/quote-tracker/ExpireLinkButton.tsx`
- `modules/quote-tracker/actions.ts`
- `modules/quote-tracker/queries.ts`
- `modules/quote-tracker/list-filters.ts`

## Test Scope

- Route smoke test for `/quote-tracker`.
- Logged-out redirect behaviour.
- Allowed user access with the seeded/admin test user.
- Table/list visibility, columns, empty state, filters, search, reset, and pagination controls.
- Quote detail navigation when quote rows exist.
- Safe editable flows on a known test quote only.
- Validation for email-gate recipient emails when a known test quote is supplied.
- Destructive action cancel behaviour only, unless using known safe test data.
- Desktop and mobile layout checks for basic usability and horizontal overflow.

## Out Of Scope

- Creating real tracked quotes from ServiceM8 unless the environment is explicitly configured for test/demo jobs.
- Expiring, archiving, deleting, or cancelling real quotes.
- Production data mutation.
- Public quote viewer PDF rendering, Cloudflare worker telemetry, and ServiceM8 attachment webhook end-to-end coverage.
- Full dashboard regression beyond smoke checks for related links/counts.

## Manual Testing Checklist

1. Route smoke
   - [ ] Visit `/quote-tracker`.
   - [ ] Confirm `Quote Tracker` heading appears.
   - [ ] Confirm no page crash or blank screen.
   - [ ] Check browser console for errors.
   - [ ] Check critical document/fetch/XHR requests for 5xx failures.

2. Access and permissions
   - [ ] In a fresh browser context, visit `/quote-tracker`.
   - [ ] Confirm redirect to `/login`.
   - [ ] Log in as an allowed staff/admin user.
   - [ ] Confirm `/quote-tracker` loads.
   - [ ] Log in as a user without `quote-tracker` module access, if available.
   - [ ] Confirm restricted route redirects to `/?denied=quote-tracker`.
   - [ ] Confirm `Track Quote`, manual override, email-gate save, and expire actions are inaccessible to restricted users.

3. Page map
   - [ ] Record visible KPI cards: Hot quotes, Warm quotes, Cold quotes, Dead quotes, Total value, Avg interest, Forwarding flags.
   - [ ] Record controls: Search, Status, Link status, Sort, Page size, Apply, Reset, Previous, Next.
   - [ ] Record table columns: Client, Job address, Value, Status, Interest, Opens, Last opened, Link status, Link.
   - [ ] Record actions: Track Quote, Copy, quote row/detail links, How status is computed disclosure.
   - [ ] Record detail sections: Quote, Engagement, Viewers, Manual Status Override.
   - [ ] Record modals/dialogs: Track a quote.
   - [ ] Record confirmation dialogs: Expire link.

4. Data display
   - [ ] Confirm rows show client/customer, address/description, value, status, interest, opens, last opened, link status, and link action.
   - [ ] Confirm empty state: `No tracked quotes yet. Use the Track Quote button to create one.`
   - [ ] Confirm no duplicate visible row IDs/customer rows that look obviously broken.
   - [ ] Confirm currency and relative dates render sensibly.

5. Main happy path
   - [ ] Use a known safe quote such as `QT-TEST-001`, or set `E2E_TEST_QUOTE_ID`.
   - [ ] Open detail.
   - [ ] Change manual status.
   - [ ] Save.
   - [ ] Refresh.
   - [ ] Confirm the status persisted.
   - [ ] Revert to the original status.

6. Validation
   - [ ] On a safe test quote, enable Email gate.
   - [ ] Submit an invalid email.
   - [ ] Confirm `Enter valid recipient email addresses.` appears.
   - [ ] Submit blank recipients while enabled.
   - [ ] Confirm required validation or server validation appears.
   - [ ] Try long text and special characters in recipient field.
   - [ ] Confirm page does not crash.

7. Search/filter/sort/pagination
   - [ ] Search by quote number/short code.
   - [ ] Search by customer/client name.
   - [ ] Filter by Status.
   - [ ] Filter by Link status.
   - [ ] Sort by latest opened, client, value, and interest.
   - [ ] Change page size.
   - [ ] Test Previous/Next when enough data exists.
   - [ ] Test no-result state.
   - [ ] Reset filters.
   - [ ] Combine search plus status/link filters.

8. Edit/update actions
   - [ ] Manual status override saves and persists on a safe quote.
   - [ ] Email gate enabled saves and persists on a safe quote.
   - [ ] Email gate disabled clears recipients if intended.
   - [ ] Revert test data.

9. Destructive actions
   - [ ] Identify Expire action on active quote links.
   - [ ] Click Expire on a safe quote and cancel the browser confirmation.
   - [ ] Confirm the link remains active.
   - [ ] Only accept the confirmation for known demo/test data.

10. Error states
    - [ ] Simulate failed document/API request where possible.
    - [ ] Confirm no blank white screen.
    - [ ] Confirm expired/invalid session redirects to login.

11. Responsive testing
    - [ ] Desktop: 1440 x 900.
    - [ ] Tablet: 768 x 1024.
    - [ ] Mobile: 390 x 844.
    - [ ] Check filters, table, pagination, modal, and detail forms.
    - [ ] Report horizontal overflow or unreachable controls.

12. Regression
    - [ ] Dashboard quote counts still render.
    - [ ] Quote detail pages still render.
    - [ ] Inquiry-to-quote or lead-connected flows still work if connected.
    - [ ] Login/logout still works.
    - [ ] ServiceM8 quote creation/sync still works in a configured demo environment.

## MCP Exploration Prompts

- Open `http://127.0.0.1:3010/quote-tracker` in a fresh context. Snapshot the login redirect and list accessible controls.
- Log in with the local seeded admin test user. Snapshot `/quote-tracker` and list all headings, buttons, links, tables, filters, and dialogs without mutating data.
- Open the Track Quote dialog, snapshot the form, then click Cancel.
- Apply a no-result search such as `__no_quote_tracker_result__`, snapshot the empty state, then Reset.
- If visible rows exist, open the first quote detail page and snapshot sections/actions. Do not save changes.
- On mobile viewport `390x844`, snapshot `/quote-tracker` and note overflow or unusable controls.
- On a safe test quote only, trigger Expire and dismiss the confirmation dialog.

## Automated Playwright Tests To Create

- `/quote-tracker` redirects logged-out users to login.
- Authenticated `/quote-tracker` loads with heading, KPI labels, filter controls, and table headers.
- Smoke test captures console errors and failed critical network requests.
- Search no-result state works and can be reset.
- Status/link/sort/page-size filters update the URL and keep the table usable.
- Quote detail opens from the first row when rows exist.
- Track Quote dialog opens and cancel closes it without creating a quote.
- Expire action confirmation can be cancelled when an active safe row exists.
- Email-gate invalid email validation appears when `E2E_TEST_QUOTE_ID` is provided.
- Manual status update persists and reverts when `E2E_TEST_QUOTE_ID` is provided.
- Mobile viewport shows the core controls without body-level horizontal overflow.
- DB-backed lifecycle integration: creates a synthetic `QT-TEST-*` tracked quote, verifies active viewer/PDF access, records tracker events, verifies engagement aggregation, sends mocked open/high-intent notifications, expires the quote, runs cleanup archival, and verifies the viewer no longer serves the archived link.

## Risk Areas

- Local E2E tests depend on a real database and seeded user/module access.
- `Track Quote` calls ServiceM8 and can create real tracked quote records; automated tests should not submit it without an explicit test job.
- Manual status and email-gate forms mutate quote data; these tests must be opt-in against `E2E_TEST_QUOTE_ID`.
- `Expire` is destructive for real client links. Automated coverage should cancel the confirmation unless safe test data is guaranteed.
- The list table can be empty in fresh environments, so tests must accept both populated and empty states.
- NextAuth host/secret/env mismatches can make login fail even when credentials are valid.
- Current list copy links hardcode `https://quotes.royalglass.co.nz`; verify this matches intended environment behaviour before asserting link domains.
- Notification worker scans all eligible quotes by default. Integration tests must pass `TEST_QUOTE_ID` so mocked notification runs are scoped to synthetic test data only.
- Tracker events must include both `ip_hash` and `user_agent_hash`; the notifier ignores events without both values.

## Bug Report Template

Bug:

Area:

Steps:

Expected:

Actual:

Severity:

Likely cause:

Suggested fix:
