# ROY-5 — Execute calculator→rgtools bridge plan

> Agent brief. Read this entire file before writing any code. The full implementation plan with complete code is embedded at the bottom — execute it task-by-task in order.

## Context (read first)

- **rgtools** (this repo): Next.js 15 App Router + Drizzle ORM + Neon Postgres + Vitest. Internal ops tool for Royal Glass (NZ frameless glass company). Lead intake, lead scoring, quote tracking, ServiceM8 integration.
- **cost-calculator** (`./cost-calculator/` inside this folder; it is a SEPARATE git repo): React/Vite SPA delivered as a WordPress plugin shortcode on royalglass.co.nz. Public customers get price estimates and submit leads. The WP plugin saves leads to a `wp_rg_leads` MySQL table and currently emails ServiceM8 directly.
- **Goal of this work:** calculator leads currently never reach rgtools. After this work, rgtools pulls them from WordPress, dedupes clients, scores them, and takes over the ServiceM8 inbox email. The public form path is NOT modified.

## Pre-flight (do these before task 1)

1. Read `cost-calculator/CLAUDE.md` in full. Its "Non-negotiable constraints" section is binding for tasks 1–2.
2. Run `npm run test:run` in rgtools root — all tests must pass BEFORE you change anything. If they don't, STOP and report; do not fix unrelated failures.
3. Work on a branch: `roy-5-calculator-bridge` (rgtools). Never commit to `main`.
4. **Check whether `cost-calculator/.git` exists** (the folder is a nested, separate repo when cloned; it may instead be a plain copy):
   - **If `.git` exists:** treat it as its own repo — create a feature branch there (`roy-5-bridge`) and make the calculator-side commits in it, never to its `main`.
   - **If `.git` does NOT exist (plain copy):** calculator-side commits are impossible — skip them. Make the file edits anyway and list every changed cost-calculator file (full paths) in your final report so the human can apply them to the real repo.
   - Either way: do NOT `git init` inside it, and do NOT commit cost-calculator files into the rgtools repo (it is gitignored there).
5. DB-backed integration tests are opt-in: the default `npm run test:run` skips them (hermetic). You do not need DB access for the baseline. (`RUN_DB_TESTS=1` enables them — only run that if you have a reachable DATABASE_URL.)

## Hard guardrails (violating any of these = failed task)

- **Never modify the public form submission flow** in the WP plugin beyond adding the `timeframe` field to the existing payload. No webhooks, no external calls, no n8n in the submission path.
- **Never reintroduce** Tailwind classNames, Supabase, Cloudflare Workers, or direct ServiceM8 API calls in the cost-calculator repo (see its CLAUDE.md).
- **Never expose secrets to the browser**: `RG_EXPORT_API_KEY`, `CALCULATOR_IMPORT_SECRET`, ServiceM8 keys stay server-side only.
- **Do not run `npm run db:migrate`** without stopping to ask — `DATABASE_URL` may point at the live Neon database. Generate the migration (`npm run db:generate`), show it, and ask before applying.
- **Do not refactor anything outside the files named in the plan.** If a file you touch looks like it needs cleanup, note it in your final report instead.
- **Do not add new npm dependencies.** Everything needed exists.
- **TDD where the plan says TDD**: write the failing test, see it fail, implement, see it pass. Do not skip the failing-test step.
- **Calculator contact-consent must NOT be mapped to `consentStatus`** (that field is building/resource consent, scoring category 3). The plan encodes this — do not "fix" it.

## Stop and ask the human when

- Any existing test fails for reasons unrelated to your change.
- `persistLeadScore`'s actor parameter type forces changes beyond widening `string` → `string | null` (plan Task 4 flags this).
- The existing servicem8-fetch test file's mocking pattern doesn't accommodate the new `createdAt` field cleanly (plan Task 9 flags this).
- You're tempted to change the shape of `LeadIntakeInput` beyond adding the optional fields specified.
- Anything requires a value not in the plan (env var names, table names, etc. are all specified — if something is missing, that's a plan gap; ask, don't invent).

## Human-only steps — do NOT attempt these; list them in your final report

- Defining `RG_EXPORT_API_KEY` in the live site's `wp-config.php`
- Uploading the rebuilt plugin zip to WordPress/Bluehost
- Setting rgtools production env vars (`CALCULATOR_WP_EXPORT_URL`, `CALCULATOR_WP_EXPORT_KEY`, `CALCULATOR_IMPORT_SECRET`)
- Creating the n8n workflow on the Mac Mini
- Commenting out `RG_SM8_INBOX_EMAIL` in wp-config (cutover step — only after the human verifies imports work)
- Running `npm run db:migrate` (see guardrails — ask first)

## Definition of done

- All 9 plan tasks complete, each committed separately with the commit messages given in the plan.
- `npm run test:run` passes in rgtools; `npm run lint` passes in both repos; `npx tsc --noEmit` passes in rgtools.
- Calculator repo: `npm run build` succeeds and dist assets copied per its CLAUDE.md deploy section (do NOT copy .jpg files).
- Final report lists: commits made, human-only steps remaining, and any flagged concerns.

---

# THE PLAN (execute task-by-task)
**Goal:** Every cost-calculator submission lands in rgtools (Neon) as a scored lead, deduped against existing clients, with rgtools taking over the ServiceM8 inbox email so the existing fetch-button linking works for calculator leads.

**Architecture:** Pull model — `wp_rg_leads` (WordPress, already exists) acts as the durable queue. rgtools exposes a Bearer-secured API route that pulls new leads from a key-secured WP export endpoint, maps them to `LeadIntakeInput`, and runs them through the existing `submitLeadIntakeForUser` pipeline (client dedup + scoring + ServiceM8 sync, all free). n8n on the Mac Mini calls the rgtools route on a schedule. The public form submission path is **not modified** (cost-calculator CLAUDE.md constraint: no external webhook during public form submission).

**Tech Stack:** WordPress plugin PHP (calculator repo), Next.js 15 App Router + Drizzle + Neon + Vitest (rgtools repo).

**Two repos:** Tasks 1–2 are in `cost-calculator/` (separate git repo, currently copied into this folder). Tasks 3–9 are in rgtools. Commit in the repo you're editing.

**Idempotency:** generic `leads.external_ref` text column (unique), value `calculator:<wp_id>` for this channel. Future channels reuse the same column (`email:<message-id>`, `wechat:<msg-id>`, `phone:<call-id>`) — no schema change ever needed per channel. The calculator importer polls with `since_id` parsed from the max calculator ref.

**Future channels (email / WeChat / SMS / phone):** every other channel is push-based — n8n receives the message, AI-extracts fields, and calls `submitLeadIntakeForUser` via a generic Bearer-secured ingest route. That route is purely additive (new file, no changes to anything in this plan); it is deliberately NOT built now (YAGNI — build it with the first real channel). The per-channel work later is: an n8n workflow + a mapper. Zero schema changes, zero refactors of this bridge. The `source` enum already contains `phone | email | wechat | calculator | contact_form | other`.

**Known v1 limitation (accepted):** if lead N fails to import and lead N+1 succeeds, `since_id` advances past N and it is not retried automatically. Failures are returned in the API response so n8n can alert; staff re-enter manually. Revisit only if failures actually occur.

**New env/config:**
| Where | Name | Value |
|---|---|---|
| `wp-config.php` | `RG_EXPORT_API_KEY` | long random string (e.g. `openssl rand -hex 32`) |
| rgtools `.env` | `CALCULATOR_WP_EXPORT_URL` | `https://royalglass.co.nz/wp-json/royal-glass/v1/export-leads` |
| rgtools `.env` | `CALCULATOR_WP_EXPORT_KEY` | same value as `RG_EXPORT_API_KEY` |
| rgtools `.env` | `CALCULATOR_IMPORT_SECRET` | long random string for the n8n → rgtools Bearer auth |

---

### Task 1: WP — stop dropping the `timeframe` field

The form validates `timeframe` as required but never sends it; `wp_rg_leads` has no column for it. rgtools maps it to `leads.timeline`.

**Files:**
- Modify: `cost-calculator/src/components/wizard/LeadCapture.tsx` (payload, ~line 167)
- Modify: `cost-calculator/wordpress-plugin/rg-calculator/includes/validation.php` (`rg_sanitize_lead`)
- Modify: `cost-calculator/wordpress-plugin/rg-calculator/includes/database.php` (column + save)

- [ ] **Step 1: Add `timeframe` to the submit payload**

In `LeadCapture.tsx`, inside `handleSubmit`, add one line to `payloadLead`:

```ts
      const payloadLead = {
        firstName: firstName ?? '',
        lastName: restNames.join(' ').trim(),
        phone: lead.phone,
        email: lead.email,
        customerType: lead.customerType ?? '',
        timeframe: lead.timeframe ?? '',
        address: lead.address,
        callPreference: 'anytime',
        notes: lead.notes.trim(),
        consent: lead.consent,
        websiteUrl: honeypotRef.current?.value ?? '',
      };
```

- [ ] **Step 2: Sanitize it server-side**

In `validation.php`, `rg_sanitize_lead`, add the allowed list and key:

```php
function rg_sanitize_lead(array $lead): array {
    $consented     = !empty($lead['consent']);
    $allowed_types = ['homeowner', 'builder', 'developer', 'architect', 'pool_builder', 'other'];
    $raw_type      = sanitize_text_field($lead['customerType'] ?? '');
    $allowed_timeframes = ['asap', '1_3_months', '3_6_months', '6_plus_months', 'just_planning'];
    $raw_timeframe = sanitize_text_field($lead['timeframe'] ?? '');
    return [
        'firstName'      => sanitize_text_field($lead['firstName']   ?? ''),
        'lastName'       => sanitize_text_field($lead['lastName']    ?? ''),
        'phone'          => sanitize_text_field($lead['phone']       ?? ''),
        'email'          => sanitize_email($lead['email']            ?? ''),
        'customerType'   => in_array($raw_type, $allowed_types, true) ? $raw_type : '',
        'timeframe'      => in_array($raw_timeframe, $allowed_timeframes, true) ? $raw_timeframe : '',
        'address'        => sanitize_text_field($lead['address']     ?? ''),
        'callPreference' => sanitize_text_field($lead['callPreference'] ?? 'anytime'),
        'notes'          => sanitize_textarea_field($lead['notes']   ?? ''),
        'consentGiven'   => $consented ? 1 : 0,
        'consentedAt'    => $consented ? current_time('mysql') : null,
    ];
}
```

- [ ] **Step 3: Add the column + save it**

In `database.php`:

1. Bump the version constant: `define('RG_DB_VERSION', '2.5.0');`
2. Add a migration block alongside the existing ones in `rg_create_leads_table`:

```php
    if (!in_array('timeframe', $existing, true)) {
        $wpdb->query("ALTER TABLE {$table} ADD COLUMN timeframe VARCHAR(30) NOT NULL DEFAULT '' AFTER customer_type");
    }
```

3. In `rg_save_lead`, add `'timeframe' => $l['timeframe'],` directly after the `'customer_type'` line, and add one `'%s'` to the format array directly after the `customer_type` `'%s'` (4th position from start: status, first, last, phone, email, customer_type, **timeframe**, ... — count carefully, the format array is positional).

- [ ] **Step 4: Build + deploy bundle**

```bash
cd cost-calculator && npm run build
cp dist/rg-calculator.js  wordpress-plugin/rg-calculator/assets/
cp dist/rg-calculator.css wordpress-plugin/rg-calculator/assets/
```

```powershell
Compress-Archive -Path wordpress-plugin\rg-calculator -DestinationPath wordpress-plugin\rg-calculator.zip -Force
```

- [ ] **Step 5: Manual verify (after WP upload)**

Submit a test lead on the live form (as logged-in admin to bypass rate limit), then check WP Admin → RG Calculator → Leads: the new row should show the timeframe. (DB migration runs automatically on the next wp-admin page load via `rg_maybe_migrate_db`.)

- [ ] **Step 6: Commit (calculator repo)**

```bash
git add src/components/wizard/LeadCapture.tsx wordpress-plugin/rg-calculator/includes/validation.php wordpress-plugin/rg-calculator/includes/database.php
git commit -m "fix: persist timeframe field (was validated but dropped)"
```

---

### Task 2: WP — secured export endpoint

**Files:**
- Modify: `cost-calculator/wordpress-plugin/rg-calculator/includes/api.php`

- [ ] **Step 1: Register the route**

In `rg_register_routes()`, add:

```php
    // GET /wp-json/royal-glass/v1/export-leads  (rgtools bridge — API-key secured)
    register_rest_route('royal-glass/v1', '/export-leads', [
        'methods'             => 'GET',
        'callback'            => 'rg_handle_export_leads',
        'permission_callback' => 'rg_export_leads_permission',
    ]);
```

- [ ] **Step 2: Add permission + handler**

Add at the end of `api.php`:

```php
// ── GET /export-leads (rgtools bridge) ────────────────────────────────────────

function rg_export_leads_permission(WP_REST_Request $request): bool {
    if (!defined('RG_EXPORT_API_KEY') || !RG_EXPORT_API_KEY) return false;
    $provided = (string) ($request->get_header('X-RG-Export-Key') ?? '');
    return $provided !== '' && hash_equals(RG_EXPORT_API_KEY, $provided);
}

function rg_handle_export_leads(WP_REST_Request $request): WP_REST_Response {
    global $wpdb;
    $since_id = max(0, (int) $request->get_param('since_id'));
    $limit    = min(100, max(1, (int) ($request->get_param('limit') ?: 50)));

    $rows = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM {$wpdb->prefix}rg_leads WHERE id > %d ORDER BY id ASC LIMIT %d",
        $since_id, $limit
    ));

    $leads = array_map(static function ($r) {
        return [
            'id'            => (int) $r->id,
            'status'        => $r->status,
            'first_name'    => $r->first_name,
            'last_name'     => $r->last_name,
            'phone'         => $r->phone,
            'email'         => $r->email,
            'customer_type' => $r->customer_type,
            'timeframe'     => $r->timeframe ?? '',
            'address'       => $r->address,
            'call_pref'     => $r->call_pref,
            'notes'         => $r->notes,
            'project_type'  => $r->project_type,
            'length_m'      => (int) $r->length_m,
            'corners'       => (int) $r->corners,
            'gates'         => (int) $r->gates,
            'fixing_method' => $r->fixing_method,
            'substrate'     => $r->substrate ?? '',
            'hardware'      => $r->hardware,
            'est_low'       => $r->est_low,
            'est_high'      => $r->est_high,
            'consent_given' => (int) $r->consent_given,
            'created_at'    => $r->created_at,
        ];
    }, $rows ?: []);

    return new WP_REST_Response(['ok' => true, 'leads' => $leads], 200);
}
```

Notes: read-only endpoint, key compared with `hash_equals` (timing-safe), no Turnstile/honeypot needed (not a public browser endpoint). This satisfies the repo constraint that Turnstile guards every *public* POST — this is neither public nor a POST.

- [ ] **Step 3: Define the key in `wp-config.php` (live site, manual)**

```php
define('RG_EXPORT_API_KEY', '<output of: openssl rand -hex 32>');
```

- [ ] **Step 4: Re-zip, upload, curl test**

```powershell
Compress-Archive -Path wordpress-plugin\rg-calculator -DestinationPath wordpress-plugin\rg-calculator.zip -Force
```

After upload:

```bash
# No key → 401/403
curl -i "https://royalglass.co.nz/wp-json/royal-glass/v1/export-leads?since_id=0"
# With key → {"ok":true,"leads":[...]}
curl -i -H "X-RG-Export-Key: <key>" "https://royalglass.co.nz/wp-json/royal-glass/v1/export-leads?since_id=0&limit=5"
```

- [ ] **Step 5: Commit (calculator repo)**

```bash
git add wordpress-plugin/rg-calculator/includes/api.php
git commit -m "feat: add key-secured export-leads endpoint for rgtools bridge"
```

---

### Task 3: rgtools — generic `external_ref` column

One column serves idempotency for ALL current and future channels. Calculator refs are `calculator:<wp_id>`; future channels use their own prefix.

**Files:**
- Modify: `drizzle/schema-leads.ts:54-88` (leads table)

- [ ] **Step 1: Add the column to the schema**

In the `leads` table definition, after the `source` line, add:

```ts
  externalRef: text('external_ref'),
```

And in the index list at the bottom of the table (the `(t) => [...]` array), add:

```ts
  uniqueIndex('leads_external_ref_uq').on(t.externalRef),
```

(`uniqueIndex` is already imported in this file. Postgres unique indexes allow multiple NULLs, so manually-entered leads with no external origin are unaffected.)

- [ ] **Step 2: Generate + run the migration**

```bash
npm run db:generate
npm run db:migrate
```

Expected: a new SQL file in `drizzle/migrations/` containing `ALTER TABLE "leads" ADD COLUMN "external_ref" text` and the unique index; migrate applies cleanly.

- [ ] **Step 3: Run existing tests**

Run: `npm run test:run`
Expected: PASS (schema addition is non-breaking).

- [ ] **Step 4: Commit**

```bash
git add drizzle/schema-leads.ts drizzle/migrations
git commit -m "feat: add generic external_ref idempotency column to leads"
```

---

### Task 4: rgtools — extend the intake action (timeline, externalRef, nullable actor)

**Files:**
- Modify: `modules/lead-intake/actions.ts`
- Modify: `modules/lead-intake/intake-utils.ts`

- [ ] **Step 1: Extend `LeadIntakeInput`**

In `actions.ts`, add two optional fields to the type (after `source`):

```ts
  source: 'phone' | 'email' | 'wechat' | 'calculator' | 'contact_form' | 'other'
  timeline?: string
  externalRef?: string
  freeText?: string
```

- [ ] **Step 2: Allow a null actor**

Change the signature of `submitLeadIntakeForUser`:

```ts
export async function submitLeadIntakeForUser(
  input: LeadIntakeInput,
  actorId: string | null,
): Promise<LeadIntakeResult> {
```

Both `createdBy` and `auditLog.actorId` are nullable columns (the ServiceM8 sync module already writes `actorId: null`), so no other change is needed for the insert — but verify the two places `actorId` is used in this function (`createdBy: actorId` in the lead insert, `actorId` in the audit insert) compile with the wider type. `persistLeadScore(leadId, actorId)` — check its signature; if it requires `string`, widen it the same way (it writes audit/score rows whose actor columns are nullable).

- [ ] **Step 3: Persist the new fields**

In the **update** branch (`tx.update(leads).set({...})`), add:

```ts
          timeline: normalized.timeline || null,
```

In the **insert** branch (`tx.insert(leads).values({...})`), add:

```ts
          timeline: normalized.timeline || null,
          externalRef: normalized.externalRef || null,
```

In `intake-utils.ts` `normalizeInput`, add to the returned object:

```ts
    timeline: input.timeline?.trim() || '',
    externalRef: input.externalRef?.trim() || '',
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npm run test:run && npx tsc --noEmit`
Expected: PASS. The existing `submitLeadIntake` caller passes a `string` actorId, which still satisfies `string | null`.

- [ ] **Step 5: Commit**

```bash
git add modules/lead-intake/actions.ts modules/lead-intake/intake-utils.ts
git commit -m "feat: intake accepts timeline, externalRef, and system (null) actor"
```

---

### Task 5: rgtools — WP lead mapper (TDD)

Pure function: WP row → `LeadIntakeInput`.

**Files:**
- Create: `modules/lead-intake/calculator/map-wp-lead.ts`
- Test: `modules/lead-intake/calculator/__tests__/map-wp-lead.test.ts`

Mapping decisions (locked during planning):
- `customer_type` → `clientProfileKey`: `homeowner→homeowner`; `builder|developer|architect|pool_builder→new_business`; `other`/unknown → `''` (staff classifies later). Valid keys per active scoring config v3: `repeat_builder, existing_business, new_business, homeowner, landlord`.
- Business customer types also copy the full name into `companyName` (the calculator's single "Full name / Company name" field can't be split reliably).
- Calculator contact-consent is **NOT** mapped to `consentStatus` (that's building-consent, scoring category 3) — it goes into freeText only.
- Wizard answers + estimate → structured `freeText` block.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { mapWpLeadToIntakeInput, type WpCalculatorLead } from '../map-wp-lead'

const baseWpLead: WpCalculatorLead = {
  id: 42,
  status: 'NEW',
  first_name: 'Sarah',
  last_name: 'Johnson',
  phone: '021 123 4567',
  email: 'sarah@example.com',
  customer_type: 'homeowner',
  timeframe: '1_3_months',
  address: '12 Beach Rd, Takapuna, Auckland',
  call_pref: 'anytime',
  notes: 'pool fence needs a self-closing gate',
  project_type: 'premium_pool_fence',
  length_m: 12,
  corners: 2,
  gates: 1,
  fixing_method: 'spigot_round',
  substrate: 'concrete',
  hardware: 'matte_black',
  est_low: '4100.00',
  est_high: '5400.00',
  consent_given: 1,
  created_at: '2026-06-10 09:30:00',
}

describe('mapWpLeadToIntakeInput', () => {
  it('maps a homeowner lead', () => {
    const input = mapWpLeadToIntakeInput(baseWpLead)

    expect(input.clientName).toBe('Sarah Johnson')
    expect(input.companyName).toBe('')
    expect(input.phone).toBe('021 123 4567')
    expect(input.email).toBe('sarah@example.com')
    expect(input.clientProfileKey).toBe('homeowner')
    expect(input.projectType).toBe('premium_pool_fence')
    expect(input.location).toBe('12 Beach Rd, Takapuna, Auckland')
    expect(input.source).toBe('calculator')
    expect(input.timeline).toBe('1_3_months')
    expect(input.externalRef).toBe('calculator:42')
    expect(input.consentStatus).toBeUndefined()
  })

  it('copies the name into companyName for business customer types', () => {
    const input = mapWpLeadToIntakeInput({ ...baseWpLead, customer_type: 'builder', first_name: 'Smith', last_name: 'Builders Ltd' })

    expect(input.clientName).toBe('Smith Builders Ltd')
    expect(input.companyName).toBe('Smith Builders Ltd')
    expect(input.clientProfileKey).toBe('new_business')
  })

  it('leaves clientProfileKey empty for unknown customer types', () => {
    expect(mapWpLeadToIntakeInput({ ...baseWpLead, customer_type: 'other' }).clientProfileKey).toBe('')
    expect(mapWpLeadToIntakeInput({ ...baseWpLead, customer_type: '' }).clientProfileKey).toBe('')
  })

  it('builds a freeText summary with estimate, project details, and consent', () => {
    const freeText = mapWpLeadToIntakeInput(baseWpLead).freeText ?? ''

    expect(freeText).toContain('WP lead #42')
    expect(freeText).toContain('$4100.00 – $5400.00')
    expect(freeText).toContain('premium_pool_fence, 12m, 2 corner(s), 1 gate(s)')
    expect(freeText).toContain('spigot_round')
    expect(freeText).toContain('Contact consent: yes')
    expect(freeText).toContain('pool fence needs a self-closing gate')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run modules/lead-intake/calculator`
Expected: FAIL — cannot resolve `../map-wp-lead`.

- [ ] **Step 3: Implement the mapper**

```ts
import type { LeadIntakeInput } from '../actions'

export type WpCalculatorLead = {
  id: number
  status: string
  first_name: string
  last_name: string
  phone: string
  email: string
  customer_type: string
  timeframe: string
  address: string
  call_pref: string
  notes: string
  project_type: string
  length_m: number
  corners: number
  gates: number
  fixing_method: string
  substrate: string
  hardware: string
  est_low: string
  est_high: string
  consent_given: number
  created_at: string
}

const CLIENT_PROFILE_BY_CUSTOMER_TYPE: Record<string, string> = {
  homeowner: 'homeowner',
  builder: 'new_business',
  developer: 'new_business',
  architect: 'new_business',
  pool_builder: 'new_business',
}

const BUSINESS_CUSTOMER_TYPES = new Set(['builder', 'developer', 'architect', 'pool_builder'])

export function mapWpLeadToIntakeInput(wp: WpCalculatorLead): LeadIntakeInput {
  const clientName = `${wp.first_name} ${wp.last_name}`.trim()

  return {
    clientName,
    companyName: BUSINESS_CUSTOMER_TYPES.has(wp.customer_type) ? clientName : '',
    phone: wp.phone,
    email: wp.email,
    clientProfileKey: CLIENT_PROFILE_BY_CUSTOMER_TYPE[wp.customer_type] ?? '',
    projectType: wp.project_type,
    location: wp.address,
    source: 'calculator',
    timeline: wp.timeframe || '',
    externalRef: `calculator:${wp.id}`,
    freeText: buildFreeText(wp),
  }
}

function buildFreeText(wp: WpCalculatorLead): string {
  const lines = [
    `[Calculator] WP lead #${wp.id}, submitted ${wp.created_at}`,
    `Estimate: $${wp.est_low} – $${wp.est_high}`,
    `Project: ${wp.project_type}, ${wp.length_m}m, ${wp.corners} corner(s), ${wp.gates} gate(s)`,
    `Fixing: ${wp.fixing_method || 'not specified'} | Substrate: ${wp.substrate || 'not specified'} | Hardware: ${wp.hardware || 'not specified'}`,
    `Customer type: ${wp.customer_type || 'not specified'} | Call preference: ${wp.call_pref}`,
    `Contact consent: ${wp.consent_given ? 'yes' : 'no'}`,
  ]
  if (wp.notes) lines.push(`Notes: ${wp.notes}`)
  return lines.join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run modules/lead-intake/calculator`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add modules/lead-intake/calculator
git commit -m "feat: map WP calculator leads to LeadIntakeInput"
```

---

### Task 6: rgtools — importer (TDD)

**Files:**
- Create: `modules/lead-intake/calculator/import-calculator-leads.ts`
- Test: `modules/lead-intake/calculator/__tests__/import-calculator-leads.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importCalculatorLeads } from '../import-calculator-leads'
import type { WpCalculatorLead } from '../map-wp-lead'

const wpLead = (id: number): WpCalculatorLead => ({
  id,
  status: 'NEW',
  first_name: 'Sarah',
  last_name: 'Johnson',
  phone: '021 123 4567',
  email: `sarah${id}@example.com`,
  customer_type: 'homeowner',
  timeframe: 'asap',
  address: '12 Beach Rd, Takapuna',
  call_pref: 'anytime',
  notes: '',
  project_type: 'ground_level',
  length_m: 8,
  corners: 0,
  gates: 0,
  fixing_method: 'spigot_round',
  substrate: 'concrete',
  hardware: 'standard_chrome',
  est_low: '2200.00',
  est_high: '2900.00',
  consent_given: 1,
  created_at: '2026-06-10 09:30:00',
})

function fetchFnReturning(leads: WpCalculatorLead[], ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({ ok: true, leads }),
  }) as unknown as typeof fetch
}

beforeEach(() => {
  process.env.CALCULATOR_WP_EXPORT_URL = 'https://example.com/wp-json/royal-glass/v1/export-leads'
  process.env.CALCULATOR_WP_EXPORT_KEY = 'export-key'
})

describe('importCalculatorLeads', () => {
  it('fetches since the max imported id and submits each lead with a null actor', async () => {
    const fetchFn = fetchFnReturning([wpLead(7), wpLead(8)])
    const submitFn = vi.fn().mockResolvedValue({ success: true, leadId: 'lead-uuid' })

    const summary = await importCalculatorLeads({ limit: 10 }, {
      fetchFn,
      submitFn,
      getSinceId: async () => 6,
    })

    expect(fetchFn).toHaveBeenCalledWith(
      'https://example.com/wp-json/royal-glass/v1/export-leads?since_id=6&limit=10',
      { headers: { 'X-RG-Export-Key': 'export-key' } },
    )
    expect(submitFn).toHaveBeenCalledTimes(2)
    expect(submitFn.mock.calls[0][0].externalRef).toBe('calculator:7')
    expect(submitFn.mock.calls[0][1]).toBeNull()
    expect(summary).toMatchObject({ fetched: 2, imported: 2, failed: 0 })
  })

  it('records per-lead failures without aborting the batch', async () => {
    const fetchFn = fetchFnReturning([wpLead(7), wpLead(8)])
    const submitFn = vi.fn()
      .mockResolvedValueOnce({ error: 'Phone or email is required.' })
      .mockResolvedValueOnce({ success: true, leadId: 'lead-uuid' })

    const summary = await importCalculatorLeads({}, { fetchFn, submitFn, getSinceId: async () => 0 })

    expect(summary.fetched).toBe(2)
    expect(summary.imported).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.results[0]).toMatchObject({ wpLeadId: 7, ok: false, error: 'Phone or email is required.' })
  })

  it('throws when the WP endpoint rejects', async () => {
    const fetchFn = fetchFnReturning([], false, 403)

    await expect(
      importCalculatorLeads({}, { fetchFn, submitFn: vi.fn(), getSinceId: async () => 0 }),
    ).rejects.toThrow('HTTP 403')
  })

  it('throws when env vars are missing', async () => {
    delete process.env.CALCULATOR_WP_EXPORT_URL

    await expect(
      importCalculatorLeads({}, { fetchFn: vi.fn() as unknown as typeof fetch, submitFn: vi.fn(), getSinceId: async () => 0 }),
    ).rejects.toThrow('CALCULATOR_WP_EXPORT_URL')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run modules/lead-intake/calculator`
Expected: FAIL — cannot resolve `../import-calculator-leads`.

- [ ] **Step 3: Implement the importer**

```ts
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { leads } from '@/drizzle/schema-leads'
import { submitLeadIntakeForUser, type LeadIntakeResult } from '../actions'
import { mapWpLeadToIntakeInput, type WpCalculatorLead } from './map-wp-lead'

export type CalculatorImportSummary = {
  sinceId: number
  fetched: number
  imported: number
  failed: number
  results: Array<{ wpLeadId: number; ok: boolean; leadId?: string; error?: string }>
}

type ImportDeps = {
  fetchFn?: typeof fetch
  submitFn?: (input: Parameters<typeof submitLeadIntakeForUser>[0], actorId: string | null) => Promise<LeadIntakeResult>
  getSinceId?: () => Promise<number>
}

export async function importCalculatorLeads(
  { limit = 25 }: { limit?: number } = {},
  deps: ImportDeps = {},
): Promise<CalculatorImportSummary> {
  const fetchFn = deps.fetchFn ?? fetch
  const submitFn = deps.submitFn ?? submitLeadIntakeForUser
  const getSinceId = deps.getSinceId ?? getMaxImportedCalculatorLeadId

  const exportUrl = process.env.CALCULATOR_WP_EXPORT_URL?.trim()
  const exportKey = process.env.CALCULATOR_WP_EXPORT_KEY?.trim()
  if (!exportUrl) throw new Error('CALCULATOR_WP_EXPORT_URL is not configured')
  if (!exportKey) throw new Error('CALCULATOR_WP_EXPORT_KEY is not configured')

  const sinceId = await getSinceId()
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100)
  const response = await fetchFn(`${exportUrl}?since_id=${sinceId}&limit=${boundedLimit}`, {
    headers: { 'X-RG-Export-Key': exportKey },
  })
  if (!response.ok) throw new Error(`WP export fetch failed with HTTP ${response.status}`)

  const payload = (await response.json()) as { leads?: unknown }
  const wpLeads = Array.isArray(payload.leads) ? (payload.leads as WpCalculatorLead[]) : []

  const results: CalculatorImportSummary['results'] = []
  for (const wpLead of wpLeads) {
    try {
      const result = await submitFn(mapWpLeadToIntakeInput(wpLead), null)
      if ('error' in result) {
        results.push({ wpLeadId: wpLead.id, ok: false, error: result.error })
      } else {
        results.push({ wpLeadId: wpLead.id, ok: true, leadId: result.leadId })
      }
    } catch (error) {
      results.push({
        wpLeadId: wpLead.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    sinceId,
    fetched: wpLeads.length,
    imported: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  }
}

export async function getMaxImportedCalculatorLeadId(): Promise<number> {
  // Calculator refs are 'calculator:<wp_id>' — parse the numeric part for the polling cursor.
  const [row] = await db
    .select({
      maxId: sql<number | null>`max(cast(split_part(${leads.externalRef}, ':', 2) as integer))`,
    })
    .from(leads)
    .where(and(eq(leads.source, 'calculator'), isNotNull(leads.externalRef)))

  return row?.maxId ?? 0
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run modules/lead-intake/calculator`
Expected: PASS (mapper + importer tests).

- [ ] **Step 5: Commit**

```bash
git add modules/lead-intake/calculator
git commit -m "feat: calculator lead importer pulling from WP export endpoint"
```

---

### Task 7: rgtools — import trigger API route

Mirrors the existing retry route pattern (`app/api/lead-intake/servicem8/retry/route.ts`).

**Files:**
- Create: `app/api/lead-intake/calculator-import/route.ts`
- Test: `app/api/lead-intake/calculator-import/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const importCalculatorLeadsMock = vi.hoisted(() => vi.fn())

vi.mock('@/modules/lead-intake/calculator/import-calculator-leads', () => ({
  importCalculatorLeads: importCalculatorLeadsMock,
}))

import { POST } from '../route'

function request(secret: string | null, body: unknown = { limit: 10 }) {
  return new NextRequest('http://localhost/api/lead-intake/calculator-import', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CALCULATOR_IMPORT_SECRET = 'import-secret'
  importCalculatorLeadsMock.mockResolvedValue({
    sinceId: 6, fetched: 2, imported: 2, failed: 0, results: [],
  })
})

describe('POST /api/lead-intake/calculator-import', () => {
  it('rejects requests without the import secret', async () => {
    const response = await POST(request(null))

    expect(response.status).toBe(401)
    expect(importCalculatorLeadsMock).not.toHaveBeenCalled()
  })

  it('imports a bounded batch when authorized', async () => {
    const response = await POST(request('import-secret', { limit: 10 }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.imported).toBe(2)
    expect(importCalculatorLeadsMock).toHaveBeenCalledWith({ limit: 10 })
  })

  it('returns 500 with the error message when the import throws', async () => {
    importCalculatorLeadsMock.mockRejectedValue(new Error('WP export fetch failed with HTTP 403'))

    const response = await POST(request('import-secret'))
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toContain('HTTP 403')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/lead-intake/calculator-import`
Expected: FAIL — cannot resolve `../route`.

- [ ] **Step 3: Implement the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { importCalculatorLeads } from '@/modules/lead-intake/calculator/import-calculator-leads'

export async function POST(request: NextRequest) {
  const importSecret = process.env.CALCULATOR_IMPORT_SECRET
  const authHeader = request.headers.get('authorization')

  if (!importSecret || authHeader !== `Bearer ${importSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await readJsonBody(request)
  const limit = typeof body.limit === 'number' ? body.limit : 25

  try {
    const summary = await importCalculatorLeads({ limit })
    return NextResponse.json(summary)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

async function readJsonBody(request: NextRequest): Promise<{ limit?: unknown }> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? body : {}
  } catch {
    return {}
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/lead-intake/calculator-import`
Expected: PASS (3 tests). Then run the full suite: `npm run test:run` — expected PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/lead-intake/calculator-import
git commit -m "feat: API route to trigger calculator lead import"
```

---

### Task 8: Cutover + n8n schedule (manual, after Tasks 1–7 are deployed)

No code — operational checklist.

- [ ] **Step 1: Set rgtools env vars** (`CALCULATOR_WP_EXPORT_URL`, `CALCULATOR_WP_EXPORT_KEY`, `CALCULATOR_IMPORT_SECRET`) in the deployment environment and redeploy.

- [ ] **Step 2: Dry-run the import manually**

```bash
curl -X POST -H "Authorization: Bearer <CALCULATOR_IMPORT_SECRET>" \
  -H "Content-Type: application/json" -d '{"limit": 5}' \
  https://<rgtools-host>/api/lead-intake/calculator-import
```

Verify: leads appear in the rgtools leads dashboard with `source: calculator`, client deduped if a known phone/email, ServiceM8 inbox email received with `RGTools Lead <uuid>` reference. Run it a second time — verify it imports 0 (idempotency working).

- [ ] **Step 3: n8n workflow on the Mac Mini**

Schedule Trigger (every 5 minutes, office hours fine) → HTTP Request node: `POST https://<rgtools-host>/api/lead-intake/calculator-import`, header `Authorization: Bearer <secret>`, body `{"limit": 25}` → IF node on `failed > 0` → notification node (channel TBD — Telegram pending RG decision; email fallback works today).

- [ ] **Step 4: Hand over the ServiceM8 email to rgtools**

In `wp-config.php` on the live site, comment out `RG_SM8_INBOX_EMAIL`. (Per plugin docs, undefined = SM8 email disabled. The admin notification email `RG_LEAD_NOTIFY_EMAIL` stays.) From this moment rgtools is the sole sender of SM8 inbox emails for calculator leads — no more double emails.

- [ ] **Step 5: Watch the first week.** If a lead fails import (visible in n8n alert / API response), fix the cause and re-enter the lead through the rgtools lead-intake form manually.

---

### Task 9: rgtools — date-anchored ServiceM8 job filter

`findMatchingJob` currently fetches **all** jobs unfiltered. Anchor the search to the lead's creation date — a job converted from a lead can never predate the lead.

**Files:**
- Modify: `modules/leads/servicem8-fetch.ts:45-147`
- Test: `modules/leads/__tests__/` (extend the existing servicem8-fetch test file; check its current mocking pattern and follow it)

- [ ] **Step 1: Write the failing test**

In the existing servicem8-fetch test file, add a test asserting the request path includes the filter. Follow the file's existing fixture pattern for the `request` mock and the lead row; the new assertion is:

```ts
  it('filters the job search by the lead created date', async () => {
    // arrange: lead row whose createdAt is 2026-06-08T10:00:00Z, request mock capturing paths
    // act: await fetchLeadFromServiceM8(leadId, actorId, { request: requestMock })
    const jobSearchPath = requestMock.mock.calls.map((c) => c[0]).find((p: string) => p.startsWith('/job.json'))
    expect(jobSearchPath).toBe(`/job.json?%24filter=${encodeURIComponent("date gt '2026-06-07'")}`)
  })
```

(The lead select in `fetchLeadFromServiceM8` must now also return `createdAt` — the test's lead fixture needs that field.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run modules/leads`
Expected: FAIL — path is `/job.json` without a filter.

- [ ] **Step 3: Implement**

In `fetchLeadFromServiceM8`, add `createdAt: leads.createdAt` to the lead select. Pass it through:

```ts
  const matchingJob = await findMatchingJob(request, reference, lead.createdAt)
```

Change `findMatchingJob`:

```ts
async function findMatchingJob(
  request: ServiceM8FetchRequest,
  reference: string,
  leadCreatedAt: Date,
): Promise<ServiceM8Job | undefined> {
  // One-day margin guards against timezone skew between Neon (UTC) and ServiceM8 job dates.
  const sinceDate = new Date(leadCreatedAt.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const params = new URLSearchParams({ $filter: `date gt '${sinceDate}'` })
  const jobsResponse = await request(`/job.json?${params.toString()}`)
  // ... rest unchanged
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run modules/leads`
Expected: PASS, including all pre-existing tests in the file (update their fixtures if the new `createdAt` select breaks them).

- [ ] **Step 5: Commit**

```bash
git add modules/leads
git commit -m "perf: anchor ServiceM8 job search to lead creation date"
```

---

## Self-Review Notes

- **Spec coverage:** timeframe fix (Task 1), WP export (Task 2), idempotency column (Task 3), intake extension (Task 4), mapping incl. companyName/consent decisions (Task 5), importer with dedup-by-since-id (Task 6), n8n-callable trigger (Task 7), SM8 email handover + schedule (Task 8), date filter (Task 9). The consent non-mapping and customerType mapping decisions from planning are encoded in Task 5 tests.
- **Constraint compliance:** no webhook added to the public form path; export endpoint is GET + API key (not a public POST, Turnstile rule doesn't apply); WP DB save still precedes everything (unchanged).
- **Type consistency:** `WpCalculatorLead` identical in Tasks 5/6; `submitFn` signature in Task 6 matches the Task 4 widened `submitLeadIntakeForUser`; route mocks in Task 7 match Task 6's export names; `timeline`/`externalRef` flow normalizeInput → insert per Task 4.
- **Future-proofing:** idempotency column is channel-generic (`external_ref`); the intake action accepts any-channel input; adding email/WeChat/SMS/phone later = one additive ingest route + one n8n workflow per channel, no changes to anything in this plan.
- **Open verification points for the executor (flagged, not placeholders):** `persistLeadScore` actor parameter type (Task 4 Step 2 says how to handle), existing servicem8-fetch test fixture shape (Task 9 follows its pattern).
