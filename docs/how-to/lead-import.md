# Bulk Lead Import (Admin)

The bulk import lets you bring many existing jobs into the lead-scoring system at once, from a
spreadsheet, instead of typing each one into the [Lead Intake Form](lead-intake.md). It is an
**admin-only** tool and lives under **Administration → Lead Import** (`/admin/lead-import`).

Use it to score your existing book of jobs, or any batch of enquiries you already have in a
spreadsheet.

## How it works, in short

1. Download the template from the page.
2. Fill in one row per job (the dropdowns keep your entries valid).
3. Upload the filled file.
4. The page looks up each job in ServiceM8 by its Job Number and fills in the phone, email,
   and current status for you.
5. You review the rows, fix anything flagged, and click **Commit**. Each row is scored exactly
   like a lead entered by hand.

Nothing is saved until you click Commit, so you can upload, look, and adjust freely.

## Step 1 — Download the template

On the Lead Import page, click **Download template**. This gives you
`rgtools-lead-import-template.xlsx`, already set up with the right columns and dropdown lists.

> **Always start from this template.** It has the exact columns and the dropdown values the
> system expects. A spreadsheet with different columns or free-typed values may be rejected.

The template has three tabs:

- **How to use** — a short reminder of these steps.
- **Leads** — where you enter your jobs.
- **Lists** — hidden; it powers the dropdowns. Leave it alone.

## Step 2 — Fill in the jobs

Enter one job per row on the **Leads** tab. Columns with a red header and a `*` are required.

| Column | What to put |
|--------|-------------|
| **Job Number** \* | The ServiceM8 job number, e.g. `R260227`. Used to find the job and avoid duplicates. |
| **Client Name** \* | The customer or contact name. |
| **Company** | Company name, if any. |
| **Phone** | Leave blank — it's filled from ServiceM8. Only type one to override. |
| **Email** | Leave blank — it's filled from ServiceM8. Only type one to override. |
| **Job Address** \* | Full site address. Driving distance is worked out automatically. |
| **Client Type** \* | Pick from the dropdown. |
| **Budget Band** \* | Pick the band for the job's value. |
| **Complexity** \* | Pick from the dropdown. |
| **Price Sensitivity** \* | Pick from the dropdown. |
| **Decision Makers** | Optional — leave blank if unknown. |
| **Resource Consent** | Optional. |
| **Building Consent** | Optional. |
| **Building Stage** | Optional. |
| **Notes** | Anything extra. |

**For the dropdown columns, click the cell and choose from the list — don't type your own
wording.** The scores depend on these exact values.

When you're done:

- Delete the grey example row.
- **Save the file as `.xlsx`** (not the older `.xls`). In Excel or WPS: *File → Save As → Excel
  Workbook (.xlsx)*.

## Step 3 — Upload

Back on the Lead Import page, choose your saved file and upload it. The page reads every row and
then looks each job up in ServiceM8 by its Job Number to fill in:

- **Phone, mobile, email** — wherever you left them blank.
- **Current job status** — used to skip finished work (see below).
- **Project type** — worked out from the job's description (e.g. pool fence, shower,
  balustrade); falls back to "Other" if it can't tell.

If ServiceM8 can't be reached, or a Job Number doesn't match, that row still imports from your
spreadsheet — it's just marked **not enriched** so you know the contact details weren't filled.

## Step 4 — Review the grid

Every row appears in a review grid before anything is saved:

- **Flagged rows (red)** — a required field is missing or a value isn't recognised. Fix these
  (the dropdowns are editable right in the grid) before you can commit them.
- **"Needs contact" rows (amber)** — ServiceM8 had no phone or email for the job. Type a phone
  or email into the row before it can be committed.
- **Greyed rows** — automatically skipped. Either the job is **Completed** in ServiceM8 (a
  finished job isn't a live lead) or the Job Number was **already imported** before.
- **Normal rows** — ready to go. Each shows its tier and score preview.

Take a moment to check the judgment columns the spreadsheet couldn't decide for you — most
importantly **Client Type** (is this a repeat builder or a new one?). Adjust any in the grid.

## Step 5 — Commit

Click **Commit**. The system scores and saves each kept row as a lead, just like the intake
form. ServiceM8 is **not** emailed for these — the jobs already live there.

You'll get a summary:

- **Inserted** — new leads created.
- **Skipped (already imported)** — Job Numbers that already existed.
- **Skipped (completed)** — finished jobs left out.
- **Needs contact** — held back because they have no phone or email; add one and re-commit.
- **Not enriched** — imported, but ServiceM8 lookup didn't fill contact details.
- **Failed** — rows that couldn't be saved, with the reason.

The new leads now appear in the [Leads list](leads.md) and are scored and tiered.

## Tips & troubleshooting

- **"Please save as .xlsx"** — you uploaded an old `.xls` file. Re-save it as `.xlsx` and try
  again.
- **A value won't accept in a dropdown** — you typed instead of choosing. Clear the cell and
  pick from the list.
- **Phone/email came back empty** — that job's Job Number didn't match a ServiceM8 job, or the
  job has no contact saved. You can type them in the grid before committing.
- **Re-running an import is safe** — already-imported Job Numbers are skipped, so you won't
  create duplicates.
- **Missing some fields is fine** — leads import even with optional fields blank; they'll show a
  lower completeness and can be finished later from the lead's detail page.
