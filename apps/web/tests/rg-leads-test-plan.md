# RG Leads Manual Verification Checklist

Use safe synthetic RG Tools leads and known ServiceM8 test jobs only. Do not import or re-link live customer jobs unless the environment is explicitly configured for that test.

## Safe Test Data

- Synthetic lead names: `RG-LEADS-TEST Current`, `RG-LEADS-TEST Work Order`, `RG-LEADS-TEST Archived`.
- Safe job numbers: use known ServiceM8 test records, one in `Quote` status and one in `Work Order` or another non-Quote status.
- Cleanup: restore any archived synthetic leads you still need, then archive or delete synthetic leads created during the run. Do not leave test imports in the default Current Quotes view.

## Local Caveats

- ServiceM8 import, fetch, and re-link require local ServiceM8 credentials in `.env.local`.
- Google Places/autocomplete may show `RefererNotAllowedMapError` on localhost if the browser key is not allowed for the local origin; this does not block the RG Leads list/import checks.
- Avoid clicking Import against real jobs in production-like environments unless you have a safe test job number.

## Checklist

1. Default list visibility
   - Open `/leads` as a staff user.
   - Confirm **View** defaults to **Current Quotes**.
   - Confirm unlinked non-archived leads are visible.
   - Confirm linked `Quote` leads are visible.
   - Confirm linked non-Quote leads are not visible.

2. All statuses
   - Change **View** to **All statuses**.
   - Confirm non-archived Quote, unlinked, and non-Quote leads are visible.
   - Confirm archived leads are not visible.

3. Archived only
   - Open `/leads` as a non-admin user and confirm **Archived only** is not available.
   - Open `/leads` as an admin and select **Archived only**.
   - Confirm archived leads are visible and non-archived leads are not.

4. Read-only non-Quote detail
   - Open a linked non-Quote lead directly with `/leads/[id]`.
   - Confirm historical client, job, notes, scored fields, and ServiceM8 details remain visible.
   - Confirm the read-only banner explains ServiceM8 status is no longer Quote.
   - Confirm **Edit** is absent and the AI suggestion action is disabled or absent.
   - Confirm **Fetch from ServiceM8** is still available.

5. Fetch status refresh
   - On a linked lead, click **Fetch from ServiceM8**.
   - Confirm the stored ServiceM8 status updates after success.
   - If the refreshed status is non-Quote, reload and confirm the lead is read-only and leaves **Current Quotes**.

6. Non-Quote re-link rejection
   - On a linked lead, choose **Wrong job? Re-link**.
   - Enter a known non-Quote job number.
   - Confirm RG Tools shows a clear rejection and the existing ServiceM8 link stays unchanged.

7. Import success
   - On `/leads`, enter a known Quote job number in **Import from ServiceM8**.
   - Confirm RG Tools opens the lead detail page.
   - Confirm job UUID, job number, status, client/job context, address, and available phone/email are stored.
   - Confirm the lead starts as Needs scoring rather than an invented tier.

8. Import rejection
   - Enter a known non-Quote job number in **Import from ServiceM8**.
   - Confirm RG Tools rejects the import with a clear message and no editable lead record is created.

9. Existing-lead reuse
   - Import the same valid Quote job number a second time.
   - Confirm RG Tools opens the existing linked lead instead of creating a duplicate.

10. Missing-contact import
    - Import a safe Quote job whose job contact and company contact have no phone/email.
    - Confirm the lead is created.
    - Confirm the notes include the missing-contact import flag.

11. Restore
    - As admin, archive a synthetic lead.
    - Go to **Archived only** and click **Restore**.
    - Confirm the lead disappears from **Archived only**.
    - Confirm an unlinked or Quote restored lead appears in **Current Quotes**.
    - Confirm a non-Quote restored lead appears in **All statuses** but not **Current Quotes**.
