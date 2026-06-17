# Deployment

rgtools has two independently deployed parts:
1. **Next.js app** — deployed to Vercel
2. **Cloudflare Workers** (`workers/`) — four separate Worker deploys backing the quote tracker:
   - `rg-viewer` — public PDF viewer + email gate (`workers/viewer`)
   - `rg-tracker` — engagement beacon endpoint (`workers/tracker`)
   - `rg-notifier` — open / high-intent email notifications, cron (`workers/notifier`)
   - `rg-cleanup` — expiry + IP purge, cron (`workers/cleanup`)

## Next.js app (Vercel)

### Environment variables

Set all variables from [setup.md](setup.md#environment-variables) in the Vercel project settings under **Settings → Environment Variables**. Apply to Production, Preview, and Development as appropriate.

`NEXT_PUBLIC_*` variables are embedded at build time — they must be set before deploying.

For calculator lead submission, confirm these are set before routing production traffic:

- `CALCULATOR_ALLOWED_ORIGIN=https://www.royalglass.co.nz`
- `TURNSTILE_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM="Royal Glass <support@royalglass.co.nz>"`
- pooled Neon `DATABASE_URL`

The Resend sending domain `royalglass.co.nz` must remain verified with SPF, DKIM, and DMARC. `support@royalglass.co.nz` should be a monitored mailbox because customer replies go there.

### Deploy

Vercel auto-deploys on push to `main`. No special build configuration is needed beyond what is in `package.json`:

```
Build command:  next build
Output dir:     .next
Install cmd:    pnpm install
```

### Database migrations

Run migrations **before** the new app version serves traffic:

```bash
DATABASE_URL=<production-url> pnpm db:migrate
```

Or add this as a Vercel build step (runs during CI before the deploy goes live):

```
Build command: pnpm db:migrate && next build
```

### Scoring config seed

Seeding is a one-time operation per config version. Run it against the production database when releasing a new scoring config:

```bash
DATABASE_URL=<production-url> pnpm tsx scripts/seed-scoring-config-v3.ts
```

---

## Cloudflare Workers

All four workers live under `workers/` and are deployed independently with [Wrangler](https://developers.cloudflare.com/workers/wrangler/). They share the Neon database; `rg-viewer` and `rg-cleanup` also bind the `rg-quotes` R2 bucket.

### One-time prerequisites

```bash
npx wrangler login          # authenticate with the Cloudflare account
# Create the R2 bucket once (used by viewer + cleanup):
npx wrangler r2 bucket create rg-quotes
```

### Secrets per worker

Each worker reads its config from encrypted secrets (never plain vars). Set them from the worker's own directory:

| Worker | Secrets |
|--------|---------|
| `rg-viewer` | `DATABASE_URL` |
| `rg-tracker` | `DATABASE_URL` |
| `rg-notifier` | `DATABASE_URL`, `RESEND_API_KEY` |
| `rg-cleanup` | `DATABASE_URL` |

```bash
cd workers/<name>
npx wrangler secret put DATABASE_URL
# notifier also:
npx wrangler secret put RESEND_API_KEY
```

### Deploy

```bash
cd workers/viewer   && npx wrangler deploy
cd workers/tracker  && npx wrangler deploy
cd workers/notifier && npx wrangler deploy   # cron: */10 * * * *
cd workers/cleanup  && npx wrangler deploy   # cron: 0 2 * * *
```

The cron schedules are declared in each worker's `wrangler.toml` (`[triggers] crons`) and take effect on deploy — no separate setup.

### Viewer custom domain

`rg-viewer` serves the public quote links. The custom-domain route in `workers/viewer/wrangler.toml` is committed but commented out until `royalglass.co.nz` is fully on Cloudflare. To enable it, uncomment:

```toml
[[routes]]
pattern = "quotes.royalglass.co.nz"
custom_domain = true
```

Cloudflare auto-creates the DNS record and edge TLS certificate on deploy. `rg-viewer` also points `TRACKER_URL` (a plain var in its `wrangler.toml`) at the deployed `rg-tracker` URL.

### Local development

```bash
cd workers/<name>
npx wrangler dev
```

The tracker runs locally at `http://localhost:8787` — `POST /track` with a JSON body matching the `BeaconPayload` type in `src/validate.ts`. Cron workers (`notifier`, `cleanup`) can be triggered locally with `npx wrangler dev` then hitting the scheduled endpoint, or `wrangler dev --test-scheduled`.

---

## Rollback

- **Vercel** — use the Vercel dashboard to re-deploy a previous deployment instantly
- **Cloudflare Worker** — `npx wrangler rollback` (from the worker's directory) reverts to the previous uploaded version
- **Database** — there is no automatic rollback for migrations; keep a Neon branch or snapshot before running migrations on production
