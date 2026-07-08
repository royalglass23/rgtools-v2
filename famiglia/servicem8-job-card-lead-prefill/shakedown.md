# Shakedown - servicem8-job-card-lead-prefill

- Date: 2026-07-08
- Branch: feature/leads
- Worktree: D:\Royal Glass Dev\rgtools\.worktrees\feature-leads
- Linear: MT-184
- Verdict: GREEN after blocker repair

## Coverage

| Check | Result | Evidence |
|-------|--------|----------|
| Focused regression tests | PASS | `pnpm.cmd --filter @rgtools/web test:run modules/leads/__tests__/servicem8-fetch.test.ts lib/servicem8/__tests__/client.test.ts modules/leads/__tests__/ImportServiceM8LeadForm.test.tsx modules/leads/__tests__/LeadsTableControls.test.tsx modules/lead-intake/scoring/__tests__/score-lead.test.ts` -> 5 files, 61 tests passed |
| TypeScript | PASS | `pnpm.cmd exec tsc --noEmit -p apps/web/tsconfig.json` -> exit 0 |
| Touched-file lint | PASS | `pnpm.cmd --filter @rgtools/web lint modules/leads/servicem8-fetch.ts modules/leads/__tests__/servicem8-fetch.test.ts lib/servicem8/client.ts lib/servicem8/__tests__/client.test.ts` -> exit 0 |
| Full lint | PASS with warnings | `pnpm.cmd lint` -> 0 errors, 2 existing warnings outside this slice: calculator-submit route test `_submissionRef`, dashboard `buildConversionSparkline` |
| Workspace guardrails | PASS | `pnpm.cmd test:workspace` -> 2 files, 4 tests passed |
| Full test suite | PASS | After repairing stale quote-tracker tests, `pnpm.cmd test` passed: workspace tests 2 files / 4 tests; web tests 99 files passed, 2 skipped; 573 passed, 16 skipped. |
| Whitespace | PASS | `git diff --check` -> exit 0 |
| Secret scan | PASS | Diff scan for `api key`, `secret`, `token`, `password`, `bearer`, `BEGIN`, `PRIVATE` returned no matches in touched files |

## Behavior Verified

- ServiceM8 job metadata reads configured RG job-card fields from `/job/{uuid}.json`.
- `/leads` import maps exact known ServiceM8/RG labels to existing decision-matrix values.
- Quote value maps to the existing budget bands.
- Explicit `Project Type:` in the configured ServiceM8 note maps to RGTools Project Type.
- Imported Quote leads with recognized scoring fields call the existing `persistLeadScore()` path.
- Sparse ServiceM8 imports still create linked leads without pretending to score.
- Non-Quote imports remain rejected by existing tests.
- Existing import UI and lead table scoring display tests remain green.

## Deliberate Gaps

- No live ServiceM8 import was run. Manual verification still needs known safe Quote and non-Quote ServiceM8 test jobs.
- No Playwright e2e was run in this shakedown because the critical path depends on authenticated app state plus safe ServiceM8 test data.
- Live ServiceM8 import still needs known safe Quote and non-Quote ServiceM8 test jobs.

## Next

- Proceed to `/cleaner` for the validation gate.

## Blocker Repair

- The quote-tracker action tests were stale after `requireModule('quote-tracker')` became part of the server actions. They now mock the guard instead of hitting the real access DB.
- The ServiceM8 attachment webhook tests were stale after URL-token auth was removed. They now authorize with `x-servicem8-webhook-secret`.
- Repair verification:
  - `pnpm.cmd --filter @rgtools/web test:run modules/quote-tracker/__tests__/actions.test.ts modules/quote-tracker/__tests__/expire-quote-link-action.test.ts modules/quote-tracker/__tests__/servicem8-attachment-webhook.test.ts` -> 3 files, 21 tests passed.
  - `pnpm.cmd test` -> pass.
