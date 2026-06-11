# MT-11 — Export 4 extra calculator fields to rgtools

> Agent brief. Read this entire file before writing any code. This is a **small, well-defined** change in the **cost-calculator repo only** (`./cost-calculator/`, a separate git repo).

## Context

The rgtools bridge (MT-5) imports calculator leads from a WordPress export endpoint. The rgtools-side mapper was enriched (already done) to fill **complexity** and a fuller **freeText** — but it reads four fields the export endpoint does not yet return, so right now:

- Complexity always defaults to `standard_non_custom` (because `needs_consult` never arrives)
- freeText omits subtotal, consultation notes, and height

This issue adds those four fields to the export output. That's the whole task.

## The exact change

**File:** `cost-calculator/wordpress-plugin/rg-calculator/includes/api.php`
**Function:** `rg_handle_export_leads` (around line 261), the `array_map` that builds each lead.

The query is already `SELECT * FROM {$wpdb->prefix}rg_leads` — every column is fetched, so **no query change is needed**. Only the returned array is missing keys. Add these four entries to the array (place them sensibly — `est_subtotal` next to `est_high`, the others wherever readable):

```php
            'est_subtotal'  => $r->est_subtotal,
            'needs_consult' => (int) $r->needs_consult,
            'consult_notes' => $r->consult_notes,
            'height'        => $r->height,
```

That is the entire code change. The four columns already exist in `wp_rg_leads`:
`needs_consult` TINYINT(1), `consult_notes` TEXT, `est_subtotal` DECIMAL(10,2), `height` VARCHAR(50) — confirm by reading `includes/database.php` `rg_create_leads_table`.

**Type match (already expected by the rgtools mapper — do not deviate):**
- `needs_consult` → integer (cast with `(int)`)
- `est_subtotal`, `consult_notes`, `height` → returned as-is (strings), exactly like `est_low`/`est_high` are returned raw

## Hard guardrails

- **PHP only. No bundle rebuild.** This does not touch the React app, `src/`, or `assets/rg-calculator.js`. Do NOT run `npm run build` — the live calculator JS is unaffected.
- **Additive only.** Do not remove, rename, or reorder existing keys in the export output (the rgtools mapper depends on the current ones). Only ADD the four.
- Read `cost-calculator/CLAUDE.md` first; its constraints bind all work in this repo.
- Do not change the export query, the permission callback, the `since_id`/`limit` logic, or any other endpoint.
- No new dependencies.
- Work on a feature branch in the cost-calculator repo (e.g. `mt-11-export-extra-fields`). Never commit to `main`.

## Stop and ask the human when

- Any of the four columns does NOT exist in `wp_rg_leads` per `database.php` (it should — if not, the schema is older than expected; stop).
- The export function looks different from "`SELECT *` + `array_map`" as described (someone changed it; stop and report what you see).
- You feel any urge to touch the React bundle, the submission path, or other endpoints.

## Deployment — IMPORTANT: this site uses symlink + git, NOT zip upload

The live plugin is symlinked on cPanel to a git clone of this repo. **Do NOT** build a zip or follow the "Compress-Archive / upload" steps in the repo's CLAUDE.md — those are legacy. The real deploy is human-only and looks like this (list it in your final report, do not attempt it):

1. Commit + push the PHP change to the cost-calculator remote.
2. On cPanel, in the symlinked clone: note the current SHA (`git rev-parse HEAD`), then `git pull` (or `git checkout <commit>`).
3. Because this is a pure additive PHP change (new read-only output keys, public form untouched), pulling it is low-risk — the live `/estimate` form and its JS bundle do not change.
4. Rollback if ever needed: `git reset --hard <previous-SHA>` on cPanel.

No `RG_CALC_VERSION` bump is needed (that constant cache-busts the JS/CSS bundle, which this change does not touch).

## Verification (after the human deploys, or against a local/staging WP)

The rgtools side already consumes these fields, so once the export returns them:
- A lead submitted with a consultation flag (e.g. fixing method `sed`, or substrate `not_sure`) sets `needs_consult = 1` → after import, the rgtools lead shows complexity **Minor custom work** instead of Standard.
- The rgtools lead's free-text notes include the subtotal, consultation notes, and height.

To verify without touching live: hit the export endpoint with the API key and confirm the JSON now contains the four keys:
```
curl -H "X-RG-Export-Key: <key>" "https://<wp-host>/wp-json/royal-glass/v1/export-leads?since_id=0&limit=3"
```

## Definition of done

- The four keys appear in the export JSON; existing keys unchanged.
- `npm run lint` passes in the cost-calculator repo (PHP isn't linted by it, but run it to be safe; there are no automated tests in this repo).
- Final report: the one-file diff, the human-only deploy steps (git pull on cPanel), and the verification curl output if you were able to run it.

## Note: MT-11's rgtools half is already DONE

The mapper, project-type dropdown, budget-band, and complexity logic are committed (`e9fab67`, `0966833` on the rgtools side). This brief covers ONLY the remaining WP export-field addition. Do not re-touch the rgtools mapper.
