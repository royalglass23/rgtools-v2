# Security sign-off - servicem8-job-card-lead-prefill

- Stack: node (source: marker:package.json)
- Mode: retrofit
- Date: 2026-07-08T00:53:07.0101579Z
- Reviewed-commit: b634a3aae3d3e84fbe492358b1f44b07cddd33f2
- Linear: MT-184
- Verdict: PASS

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Stack checklist | PASS | Node/Next app, no raw SQL, no eval/child process, secrets via env. |
| Security requirements | PASS | Authenticated and authorized Leads users only; mapped fields only; existing scoring path. |
| Data classification | PASS | No raw ServiceM8 note or secrets persisted by this feature. |
| Threat model | PASS | Main action-level authorization gap found and fixed. |
| AuthN | PASS | Server action requires `auth()` session. |
| AuthZ | PASS | Server action now checks `userCanAccessSlug(session.user.id, 'leads')` before import. |
| Input validation | PASS | Job number normalized, Quote status enforced, matrix values allow-listed, budget value finite/positive. |
| Output handling | PASS | User messages include job number/status only; raw configured note is not returned. |
| DB security | PASS | Drizzle query builder and inserts; no dynamic SQL. |
| Logging/auditing | PASS | Audit contains job identifiers, status, missing-contact flag, and mapped fields only. |
| Secrets | PASS | ServiceM8 key remains env-only; diff secret scan already passed in shakedown. |
| OWASP Top 10:2021 | PASS | No High/Critical findings open after fix. |
| ASVS 4.0 L2 | PASS | Applicable controls pass after action-level authz fix. |
| Security tests | PASS | 4 focused test files, 60 tests passed after the authz regression was added. |

## Blockers

None for MT-184 security.

## Caveat

This is a security PASS for the ServiceM8 job-card import slice. The earlier unrelated quote-tracker/auth/webhook shakedown blocker has since been repaired and `pnpm.cmd test` now passes.
