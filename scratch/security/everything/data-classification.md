# Data classification — everything (leads feature set)

Mode: retrofit · Stack: node/next · Date: 2026-06-30

| Data | Classification | At rest | In transit | Retention | Notes |
|------|----------------|---------|------------|-----------|-------|
| Client name | Personal (PII) | Neon DB (US) | TLS | Until hard-deleted | `clients.name` |
| Company name | Personal (PII) | Neon DB (US) | TLS | Until hard-deleted | `clients.companyName` |
| Client email | Personal (PII) | Neon DB (US) | TLS | Until hard-deleted | `clients.email` |
| Client phone | Personal (PII) | Neon DB (US) | TLS | Until hard-deleted | `clients.phone` |
| Job address / location | Personal (PII) | Neon DB (US) | TLS | Until hard-deleted | `leads.location` — home/site address |
| Free text notes | Confidential | Neon DB (US) | TLS | Until hard-deleted | `leads.freeText` — may contain PII |
| AI suggestion text | Confidential | Neon DB (US) | TLS | Until hard-deleted | `leads.aiSuggestion` — generated from lead+SM8 context |
| ServiceM8 job UUID | Internal | Neon DB (US) | TLS | Until hard-deleted | `leads.servicem8JobUuid` |
| ServiceM8 job number | Internal | Neon DB (US) | TLS | Until hard-deleted | `leads.servicem8JobNumber` |
| ServiceM8 API key (read-only) | Secret | Env var only | — | Rotated on compromise | `SERVICEM8_API_KEY` — never stored in DB |
| ServiceM8 API key (full-access) | Secret | Env var only | — | Rotated on compromise | `SERVICEM8_API_KEY_FULL` — never stored in DB |
| OpenAI API key | Secret | Env var only | — | Rotated on compromise | `OPENAI_API_KEY` — never stored in DB |
| SM8 lead-quality field UUID | Internal | Env var | — | — | `SERVICEM8_LEAD_QUALITY_FIELD` |
| Audit log entries | Confidential | Neon DB (US) | TLS | 12 months | actorId, action, entityType, targetId, before/after — **no PII in before/after fields** |
| Lead scoring data | Internal | Neon DB (US) | TLS | Until hard-deleted | tier, seedScore, category scores |

## NZ Privacy Act 2020 — data inventory flags

- **Personal data collected:** client name, email, phone, job address. Collected via ServiceM8 import or lead-intake form.
- **Cross-border storage:** All personal data stored in Neon (US-east region). See IPP12 in the security report.
- **Retention path:** Soft-delete (`archivedAt`) exists. No automated hard-delete or retention schedule implemented.
- **Access path:** No self-service access/export for individuals — admin-only DB access.
- **Correction path:** Staff can edit via lead-intake form; no self-service path for individuals.
- **Logging of PII:** Audit log before/after fields do **not** contain raw PII fields (name, email, phone). Confirmed by code review of `logAudit` calls.
