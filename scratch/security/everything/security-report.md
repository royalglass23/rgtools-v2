# Security report — everything (leads feature set)

Mode: retrofit · Stack: node/next · Date: 2026-06-30
Standards: OWASP Top 10:2021 · ASVS 4.0 Level 2 · NZ Privacy Act 2020 (IPPs 1–13)
Reviewed-commit: c4c6b3b9d6999f6024af60a19e515b5862b66730 (branch: security)

---

## Summary

**Feature scope:** Leads list, lead detail, ServiceM8 import, ServiceM8 fetch/link, AI suggestion, batch delete/restore, and related server actions. Security branch fixes MT-137/138/139/140 (audit log, rate limits, auth tests).

**Overall verdict: PASS** — All 4 Medium/Low findings from the prior review resolved. One new Low finding (missing HTTP security headers) identified. No High or Critical findings. The codebase is well-structured with solid auth, parameterized queries, input validation, full audit coverage, and security tests.

---

## Requirements summary

- All leads routes require authentication (proxy middleware) + module access (`requireModule` guard in layout).
- Admin-only operations require `session.user.role === 'admin'` checked server-side on every call.
- All mutations must be audit-logged.
- Secrets from environment only.

---

## Data classification summary

PII handled: client name, email, phone, job address. All stored in Neon (US-east), transmitted over TLS. Soft-delete mechanism exists. No self-service access/export/deletion path for individuals. See `data-classification.md`.

---

## Findings

### Resolved (this branch)

| # | Severity | MT | Finding | Resolution |
|---|----------|----|---------|------------|
| 1 | ~~Medium~~ | MT-137 | Missing `logAudit` in `generateLeadSuggestionAction` | Resolved: `lead.ai_suggestion_generated` event added |
| 2 | ~~Medium~~ | MT-138 | No rate limit on AI suggestion | Resolved: 60s cooldown via `aiSuggestionAt` DB timestamp |
| 3 | ~~Medium~~ | MT-139 | No rate limit on SM8 import | Resolved: 10s in-process cooldown in `importServiceM8LeadAction` |
| 4 | ~~Low~~ | MT-140 | No negative security tests | Resolved: auth/role rejection tests added across all actions |

### Open (new finding, pre-existing gap)

| # | Severity | Category | Finding | Location |
|---|----------|----------|---------|----------|
| 5 | Low | A05 Security Misconfiguration / ASVS V14 | No HTTP security headers configured — `next.config.ts` has no `headers()` block; CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy all absent | `apps/web/next.config.ts` |

---

## OWASP Top 10:2021 assessment

| Category | Result | Evidence |
|----------|--------|---------|
| A01 Broken Access Control | PASS | Proxy middleware + `requireModule` guard + server-side role checks on all admin actions; UUID regex validates leadId before DB query |
| A02 Cryptographic Failures | PASS | All secrets from env vars; TLS on Neon + ServiceM8 + OpenAI; no PII in audit logs |
| A03 Injection | PASS | Drizzle ORM parameterized queries throughout; `escapeLike` for LIKE patterns; sort column whitelist; no raw SQL concatenation |
| A04 Insecure Design | PASS | Rate limiting now in place on both AI suggestion (60s DB-backed) and SM8 import (10s in-process) |
| A05 Security Misconfiguration | FAIL | No HTTP security headers in `next.config.ts` (finding #5 — Low, pre-existing) |
| A06 Vulnerable & Outdated Components | N/A | npm audit not run as part of this review — should be added to CI |
| A07 Identification & Authentication Failures | PASS | NextAuth JWT; all routes behind auth middleware; admin role enforced server-side |
| A08 Software & Data Integrity Failures | PASS | ServiceM8 API responses type-checked; UUID validated before use |
| A09 Security Logging & Monitoring Failures | PASS | All mutations now logged: delete, restore, SM8 fetch/import/link, AI suggestion |
| A10 SSRF | PASS | No user-controlled URLs in server-side fetches; job number is resolved to UUID via SM8 client before any API call |

---

## ASVS 4.0 Level 2 assessment

| Chapter | Result | Notes |
|---------|--------|-------|
| V1 Architecture | PASS | Trust boundaries documented; proxy + guard + role layers |
| V2 Authentication | PASS | NextAuth handles credential auth and JWT sessions |
| V3 Session Management | PASS | NextAuth manages httpOnly+secure cookies |
| V4 Access Control | PASS | Server-side per-role; UUID validation prevents malformed lookups; admin gate on destructive ops |
| V5 Validation, Sanitization & Encoding | PASS | UUID regex, sort column whitelist, filter enums, LIKE escaping, Drizzle parameterization, React XSS protection |
| V6 Stored Cryptography | PASS | Secrets in env only; no hardcoded keys found |
| V7 Error Handling & Logging | PASS | All mutations logged; error shapes safe (structured returns, no stack traces to client) |
| V8 Data Protection | PASS | PII not cached client-side; no PII in audit log fields |
| V9 Communications | PASS | TLS for all external calls (Neon, ServiceM8, OpenAI) |
| V10 Malicious Code | N/A | npm audit not run — recommend adding to CI |
| V11 Business Logic | PASS | Rate limiting in place: 60s DB-backed AI cooldown; 10s in-process SM8 import cooldown |
| V12 Files & Resources | N/A | No file uploads in this feature |
| V13 API & Web Service | PASS | Auth on all endpoints; rate limiting present; schema validated |
| V14 Configuration | FAIL | No HTTP security headers in `next.config.ts` (finding #5 — Low, pre-existing) |

---

## Authentication & authorization check (step 9)

| Action | AuthN check | AuthZ check | Result |
|--------|-------------|-------------|--------|
| `batchDeleteLeadsAction` | `auth()` checked | `role === 'admin'` | PASS |
| `restoreLeadAction` | `auth()` checked | `role === 'admin'` | PASS |
| `deleteLeadAction` | `auth()` checked | `role === 'admin'` | PASS |
| `generateLeadSuggestionAction` | `auth()` checked | Any authenticated user | PASS (single-org tool by design) |
| `importServiceM8LeadAction` | `auth()` checked | Any authenticated user | PASS (single-org tool by design) |
| `GET /leads` | Proxy middleware + `requireModule` | Module access grant | PASS |
| `GET /leads/[id]` | Proxy middleware + `requireModule` | Module access grant | PASS |

---

## Input/output validation check (step 10)

| Input | Validation | Result |
|-------|-----------|--------|
| `leadId` (detail route) | UUID regex in `getLeadDetail` | PASS |
| `leadId` (server actions) | UUID regex at query layer | PASS |
| Sort column from URL | `LEADS_SORT_COLUMNS` whitelist | PASS |
| Filter enums (tier, sm8, date, statusView) | Explicit allowed-values check | PASS |
| Search query `q` | `escapeLike` before LIKE pattern | PASS |
| `jobNumber` (import) | `trim().toUpperCase()` + SM8 resolves UUID server-side | PASS |
| All DB writes | Drizzle ORM parameterized | PASS |
| Rendered output | React text content (XSS-safe) | PASS |

---

## Logging & auditing check (step 11)

| Event | Logged | Notes |
|-------|--------|-------|
| Lead deleted (single) | ✅ | `lead.deleted` — actorId, before/after |
| Lead deleted (batch) | ✅ | One `lead.deleted` per leadId in batch |
| Lead restored | ✅ | `lead.restored` |
| SM8 fetch/sync | ✅ | `lead.servicem8_fetch` |
| SM8 import | ✅ | `lead.servicem8_import` |
| SM8 manual link | ✅ | `lead.servicem8_manual_link` |
| AI suggestion generated | ✅ | `lead.ai_suggestion_generated` — actorId, targetId, aiSuggestionAt (MT-137) |
| PII in log fields | ✅ None found | Audit before/after contain UUIDs, status flags, boolean flags only |

---

## Secrets handling check (step 12)

| Secret | Storage | Hardcoded? | Result |
|--------|---------|-----------|--------|
| `SERVICEM8_API_KEY` | `process.env` | No | PASS |
| `SERVICEM8_API_KEY_FULL` | `process.env` | No | PASS |
| `OPENAI_API_KEY` | `process.env` | No | PASS |
| `SERVICEM8_LEAD_QUALITY_FIELD` | `process.env` | No | PASS |
| DB connection string | `process.env` (via Drizzle) | No | PASS |

---

## NZ Privacy Act 2020 compliance (IPP mapping)

| IPP | Description | Result | Notes |
|-----|-------------|--------|-------|
| IPP1 Purpose | Collected for lead management only | PASS | Clear business purpose |
| IPP2 Source | SM8 import collects from ServiceM8 | PARTIAL | Not collected directly from individual; import from integrated system |
| IPP3 Awareness | No consent/notice in import flow | PARTIAL | MT-55/57/58 tracking privacy notice — known open item |
| IPP4 Manner | No dark patterns | PASS | |
| IPP5 Security | TLS in transit, access-controlled, no PII in logs | PASS | |
| IPP6 Access | No self-service individual access path | PARTIAL | Staff can look up; no subject access request flow |
| IPP7 Correction | No self-service correction | PARTIAL | Staff can edit via lead-intake |
| IPP8 Accuracy | Data validated before use; SM8 source of truth | PASS | |
| IPP9 Retention | Soft-delete exists; no automated hard-delete schedule | PARTIAL | Retention policy not enforced in code |
| IPP10 Use limitation | Data used only for lead management | PASS | |
| IPP11 Disclosure | ServiceM8 is an integrated internal system, not third-party disclosure | PASS | |
| IPP12 Cross-border | Neon DB is US-east; no documented comparable-safeguard mechanism | PARTIAL | Known open item tracked by MT-55; not a code-level fix |
| IPP13 Unique identifiers | No unnecessary unique identifiers assigned | PASS | |

**IPP5/IPP12 note:** IPP5 PASSES (code-level security is sound). IPP12 is a process/legal-level gap (Neon US-east storage without documented safeguards) — the same issue tracked by MT-55/57/58. Not a code-level blocker for this feature, but must be resolved before production go-live.
