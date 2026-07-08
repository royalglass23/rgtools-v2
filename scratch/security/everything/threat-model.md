# Threat model — everything (leads feature set)

Mode: retrofit · Date: 2026-06-30

## Data flow

```
Browser (staff/admin)
  │
  ├─→ Next.js proxy middleware (auth gate — proxy.ts)
  │     └─→ Dashboard layout → leads layout (requireModule guard — layout.tsx)
  │           │
  │           ├─→ GET /leads → LeadsPage (server component)
  │           │     ├─→ getLeadsList() → Neon DB (parameterized)
  │           │     └─→ ImportServiceM8LeadForm (client component)
  │           │
  │           └─→ GET /leads/[id] → LeadDetailPage (server component)
  │                 ├─→ getLeadDetail(id) → Neon DB (UUID-validated, parameterized)
  │                 ├─→ AiSuggestionButton (client component)
  │                 └─→ ServiceM8FetchButton (client component)
  │
  ├─→ Server Action: importServiceM8LeadAction(jobNumber)
  │     ├─→ auth() check — any authenticated user
  │     └─→ importLeadFromServiceM8JobNumber() → ServiceM8 API (HTTPS) → Neon DB
  │
  ├─→ Server Action: generateLeadSuggestionAction(leadId)
  │     ├─→ auth() check — any authenticated user
  │     ├─→ getLeadDetail() → Neon DB
  │     ├─→ getJobNotesAndEmails() → ServiceM8 API (HTTPS)  [if linked]
  │     ├─→ generateSuggestion() → OpenAI API (HTTPS)
  │     └─→ db.update(leads) → Neon DB
  │
  ├─→ Server Action: deleteLeadAction(leadId)        [admin only]
  ├─→ Server Action: batchDeleteLeadsAction(formData) [admin only]
  └─→ Server Action: restoreLeadAction(formData)      [admin only]
```

## STRIDE analysis

### Entry point: importServiceM8LeadAction(jobNumber)

| Threat | Asset at risk | Attack | Existing mitigation | Residual risk |
|--------|---------------|--------|---------------------|---------------|
| Spoofing | Session | Stolen JWT used to import | NextAuth JWT expiry + httpOnly cookie | Low |
| Tampering | SM8 data | Malformed jobNumber injected | String trim+uppercase; SM8 resolveJobUuid validates | Low |
| Repudiation | Import event | Staff denies importing a lead | `logAudit` records actorId + job details | Low |
| Info disclosure | SM8 job data | Error message leaks SM8 detail | Structured error shapes returned, no stack traces | Low |
| Denial of service | OpenAI/SM8 quota | Staff spams import button | **No rate limiting** | **Medium** |
| EoP | Admin-only data | Non-admin triggers import | auth check present; import is intentionally non-admin | Low |

### Entry point: generateLeadSuggestionAction(leadId)

| Threat | Asset at risk | Attack | Existing mitigation | Residual risk |
|--------|---------------|--------|---------------------|---------------|
| Spoofing | Session | Stolen JWT to trigger AI | NextAuth JWT expiry | Low |
| Tampering | Lead data | Non-owner triggers AI regen on any lead | UUID validated; only authenticated users; single-org tool | Low-Medium |
| Repudiation | AI generation | No record of who triggered AI | **No logAudit call** | **Medium** |
| Info disclosure | SM8 job notes/emails | AI response leaks SM8 context to caller | Only suggestion text returned, not raw SM8 data | Low |
| Denial of service | OpenAI quota | Staff spams "Get suggestion" | **No rate limiting per user** | **Medium** |
| EoP | N/A | — | — | — |

### Entry point: deleteLeadAction / batchDeleteLeadsAction (admin only)

| Threat | Asset at risk | Attack | Existing mitigation | Residual risk |
|--------|---------------|--------|---------------------|---------------|
| Spoofing | Admin session | Non-admin forges admin session | Server-side role check on every call | Low |
| Tampering | Lead record | Admin deletes wrong lead | Soft-delete only (archivedAt); audit logged; restore available | Low |
| Repudiation | Deletion event | Admin denies bulk delete | `logAudit` records every leadId deleted | Low |
| EoP | Admin actions | Staff accesses admin-only action | `session?.user?.role !== 'admin'` check throws Forbidden | Low |

### Entry point: leads list GET (search/filter)

| Threat | Asset at risk | Attack | Existing mitigation | Residual risk |
|--------|---------------|--------|---------------------|---------------|
| Injection | DB | LIKE wildcard injection in search | `escapeLike` escapes `%`, `_`, `\`; Drizzle parameterized | Low |
| Injection | DB | Sort column injection | Whitelist `LEADS_SORT_COLUMNS` validated before use | Low |
| Info disclosure | All leads | Non-module-member views leads | `requireModule` guard in layout + proxy middleware | Low |

## Unmitigated high risks

None at High severity. Two Medium items become checklist FAILs:

1. **Missing rate limit on AI suggestion** — authenticated user can exhaust OpenAI quota freely.
2. **Missing audit log for AI suggestion** — security-relevant event not captured.
