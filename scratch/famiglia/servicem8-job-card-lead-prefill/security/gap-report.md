# Gap report - servicem8-job-card-lead-prefill

- Date: 2026-07-08T00:53:07.0101579Z
- Mode: retrofit
- Linear: MT-184
- Verdict: No open MT-184 security blockers

## Fixed during Omerta

| Priority | Status | Item | Evidence |
|----------|--------|------|----------|
| P0 | Fixed | Add action-level authorization to the ServiceM8 lead import action. | `importServiceM8LeadAction()` now checks `userCanAccessSlug(session.user.id, 'leads')`; negative unit test added. |

## Remaining gaps

| Priority | Status | Item | Owner / next step |
|----------|--------|------|-------------------|
| P1 | Fixed | Broad `pnpm.cmd test` was red due stale quote-tracker action/webhook tests. | Updated tests to mock the quote-tracker guard and use header-based webhook auth; `pnpm.cmd test` now passes. |
| P2 | Deferred | Run live ServiceM8 import smoke with safe Quote and non-Quote test jobs. | Needs known safe test jobs; do not use production customer jobs. |
| P3 | Deferred | Consider distributed rate limiting for ServiceM8 import actions. | Existing per-user in-memory cooldown is adequate for this slice, but not a platform-wide abuse limit. |
