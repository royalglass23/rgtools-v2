# Leads Dashboard

The leads dashboard is at `/leads`. It shows every lead that has been submitted through the intake form, along with its tier, score, and ServiceM8 sync status.

## The leads list

### Columns

| Column | Description |
|--------|-------------|
| **Date** | When the lead was submitted |
| **Client** | Client name (and company, if set) |
| **Job Address** | The project address |
| **Project** | Project type (pool fence, shower, etc.) |
| **Tier** | A (green) · B (blue) · C (yellow) · D (grey) |
| **Score** | Raw score out of 100 |
| **SM8** | ServiceM8 link status — see below |
| **Completeness** | Percentage of scored fields filled in |

Click any row to open the lead detail page.

### SM8 status badges

| Badge | Meaning |
|-------|---------|
| **Linked** (green) | A matching ServiceM8 job has been found and linked |
| **Pending** (amber) | Email sent to ServiceM8 inbox, job not yet fetched |
| **Failed** (red) | The inbox email failed to send |

### Filters

Use the filter bar at the top of the list to narrow results:

- **Tier** — show only A, B, C, or D leads
- **SM8** — show only Linked, Pending, or Failed leads
- **Date** — last 7 days, last 30 days (default), or all time
- **Page size** — 10 (default), 20, 50, or 100 rows per page

Filters apply immediately when you change a dropdown. Pagination resets to page 1 when any filter changes.

### Bulk delete (admin only)

Admins see a checkbox on each row. Select one or more leads and click **Delete selected** — a confirmation dialog will ask you to confirm. Deleted leads are soft-deleted (archived) and disappear from the list.

## Lead detail page

Click a lead in the list to open its full detail view at `/leads/[id]`.

The detail page is read-only. It shows:

- **Client** — name, company, phone, email
- **Lead** — job address, driving distance, project type, source, free-text notes
- **Scored Fields** — a table showing each scoring category, the selected answer, and the points earned
- **Score Summary** — tier, total score, completeness, flag note (if any strike fired), and the plain-English score reason
- **ServiceM8** — current link status and the **Fetch from ServiceM8** button

### Edit a lead

Click the **Edit** button at the top right to open the intake form pre-filled with this lead's data. A "Reason for edit" field is required before saving. See [Lead Intake](lead-intake.md#editing-an-existing-lead) for details.

### Delete a lead (admin only)

Admins see a **Delete** button beside Edit. Clicking it shows a confirmation dialog. Confirmed deletes are soft-deletes — the lead is archived and no longer appears in the list.

## Fetching from ServiceM8

When a lead is submitted, an email is sent to the ServiceM8 inbox with an `RGTools Lead {id}` reference in the body. ServiceM8 creates a job from this email.

Once the job exists in ServiceM8, click **Fetch from ServiceM8** on the detail page. The button:

1. Searches all ServiceM8 jobs for one whose description contains `RGTools Lead {leadId}`
2. Stores the job UUID and current status
3. On the **first** successful fetch, writes the lead tier to the "Leads Quality" custom field on the ServiceM8 job (e.g. "Leads Quality B")
4. On subsequent fetches, just refreshes the job status — the Leads Quality field is not overwritten

The button shows a status message after each fetch:
- "ServiceM8 job linked and Leads Quality set." — first successful link
- "ServiceM8 job details refreshed." — subsequent fetch on an already-linked lead
- "No matching job found in ServiceM8 yet" — the job hasn't appeared in ServiceM8 yet; try again in a minute
