# Job: servicem8-job-card-lead-prefill

- Mode: full
- Entry: feature
- Opened: 2026-07-08T00:05:57Z
- Status: gate-green
- Workspace: D:\Royal Glass Dev\rgtools\.worktrees\feature-leads
- Branch: feature/leads
- Remote: origin/feature/leads
- Linear: MT-184

## Pipeline

| Stage | Skill | Status | Artifact |
|-------|-------|--------|----------|
| Size and scope | godfather | done | this file |
| Quick requirements | sit-down | compressed | docs/codex/leads/servicem8-job-card-lead-prefill.md |
| Issue | capo | done | Linear MT-184 |
| Isolation | cleaner | done | D:\Royal Glass Dev\rgtools\.worktrees\feature-leads |
| Implementation | soldato | done | MT-184 |
| Focused testing | shakedown | done-green-after-blocker-repair | famiglia/servicem8-job-card-lead-prefill/shakedown.md |
| Security quick-pass | omerta | done-pass | famiglia/servicem8-job-card-lead-prefill/security/signoff.md |
| Architecture review | commission | done-pass | famiglia/servicem8-job-card-lead-prefill/commission.md |
| Review | enforcer | done-approved | famiglia/servicem8-job-card-lead-prefill/review.md |
| Validation gate | cleaner | done-green | famiglia/servicem8-job-card-lead-prefill/gate.md |
| Release readiness | getaway | pending | MT-184 checkpoints |
| Handoff | courier | pending | docs/codex/leads/servicem8-job-card-lead-prefill.md |

## Notes

- `git fetch origin` completed before isolation checks.
- `D:\Royal Glass Dev\rgtools\.worktrees\feature-leads` is the real `feature/leads` worktree.
- Keep `/leads` import as the entry point; do not create a second importer.
- Use existing lead matrix columns and `persistLeadScore`; do not create another scoring engine.
