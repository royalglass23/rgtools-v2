# Security report - servicem8-job-card-lead-prefill

- Date: 2026-07-08T00:53:07.0101579Z
- Stack: node / Next.js / React / Drizzle
- Mode: retrofit
- Linear: MT-184
- Reviewed commit: b634a3aae3d3e84fbe492358b1f44b07cddd33f2
- Standards: OWASP Top 10:2021, OWASP ASVS 4.0 Level 2
- Verdict: PASS

## Scope

Reviewed the `/leads` ServiceM8 job-number import path that reads ServiceM8 job-card fields, maps recognized values into existing RGTools lead scoring fields, and calls the existing lead scoring persistence path.

In-scope files:

- `apps/web/app/(dashboard)/leads/actions.ts`
- `apps/web/app/(dashboard)/leads/__tests__/actions.test.ts`
- `apps/web/lib/servicem8/client.ts`
- `apps/web/lib/servicem8/__tests__/client.test.ts`
- `apps/web/modules/leads/servicem8-fetch.ts`
- `apps/web/modules/leads/__tests__/servicem8-fetch.test.ts`

Out of scope:

- Live ServiceM8 job import against production data.
- The unrelated quote-tracker/auth/webhook failures found by shakedown.
- A full dependency CVE audit.

## Security requirements

| Requirement | Result | Evidence |
|-------------|--------|----------|
| Only authenticated users can import ServiceM8 jobs into leads. | PASS | `importServiceM8LeadAction()` requires `auth()` before import. |
| Only users with the `leads` module grant can trigger the import action. | PASS | Added action-level `userCanAccessSlug(session.user.id, 'leads')` and a negative test. |
| ServiceM8 job-card values must not be trusted as arbitrary scoring keys. | PASS | Import uses exact `DECISION_MATRIX` option key/label matching and ignores unknown labels. |
| ServiceM8 note/free-text must not be stored or logged wholesale during auto-fill. | PASS | Only the `Project Type:` value is parsed from the configured note field; raw note is not inserted into lead fields or audit details. |
| Scoring must use the existing RGTools scoring engine. | PASS | Import calls `persistLeadScore(createdLeadId, actorId)` only after recognized fields are inserted. |
| Secrets must stay in environment variables. | PASS | Only env names are referenced; diff secret scan found no committed values. |

## Data classification

| Data | Classification | At rest | In transit | Retention | Notes |
|------|----------------|---------|------------|-----------|-------|
| ServiceM8 API key | Secret | Environment only | ServiceM8 API request header | Secret-store lifecycle | Read-only key used by import path. |
| ServiceM8 job number / uuid / status | Internal | `leads`, audit log | Server-to-ServiceM8 API | Lead/audit retention | Needed for linking and duplicate detection. |
| Client name, phone, email, company UUID | Personal / internal | `clients`, `contacts`, `leads` | Server-to-ServiceM8 API | Existing lead/client retention | Existing import behavior; no new PII field added. |
| ServiceM8 configured client type, project type, and note fields | Internal; note may contain PII | Parsed in memory only for this feature | Server-to-ServiceM8 API | Not stored as raw note by MT-184 | Only recognized mapped values persist. |
| Auto-filled matrix keys and budget band | Internal | `leads`, audit log | Internal app response | Lead/audit retention | Stored keys are canonical RGTools fields, not raw ServiceM8 prose. |

## Threat model

| Threat | Asset at risk | Existing mitigation | Residual risk |
|--------|---------------|---------------------|---------------|
| User without Leads access triggers import through a server action. | Lead records, ServiceM8-linked data | Fixed: action now checks `userCanAccessSlug(..., 'leads')` before cooldown/import. | Low. |
| Malicious or malformed ServiceM8 field value manipulates scoring. | Lead score integrity | Exact option key/label matching against `DECISION_MATRIX`; unknown values ignored; numeric quote value must be finite and positive. | Low. |
| ServiceM8 note contains private text that leaks into audit or lead prose. | PII/confidential job notes | Prefer configured `SERVICEM8_PROJECT_TYPE_FIELD` when present; fallback parser extracts only `Project Type:` up to `|`/newline; raw note is not stored or audited. | Low. |
| Job-number input causes query or request injection. | ServiceM8 requests, DB | Existing lookup helpers encode OData strings; DB writes use Drizzle query builder. | Low. |
| High-frequency import spam. | ServiceM8 API quota and app resources | Existing per-user in-memory cooldown remains before import. | Medium-low; distributed throttling is still broader platform work. |

## OWASP Top 10:2021

| Category | Result | Notes |
|----------|--------|-------|
| A01 Broken Access Control | PASS | Page guard already existed; action-level module authorization added during Omerta. |
| A02 Cryptographic Failures | PASS | No new crypto or plaintext secret storage. |
| A03 Injection | PASS | Drizzle writes; no raw SQL; ServiceM8 field labels parsed with escaped label regex and matrix allow-list. |
| A04 Insecure Design | PASS | Feature limits auto-fill to known fields and existing scoring engine. |
| A05 Security Misconfiguration | PASS | No new config surface beyond env field names. |
| A06 Vulnerable and Outdated Components | N/A | No dependency changes; full dependency audit not run in this pass. |
| A07 Identification and Authentication Failures | PASS | Auth required before import. |
| A08 Software and Data Integrity Failures | PASS | No deserialization/update pipeline change. |
| A09 Security Logging and Monitoring Failures | PASS | Audit logs import metadata and mapped fields, not raw note text or secrets. |
| A10 SSRF | PASS | User input chooses ServiceM8 job lookup, not arbitrary URLs. |

## ASVS 4.0 Level 2

| Chapter | Result | Notes |
|---------|--------|-------|
| V1 Architecture | PASS | Trust boundary documented: RGTools server reads ServiceM8 and writes RGTools DB. |
| V2 Authentication | PASS | Existing NextAuth session required. |
| V3 Session Management | N/A | No session behavior changed. |
| V4 Access Control | PASS | Action-level module authorization added and tested. |
| V5 Validation, Sanitization and Encoding | PASS | Matrix allow-list, finite numeric budget parsing, Drizzle DB writes. |
| V6 Stored Cryptography | N/A | No cryptographic storage change. |
| V7 Error Handling and Logging | PASS | No stack traces or raw ServiceM8 note in user response/audit. |
| V8 Data Protection | PASS | No raw note persistence; existing PII storage unchanged. |
| V9 Communications | PASS | Existing server-to-ServiceM8 HTTPS base URL. |
| V10 Malicious Code | N/A | No dependency/package changes. |
| V11 Business Logic | PASS | Import only accepts Quote jobs and known scoring values. |
| V12 Files and Resources | N/A | No file upload/download change. |
| V13 API and Web Service | PASS | Server action auth/authz checked; ServiceM8 API key stays server-side. |
| V14 Configuration | PASS | Env var names only; no secrets committed. |

## Verification

| Check | Result | Evidence |
|-------|--------|----------|
| Focused security regression tests | PASS | `pnpm.cmd --filter @rgtools/web test:run "app/(dashboard)/leads/__tests__/actions.test.ts" modules/leads/__tests__/servicem8-fetch.test.ts lib/servicem8/__tests__/client.test.ts modules/lead-intake/scoring/__tests__/score-lead.test.ts` -> 4 files, 60 tests passed. |
| Touched-file lint | PASS | `pnpm.cmd --filter @rgtools/web lint "app/(dashboard)/leads/actions.ts" "app/(dashboard)/leads/__tests__/actions.test.ts" modules/leads/servicem8-fetch.ts modules/leads/__tests__/servicem8-fetch.test.ts lib/servicem8/client.ts lib/servicem8/__tests__/client.test.ts` -> exit 0. |
| TypeScript | PASS | `pnpm.cmd exec tsc --noEmit -p apps/web/tsconfig.json` -> exit 0. |
| Prior shakedown focused pack | PASS | See `famiglia/servicem8-job-card-lead-prefill/shakedown.md`. |
| Broad suite | PASS after blocker repair | `pnpm.cmd test` now passes after stale quote-tracker action/webhook tests were updated. |

## Findings

| ID | Severity | Status | Finding | Resolution |
|----|----------|--------|---------|------------|
| OM-MT184-001 | High | Fixed | Import server action required authentication but did not re-check the `leads` module grant. | Added action-level `userCanAccessSlug(..., 'leads')` and negative regression coverage. |

## Residual risk

- No live ServiceM8 security smoke was run because this needs safe known test jobs.
- Earlier full repo shakedown failures from quote-tracker/auth/webhook tests have been repaired.
- Rate limiting remains in-memory and per-process; acceptable for this slice but not a complete abuse-control strategy.
