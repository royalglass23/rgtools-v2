# Security sign-off — everything (security branch)

- Stack: node/next (source: marker:package.json)
- Mode: retrofit
- Date: 2026-06-30
- Reviewed-commit: c4c6b3b9d6999f6024af60a19e515b5862b66730
- Branch: security
- Standards: OWASP Top 10:2021 · ASVS 4.0 Level 2 · NZ Privacy Act 2020
- Compliance: nz-privacy
- **Verdict: PASS** *(MT-137/138/139/140 all resolved; one new Low finding below — not a blocker)*

---

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Input validation — UUID format | PASS | `UUID_RE` regex in `getLeadDetail` |
| Input validation — sort column whitelist | PASS | `LEADS_SORT_COLUMNS` guard in `parseLeadsListFilters` |
| Input validation — filter enums | PASS | Explicit allowed-value checks in `parseLeadsListFilters` |
| Input validation — LIKE escaping | PASS | `escapeLike` in `queries.ts` |
| Input validation — job number | PASS | trim + uppercase; SM8 resolves UUID server-side |
| Parameterized DB queries | PASS | Drizzle ORM throughout; no raw SQL concatenation |
| Output encoding | PASS | React text content; no dangerouslySetInnerHTML |
| Authentication — all routes | PASS | Proxy middleware + `requireModule` guard in layout |
| Authorization — admin-only actions | PASS | `role === 'admin'` check on delete/restore/batch-delete |
| Authorization — module access | PASS | `requireModule('leads')` in `app/(dashboard)/leads/layout.tsx` |
| Rate limiting — AI suggestion | PASS | 60-second DB-backed cooldown via `aiSuggestionAt` (MT-138) |
| Rate limiting — SM8 import | PASS | 10-second in-process cooldown per user (MT-139) |
| Audit logging — mutations | PASS | All delete/restore/SM8 operations logged via `logAudit` |
| Audit logging — AI suggestion | PASS | `lead.ai_suggestion_generated` event added (MT-137) |
| No PII in audit logs | PASS | Confirmed: before/after fields contain UUIDs and flags only |
| Secrets from environment | PASS | All keys from `process.env`; no hardcoded credentials |
| Secrets fail-fast if unconfigured | PASS | Each getter throws with clear message if env var missing |
| Error shapes — no stack traces to client | PASS | Structured `{ error: string }` / `{ ok: false, message }` returns |
| ServiceM8 responses type-checked | PASS | Response objects validated before use |
| SSRF | PASS | No user-controlled URLs in server-side fetches |
| Security-focused negative tests | PASS | Unauthenticated + non-admin rejection tests added (MT-140) |
| NZ Privacy — IPP5 (security) | PASS | TLS, access controls, no PII in logs |
| NZ Privacy — IPP12 (cross-border) | PARTIAL | Neon US-east storage; comparable safeguard not documented — tracked by MT-55/57/58 |
| HTTP security headers | LOW | `next.config.ts` has no `headers()` config — no CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy. Low severity for an auth-gated internal tool; see note. |

---

## Open blockers

None. All MT-137/138/139/140 findings resolved. The one new Low finding (security headers) is a pre-existing gap not introduced by this branch.

---

## Notes

- The codebase is well-structured for a single-organization internal tool. The layered auth model (proxy → requireModule → role check) is correct and consistently applied.
- MT-137: `lead.ai_suggestion_generated` audit event added to `generateLeadSuggestionAction`. ✓
- MT-138: AI suggestion cooldown enforced via `aiSuggestionAt` DB timestamp (persists across requests). ✓
- MT-139: SM8 import cooldown via in-process `importCooldowns` Map. Limitation: resets on cold start / across multiple Vercel instances. Acceptable for current single-org, low-volume use. ✓
- MT-140: Negative auth tests added for all server actions. ✓
- **New Low [CSP headers]**: `next.config.ts` defines no HTTP security headers. For an internal tool behind authentication this is low-severity, but a `headers()` block with CSP, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy should be added before any public-facing expansion. Not a blocker for the current internal use case.
- IPP12 (cross-border data) is a process-level item tracked separately (MT-55/57/58) and does not require a code change for this feature.
