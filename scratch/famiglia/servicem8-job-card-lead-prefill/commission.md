# Commission ruling - servicem8-job-card-lead-prefill

- Date: 2026-07-08
- Branch: feature/leads
- Worktree: D:\Royal Glass Dev\rgtools\.worktrees\feature-leads
- Linear: MT-184
- Verdict: PASS

## Scope

Reviewed the architecture of the `/leads` ServiceM8 job-number import path after implementation and Omerta:

- `apps/web/app/(dashboard)/leads/actions.ts`
- `apps/web/lib/servicem8/client.ts`
- `apps/web/modules/leads/servicem8-fetch.ts`
- related focused tests

## Ruling

MT-184 fits the existing RGTools module boundaries. The change deepens the existing ServiceM8 lead importer instead of creating a second import/scoring path, keeps scoring in the existing `persistLeadScore()` module, and uses the existing lead decision matrix as the conversion authority.

## Keep

| Axis | Ruling | Evidence |
|------|--------|----------|
| Deep modules | keep | The server action only handles auth, module access, cooldown, and result shaping. The importer owns the ServiceM8-to-lead workflow. The ServiceM8 client owns external JSON field extraction. |
| Locality | keep | ServiceM8 job-card field extraction is localized to `lib/servicem8/client.ts`; RGTools matrix equivalence stays in `modules/leads/servicem8-fetch.ts`; scoring stays in `modules/lead-intake/scoring/persist-score.ts`. |
| Consistency | keep | Uses existing `DECISION_MATRIX`, existing lead columns, existing `resolveClient()`, existing Drizzle writes, existing audit helper, and existing module access check pattern. |
| Data access | keep | Import is a bounded single-job workflow: duplicate lookup, client/contact resolution, insert, score. No unbounded list or pagination issue introduced. |
| Performance | keep | Matrix lookup is over a small fixed option set. ServiceM8 and DB calls are bounded to one import. No hot-path fan-out introduced. |

## Fixed During Commission

| Severity | Issue | Resolution |
|----------|-------|------------|
| concern | The importer test shape allowed `leadJobCardFields.projectType`, but the ServiceM8 adapter did not actually produce that field. That made the test interface wider than production. | Promoted `projectType` into the real ServiceM8 adapter contract behind `SERVICEM8_PROJECT_TYPE_FIELD`, updated the client test, and made the importer depend on the exported adapter type. |

## Remaining Concerns

| Severity | Issue | Ruling |
|----------|-------|--------|
| concern | `leadJobCardFields` is lead-domain language on the shared ServiceM8 quote metadata object, so quote-tracker consumers receive an unused field. | Acceptable for this slice because the adapter already returns enriched quote metadata and the field is additive. If more module-specific ServiceM8 custom fields appear, split this into a narrower custom-field adapter instead of continuing to grow `QuoteJobMeta`. |
| concern | Scoring runs after lead creation in a separate `persistLeadScore()` transaction. A scoring failure could leave the lead imported with mapped fields but without score persistence. | Acceptable because it reuses the existing scoring module and keeps scoring behavior centralized. Enforcer may decide whether to add graceful failure messaging, but no architecture rewrite is needed. |
| concern | Import cooldown is in-memory per process. | Acceptable for operator-triggered single-job import. Distributed throttling belongs to a broader abuse-control pass, not MT-184. |

## Verification

| Check | Result |
|-------|--------|
| Focused regression pack | PASS - `pnpm.cmd --filter @rgtools/web test:run "app/(dashboard)/leads/__tests__/actions.test.ts" modules/leads/__tests__/servicem8-fetch.test.ts lib/servicem8/__tests__/client.test.ts modules/leads/__tests__/ImportServiceM8LeadForm.test.tsx modules/leads/__tests__/LeadsTableControls.test.tsx modules/lead-intake/scoring/__tests__/score-lead.test.ts` -> 6 files, 67 tests passed |
| Touched-file lint | PASS - `pnpm.cmd --filter @rgtools/web lint "app/(dashboard)/leads/actions.ts" "app/(dashboard)/leads/__tests__/actions.test.ts" modules/leads/servicem8-fetch.ts modules/leads/__tests__/servicem8-fetch.test.ts lib/servicem8/client.ts lib/servicem8/__tests__/client.test.ts` |
| TypeScript | PASS - `pnpm.cmd exec tsc --noEmit -p apps/web/tsconfig.json` |

## Next

Run `/cleaner` for the validation gate. The earlier unrelated quote-tracker/auth/webhook shakedown failures have been repaired and `pnpm.cmd test` now passes.
