# Security Runbook

This document is the internal engineering security reference for rgtools. It complements the [security policy](../SECURITY.md).

## Data handled by rgtools

rgtools handles:

- Staff usernames, password hashes, roles, and module grants.
- Client names, companies, phone numbers, emails, addresses, notes, lead scores, and ServiceM8 references.
- Quote PDFs, quote links, quote recipient emails, viewer events, engagement summaries, and tracking settings.
- Generated PS1/PS3 PDF outputs and PS Generator configuration.
- Audit and error logs.

Treat all of the above as internal or customer data. Do not paste real records, quote PDFs, generated PDFs, secrets, or customer-identifying logs into public channels or AI prompts.

## Authentication and access control

- NextAuth v5 credentials auth issues JWT sessions.
- `apps/web/proxy.ts` redirects unauthenticated dashboard routes.
- Dashboard layouts require an authenticated session.
- Module access checks live in `apps/web/lib/guard.ts`, `apps/web/lib/access.ts`, and `apps/web/lib/access-db.ts`.
- Admins can access all active modules.
- Staff must have a `user_module_access` grant for each module.
- Mutating server actions and API routes should check both authentication and the relevant module/admin permission before writing.
- Admin-only operations include user management, module grants, scoring/pricing/tracking configuration, lead import, client merge review, audit/error exports, and PS Generator configuration.

Protected account behavior and module grants should stay auditable. Do not bypass the access helpers with one-off DB writes unless performing a documented emergency repair.

## Secrets

Never commit secrets. Use:

- `.env.local` for local development only.
- Vercel environment variables for the Next.js app.
- `wrangler secret put` for Cloudflare Workers.
- `DB_URL_PROD` for one-off production migrations, instead of changing everyday `DATABASE_URL`.

Sensitive values include:

- `DATABASE_URL` and `DB_URL_PROD`
- `AUTH_SECRET`
- `SERVICEM8_API_KEY`, `SERVICEM8_API_KEY_FULL`, `SERVICEM8_SYNC_SECRET`, `SERVICEM8_WEBHOOK_SECRET`
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and dev equivalents
- `GATE_HMAC_SECRET`
- `RESEND_API_KEY`
- `OPENAI_API_KEY`
- `TURNSTILE_SECRET`
- Google Maps API keys

`wrangler.toml` may contain non-secret settings such as `TRACKER_URL`, cron schedules, custom routes, and R2 bucket names. Do not put database URLs, API keys, signing secrets, or mail keys in `[vars]`.

## Environment separation

| Environment | Database | Storage | Notes |
|-------------|----------|---------|-------|
| Local | Neon `dev` branch | Local storage or dev R2 bucket | Default for development and tests |
| Vercel preview / `dev` | Neon `dev` branch | Dev R2 bucket where possible | Staging only |
| Production / `main` | Neon `production` branch | Production R2 bucket | Live customer data |

Before running scripts that mutate data, check the target:

```powershell
git status --short --branch -uall
$env:DATABASE_URL
```

Use synthetic test identifiers such as `QT-TEST-*` for quote-tracker verification and clean them up after testing.

## Public surfaces

Public or semi-public surfaces:

- `POST /api/lead-intake/calculator-submit`, restricted by `CALCULATOR_ALLOWED_ORIGIN`, Turnstile in production, and anti-spam helpers.
- `POST /api/servicem8/attachment`, verified with `SERVICEM8_WEBHOOK_SECRET`.
- `workers/viewer` quote links under `/q/<code>`.
- `workers/viewer` `/privacy`.
- `workers/tracker` `POST /track`.

Public routes should not expose stack traces, internal IDs beyond what is required, raw R2 object URLs, or unredacted secrets.

## Quote tracking privacy and retention

- The viewer shows privacy/cookie links and serves a quote-viewer notice at `/privacy`.
- Optional email gate recipient matching is enforced before the PDF is served.
- Gate access uses `GATE_HMAC_SECRET` to sign a short-lived proof for PDF access.
- Raw IP addresses in quote events are purged by cleanup retention.
- Expired quote PDFs are deleted from R2 and their rows are archived.
- Staff should disable tracking or the email gate before sending a quote when the relationship or context calls for a lighter privacy posture.

See [quote-tracking.md](quote-tracking.md) for the privacy note.

## Audit and logs

Audit logs exist for access/admin changes and major domain actions such as lead edits, ServiceM8 sync events, quote actions, PS configuration changes, and client merge work. Error logs are available to admins.

Do not log:

- Passwords or password hashes.
- API keys or bearer tokens.
- Full database URLs.
- Raw customer PDFs.
- Full OpenAI prompts containing unnecessary customer data.

When adding a new mutation, include an audit row unless the action is purely transient or already covered by a parent audited operation.

## AI guidance

Lead and quote AI guidance use `OPENAI_API_KEY` when configured. The prompts should include only the operational context required for the staff-facing suggestion. AI output is advisory; it must not automatically send customer messages or mutate operational state.

If AI guidance fails, show a safe staff-facing error and avoid leaking provider response bodies with sensitive request details.

## Incident checklist

1. Identify the environment, route/worker/script, time window, and affected data class.
2. Revoke or rotate exposed secrets immediately.
3. Disable affected automation if it can continue causing harm: Vercel env, Worker route, cron, webhook, or API key.
4. Preserve relevant audit/error logs.
5. Patch on a branch from `dev`, verify, merge to `dev`, then promote `dev` to `main`.
6. Backfill, purge, or notify as directed by the system owner.

For production database changes, prefer a Neon branch/snapshot before repair work and use `DB_URL_PROD` only for the explicit command being run.
