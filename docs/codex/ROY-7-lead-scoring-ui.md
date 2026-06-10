# ROY-7 — Build Lead Scoring config UI (Admin → Lead Scoring)

> Agent brief. Read this entire file before writing any code.

## Context

- **rgtools** (this repo): Next.js 15 App Router + Drizzle + Neon + Vitest. Tailwind is used here.
- Lead scoring config lives in the `scoring_config_versions` table (`drizzle/schema-leads.ts`): versioned JSONB `config` column, `versionLabel` (unique), `isActive` boolean — **exactly one active row**, enforced by a hand-made partial unique index (see the schema comment: do NOT try to express it in Drizzle).
- The config shape is the `ScoringConfig` type in `modules/lead-intake/scoring/score-lead.ts`: `categories` (label, max, options key→points, optionLabels, optionOrder), `bonuses`, `penalties`, `tiers` (A/B/C thresholds), optional `strikes` (weights, softDemoteAt, capAt, capCeiling).
- Today the only way to change config is `scripts/seed-scoring-config-v3.ts` — study it; it is the canonical example of a full valid config.
- Read helpers exist: `getActiveScoringOptionLists` / `scoringConfigToOptionLists` in `modules/lead-intake/scoring/config-options.ts`.
- Leads reference the config they were scored under via `configVersionId` (both on `leads` and `lead_category_scores`).
- An audit table exists: `auditLog` in `drizzle/schema.ts` — see usage examples in `modules/lead-intake/actions.ts`.
- Route location: `app/(dashboard)/admin/lead-scoring/page.tsx` (placeholder may exist from ROY-6; replace its content). Module code goes in `modules/admin/scoring/` (new).

## Objective

Admin UI to view the active scoring config, edit it **as a new version**, activate versions, and browse history.

## The one rule that matters most

**NEVER mutate an active version's `config` in place. NEVER delete versions.** Historical leads reference `configVersionId`; editing in place silently corrupts the meaning of every past score. Save = INSERT new row → activate it → deactivate the old one, in a single transaction.

## Execution plan

1. **Read layer** (server): load active version + full version list (label, createdAt, createdBy, isActive). Display the active config: categories table (label, options with key/label/points in `optionOrder` order, max), tiers, bonuses/penalties, strikes.
2. **Edit form** (client component): pre-filled from the active config. Editable: category labels, option labels/points/order, add/remove options, tier thresholds, bonus/penalty values, strike weights and thresholds. Option **keys** for existing options should be treated as immutable in the UI (renaming a key orphans historical `answerKey` references) — adding new keys is fine.
3. **Server action** `saveScoringConfigVersion`: validate (see step 5) → in one transaction: insert new row with user-supplied or auto-bumped `versionLabel`, set `isActive: true`, set previous active row `isActive: false` → audit-log (`action: 'scoring_config.activated'`, detail: versionLabel, previous version id). Follow the server-action + transaction pattern in `modules/lead-intake/actions.ts`.
4. **Activate a past version**: same transaction pattern, no new row needed — just flip `isActive` (this is the rollback mechanism). Audit-log it.
5. **Validation before save** (server-side, not just UI):
   - Tier thresholds: A > B > C, all 0–100.
   - Every key in `strikes.weights` exists as an option key in some category.
   - `optionOrder` arrays contain exactly the keys of their `options` map.
   - Points are integers ≥ 0; category `max` ≥ highest option points.
   - Reject empty categories/labels.
6. **Tests** (vitest, follow `modules/lead-intake/scoring/__tests__/` patterns): validation rules (each rejection case), the insert+activate transaction logic (mock db per existing test patterns), and that activation never UPDATEs the config JSONB of an existing row.
7. Admin-gate the page server-side (copy the guard from `app/(dashboard)/admin/page.tsx`).

## Hard guardrails

- No new npm dependencies. No drag-and-drop libs — option reorder via up/down buttons is fine.
- Do not modify `score-lead.ts`, `persist-score.ts`, or `config-options.ts` logic. The UI adapts to the existing shape, not the other way round. If the shape seems to need a change, STOP and ask.
- Do not touch the hand-managed partial unique index. Transactions must keep "exactly one active" true at every commit point.
- Do not run `npm run db:migrate` without asking. (No schema change is expected for this task at all — if you think you need one, STOP and ask.)
- Branch: `roy-7-lead-scoring-ui`. Never commit to `main`.

## Stop and ask when

- You believe the `ScoringConfig` shape needs changing.
- You think a schema migration is needed (expected answer: it isn't).
- The seed script and the active DB config disagree in shape (i.e., production config has drifted from the TypeScript type).
- Any decision about whether staff can DELETE a version (expected answer: never — archive flag exists in schema if needed, ask first).

## Human-only steps

- None expected.

## Definition of done

- Admin can: view active config, save an edited copy as a new active version, activate any historical version, see version history with who/when.
- Every activation writes an audit-log row.
- `npm run test:run`, `npm run lint`, `npx tsc --noEmit` all pass.
- Final report lists commits and any concerns.
