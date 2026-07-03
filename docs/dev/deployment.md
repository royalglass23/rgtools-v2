# Deployment

rgtools has two independently deployed parts:

1. **Next.js apps** - Vercel deploys the internal RG Tools app from `apps/web`; `apps/catalog` is a placeholder workspace app.
2. **Cloudflare Workers** - separate deploys under `workers/` for quote viewing, tracking, notifications, and cleanup.

## Next.js app (Vercel)

### Project settings

The internal app is no longer at the repository root. Configure the RG Tools Vercel project as:

```text
Root Directory: apps/web
Framework:      Next.js
Build command:  pnpm build
Output dir:     .next
Install cmd:    pnpm install --frozen-lockfile
```

The root `package.json` is a workspace orchestrator. The `next` dependency lives in `apps/web/package.json`, so Vercel must use `apps/web` as the project root. If Vercel reports `No Next.js version detected`, this setting is usually wrong.

`apps/web/vercel.json` disables automatic deployments for every branch except:

- `main` - production
- `dev` - staging/preview

Feature branches should merge into `dev`; promote `dev` to `main` when ready for production. See [branch workflow](branch-workflow.md) for the exact pull request flow and the automatic `dev` sync after production merges.

### Environment variables

Set all variables from [setup.md](setup.md#environment-variables) in Vercel under **Settings -> Environment Variables**. Scope them per environment.

Production must have:

- pooled production Neon `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_TRUST_HOST=true`
- `CALCULATOR_ALLOWED_ORIGIN=https://www.royalglass.co.nz`
- `TURNSTILE_SECRET`
- `SERVICEM8_API_KEY`, plus `SERVICEM8_API_KEY_FULL` only where lead-quality write-back is enabled
- `SERVICEM8_SYNC_SECRET`
- `SERVICEM8_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM="Royal Glass <support@royalglass.co.nz>"`
- `OPENAI_API_KEY` if lead or quote AI guidance is enabled
- R2 credentials when the app writes quote or PS template files directly through the storage abstraction

Preview (`dev`) must use the dev Neon branch connection string, not production. Do not set a global `AUTH_URL` or `NEXTAUTH_URL` that points production at a preview host.

`NEXT_PUBLIC_*` variables are embedded at build time and must be set before deployment.

Keep local, preview, and production separated:

| Surface | Dev/staging | Production |
|---------|-------------|------------|
| Neon | `dev` branch pooled URL | `production` branch pooled URL |
| Vercel | Preview environment | Production environment |
| Viewer worker | `rg-dev-quote` bucket and dev DB secret | `rg-quotes` bucket and prod DB secret |
| Quote links | Dev viewer URL only for testing | `https://quotes.royalglass.co.nz` |

### Database migrations

Run migrations before the new app version serves traffic:

```bash
DATABASE_URL=<production-url> pnpm db:migrate
```

For a safer one-off production migration that does not require changing `.env.local`, set `DB_URL_PROD` and run:

```bash
pnpm db:migrate:prod
```

The `@rgtools/web` build script also runs root migrations before `next build`.

### Seed operations

Seed scripts are operational commands, not part of every deploy.

```bash
pnpm seed
pnpm seed:production-access
pnpm seed:ps-generator
pnpm seed:tracking
pnpm --dir apps/web tsx scripts/seed-scoring-config-v4.ts
```

`pnpm seed` creates/updates the protected admin user and module rows. `pnpm seed:production-access` only inserts missing staff grants for production-safe modules (`lead-intake`, `leads`, and `quote-tracker`); it does not reset passwords or grant dev-only modules. `pnpm seed:ps-generator` inserts the published `wordpress-plugin-v1` PS Generator config. `pnpm seed:tracking` upserts quote tracking settings. PS generation also requires the referenced template PDFs in R2.

Do not put seed operations in the default Vercel build command. Run them as explicit release steps against the intended database, after confirming the deployment target and environment variables.

## Cloudflare Workers

The quote tracker uses four workers:

| Worker | Path | Purpose |
|--------|------|---------|
| `rg-viewer` | `workers/viewer` | Public PDF.js viewer and email gate |
| `rg-tracker` | `workers/tracker` | Engagement beacon endpoint |
| `rg-notifier` | `workers/notifier` | First-open and high-intent notification cron |
| `rg-cleanup` | `workers/cleanup` | Expired PDF cleanup and raw IP purge cron |

All workers are deployed independently with Wrangler. They share Neon; `rg-viewer` and `rg-cleanup` also bind the `rg-quotes` R2 bucket.

### One-time prerequisites

```bash
npx wrangler login
npx wrangler r2 bucket create rg-quotes
```

### Secrets per worker

Set secrets from each worker directory:

| Worker | Secrets |
|--------|---------|
| `rg-viewer` | `DATABASE_URL`, `GATE_HMAC_SECRET` |
| `rg-tracker` | `DATABASE_URL` |
| `rg-notifier` | `DATABASE_URL`, `RESEND_API_KEY` |
| `rg-cleanup` | `DATABASE_URL` |

```bash
cd workers/<name>
npx wrangler secret put DATABASE_URL
```

For notifier:

```bash
cd workers/notifier
npx wrangler secret put RESEND_API_KEY
```

For viewer email-gate enforcement:

```bash
cd workers/viewer
npx wrangler secret put GATE_HMAC_SECRET
npx wrangler secret put GATE_HMAC_SECRET --env prod
```

The committed `wrangler.toml` files may contain non-secret settings such as `TRACKER_URL` and R2 bucket bindings. Sensitive values belong in Worker secrets.

### Deploy workers

```bash
cd workers/viewer   && npx wrangler deploy
cd workers/tracker  && npx wrangler deploy
cd workers/notifier && npx wrangler deploy
cd workers/cleanup  && npx wrangler deploy
```

Cron schedules are declared in each worker's `wrangler.toml` and take effect on deploy.

### Viewer custom domain

`rg-viewer` serves public quote links at `quotes.royalglass.co.nz/q/<code>`. The custom-domain route in `workers/viewer/wrangler.toml` is committed but commented until `royalglass.co.nz` is fully on Cloudflare:

```toml
[[routes]]
pattern = "quotes.royalglass.co.nz"
custom_domain = true
```

`rg-viewer` points `TRACKER_URL` at the deployed `rg-tracker` URL.

### Local worker development

```bash
cd workers/<name>
npx wrangler dev
```

Cron workers can be tested locally with `wrangler dev --test-scheduled`.

## ServiceM8 webhook

The app exposes `POST /api/servicem8/attachment` for ServiceM8 quote attachment webhooks. Register or refresh it after the production callback URL or shared secret changes:

```bash
pnpm servicem8:webhook:register
```

The script reads `SERVICEM8_ATTACHMENT_WEBHOOK_URL` and `SERVICEM8_WEBHOOK_SECRET`. The route verifies the webhook secret before creating or updating tracked quote records.

## Rollback

- **Vercel** - redeploy a previous deployment from the Vercel dashboard.
- **Cloudflare Worker** - run `npx wrangler rollback` from the worker directory.
- **Database** - no automatic rollback; keep a Neon branch or snapshot before production migrations.
