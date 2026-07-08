# Security requirements — everything (leads feature set)

Mode: retrofit · Stack: node/next · Date: 2026-06-30

## Actors

| Actor | Trust level | Capabilities |
|-------|-------------|-------------|
| Unauthenticated visitor | Untrusted | None — proxy blocks all `/leads/*` routes |
| Authenticated staff (non-admin) | Semi-trusted | View leads, import from ServiceM8, generate AI suggestions |
| Authenticated admin | Trusted (internal) | All of the above + delete, restore, batch-delete leads |
| ServiceM8 API | External system | Source of job data; responses not fully trusted |
| OpenAI API | External system | Returns AI-generated text; response treated as string only |

## Security acceptance criteria

1. Every request to `/leads/**` must require a valid session **and** `leads` module access grant.
2. Soft-delete (archive) and restore operations must be restricted to admin role only, enforced server-side on every call.
3. All lead mutations must produce an audit log entry with actorId, action, before/after.
4. AI suggestion generation must be logged as a security-relevant event.
5. No PII (client name, phone, email, address) must appear in audit log fields.
6. ServiceM8 API keys must be read from environment variables; never hardcoded.
7. DB queries must use parameterized statements; no string-concatenated SQL.
8. Sort column and filter enum inputs from URL must be validated against explicit allowlists before reaching the DB.
9. LIKE search patterns must escape `%`, `_`, and `\` before parameterization.
10. Expensive external-API actions (AI suggestion, SM8 import) must be rate-limited per authenticated user.

## Abuse cases

- Staff member spams "Get suggestion" to exhaust OpenAI quota.
- Staff member calls `importServiceM8LeadAction` in a loop to enumerate SM8 jobs.
- Attacker with a stolen session token attempts to delete leads via `deleteLeadAction`.
- Attacker injects wildcard characters into the search box to broaden results.
- Attacker passes a non-UUID string as `leadId` to cause a DB error or unexpected query.

## Compliance obligations

NZ Privacy Act 2020 applies — leads contain personal information (name, email, phone, address) of identifiable individuals. See data-classification.md.

## Blast radius if fully compromised

- All client contact details (name, email, phone) exposed to attacker.
- All lead history and AI suggestions exposed.
- All leads soft-deleted (recoverable from DB backup).
- ServiceM8 read/write keys potentially exposed if env exfiltrated.
