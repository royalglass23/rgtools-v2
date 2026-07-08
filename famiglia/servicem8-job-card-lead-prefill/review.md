# Enforcer review - servicem8-job-card-lead-prefill

- Date: 2026-07-08T01:38:02.6326473Z
- Diff reviewed: `feature/leads` worktree against `origin/feature/leads`
- Linear: MT-184
- Verdict: APPROVED

## Findings

1. [should-fix, fixed] Unknown ServiceM8 job-card labels were ignored but not recorded as unmapped - `apps/web/modules/leads/servicem8-fetch.ts:436` - the brief requires unknown labels to be ignored and listed as unmapped. Fixed by returning `unmappedJobCardFields` from the mapping helper and writing safe field names to the import audit detail at `apps/web/modules/leads/servicem8-fetch.ts:299`.

## Standards Axis

| Standard | Result | Evidence |
|----------|--------|----------|
| Early returns / guard clauses | PASS | `importServiceM8LeadAction()` and `importLeadFromServiceM8JobNumber()` use early returns for unauthenticated, unauthorized, missing job, non-Quote, duplicate, and cooldown cases. |
| Names reflect business meaning | PASS | Names are domain-specific: `buildJobCardPrefill`, `autoFilledFields`, `unmappedJobCardFields`, `ServiceM8LeadJobCardFields`, `persistLeadScore`. |
| External systems behind adapters | PASS | ServiceM8 field reads stay in `apps/web/lib/servicem8/client.ts`; DB writes stay in the existing lead importer and scorer modules. |
| Decisions separated from actions | PASS | Mapping decisions are pure helpers (`buildJobCardPrefill`, `optionKeyForLabel`, `budgetBandForQuoteValue`) and are tested through import behavior. |
| Useful errors | PASS | Staff-facing outcomes distinguish sign-in, access denied, cooldown, missing job, non-Quote, imported, imported-and-scored, and missing-contact states. |
| Inputs validated at boundaries | PASS | Server action requires auth and `leads` access before import; job number is normalized; ServiceM8 status must be singular `Quote`; unknown matrix labels are ignored. |
| Strong types | PASS | Uses exported `ServiceM8LeadJobCardFields`, `MatrixFieldKey`, and `LeadInsert`-derived field picks; no new `any`. |
| Tested | PASS | Added coverage for action-level authz, configured job-card fields, recognized mapping/scoring, note fallback, unknown/unmapped labels, sparse imports, duplicate imports, and non-Quote rejection. |
| Maintainable/readable | PASS | The change stays in existing seams and avoids a second importer or scoring engine. |

## Spec Axis

| Requirement | Result | Evidence |
|-------------|--------|----------|
| Extend existing `/leads` ServiceM8 import path | PASS | `importLeadFromServiceM8JobNumber()` is extended in place. |
| Read job-card fields from `/job/{uuid}.json` | PASS | `readLeadJobCardFields()` reads configured fields at `apps/web/lib/servicem8/client.ts:746`. |
| Map high-confidence labels to existing lead columns | PASS | `optionKeyForLabel()` only accepts exact matrix keys or labels. |
| Derive budget from quote value | PASS | `budgetBandForQuoteValue()` maps finite positive quote values to existing bands. |
| Persist score with existing scorer | PASS | `persistLeadScore(createdLeadId, actorId)` is called only when mapped fields exist. |
| Audit mapped and unmapped auto-fill summary | PASS | Import audit records `autoFilledFields`, `unmappedJobCardFields`, and `needsScoring` without raw ServiceM8 note text. |
| Honest UX copy | PASS | Success message distinguishes imported vs imported-and-scored and missing-contact states. |
| Preserve existing behavior | PASS | Sparse imports remain unscored, duplicate imports return existing lead, non-Quote imports are rejected, and no live ServiceM8 write is added. |

## Verification

| Check | Result |
|-------|--------|
| Focused regression pack | PASS - `pnpm.cmd --filter @rgtools/web test:run "app/(dashboard)/leads/__tests__/actions.test.ts" modules/leads/__tests__/servicem8-fetch.test.ts lib/servicem8/__tests__/client.test.ts modules/leads/__tests__/ImportServiceM8LeadForm.test.tsx modules/leads/__tests__/LeadsTableControls.test.tsx modules/lead-intake/scoring/__tests__/score-lead.test.ts` -> 6 files, 68 tests passed |
| Touched-file lint | PASS - `pnpm.cmd --filter @rgtools/web lint modules/leads/servicem8-fetch.ts modules/leads/__tests__/servicem8-fetch.test.ts lib/servicem8/client.ts lib/servicem8/__tests__/client.test.ts "app/(dashboard)/leads/actions.ts" "app/(dashboard)/leads/__tests__/actions.test.ts"` |
| TypeScript | PASS - `pnpm.cmd exec tsc --noEmit -p apps/web/tsconfig.json` |
| Whitespace | PASS - `git diff --check` |

## Residual Risk

- The earlier unrelated quote-tracker/auth/webhook shakedown failures have been repaired and `pnpm.cmd test` now passes.
- No live ServiceM8 import smoke was run; manual verification still needs safe known Quote and non-Quote test jobs.
