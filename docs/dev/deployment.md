# Deployment

rgtools has two independently deployed components:
1. **Next.js app** — deployed to Vercel
2. **Quote tracker worker** — deployed to Cloudflare Workers

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

## Quote tracker worker (Cloudflare Workers)

The worker lives in `workers/tracker/`. It is deployed with [Wrangler](https://developers.cloudflare.com/workers/wrangler/).

### First-time setup

```bash
cd workers/tracker
pnpm install

# Authenticate with your Cloudflare account
npx wrangler login

# Store the Neon DATABASE_URL as an encrypted secret (never a plain var)
npx wrangler secret put DATABASE_URL
# Paste the production Neon connection string when prompted
```

### Configure the route

Edit `workers/tracker/wrangler.toml` and uncomment the `[[routes]]` block:

```toml
[[routes]]
pattern = "tracker.rgtools.co.nz/*"
zone_name = "rgtools.co.nz"
```

The `zone_name` must match a domain managed in your Cloudflare account.

### Deploy

```bash
cd workers/tracker
npx wrangler deploy
```

### Update the DATABASE_URL secret

```bash
cd workers/tracker
npx wrangler secret put DATABASE_URL
```

### Local development

```bash
cd workers/tracker
npx wrangler dev
```

The worker runs locally at `http://localhost:8787`. Use `POST /track` with a JSON body matching the `BeaconPayload` type in `src/validate.ts`.

---

## Rollback

- **Vercel** — use the Vercel dashboard to re-deploy a previous deployment instantly
- **Cloudflare Worker** — `npx wrangler rollback` reverts to the previous uploaded version
- **Database** — there is no automatic rollback for migrations; keep a Neon branch or snapshot before running migrations on production
