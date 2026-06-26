# DNS Migration Record — Bluehost → Cloudflare (royalglass.co.nz)

**Date completed:** 2026-06-24
**Performed by:** RoyalGlass (registrant: Roxy Huang) with Claude Code
**Result:** ✅ Success — DNS moved to Cloudflare with **zero downtime** to email or website;
`quotes.royalglass.co.nz` and `track.royalglass.co.nz` now serve the quote-tracker Workers.

> This is the **as-built record** of how the migration actually went, including the
> problems we ran into and how we fixed them. For the pre-flight checklist and full
> record inventory, see the companion playbook: [`dns-migration-cloudflare.md`](./dns-migration-cloudflare.md).

---

## 1. Why we did this

The quote-tracker viewer Worker (`rg-viewer`) was serving from the ugly default URL
`rg-viewer.royalglass.workers.dev`. We wanted it on a branded subdomain,
`quotes.royalglass.co.nz`.

**The hard requirement:** a Cloudflare Worker can only bind a *custom domain* if that
domain's zone is active in the same Cloudflare account. So `royalglass.co.nz`'s **DNS had
to move to Cloudflare** first. The catch — the domain also runs the **company website**
(Bluehost) and **email** (QQ / Tencent Exmail), and neither could break.

### The starting setup

| Service | Provider | Detail |
|---------|----------|--------|
| Registrar | 1st Domains (1stdomains.nz) | Registrant/admin: Roxy Huang |
| DNS host | **Bluehost** | `ns1.bluehost.com` / `ns2.bluehost.com` |
| Website | Bluehost server | `108.179.214.94` |
| Email | QQ / Tencent Exmail | `mxbiz1.qq.com` (pri 5), `mxbiz2.qq.com` (pri 10) |

---

## 2. The mental model that made it safe

The single most important concept, and the source of most of the worry:

> **Changing nameservers moves the DNS "phonebook," not the services themselves.**

Cloudflare becomes the thing that *answers* "where is royalglass.co.nz's website / mail
server?" — but the website stays on Bluehost and email stays on QQ, **as long as the
matching records (A, MX, etc.) are recreated in Cloudflare before the switch**. Nothing
about the mailboxes or website files is moved or touched.

The only way email/site break is if you flip nameservers to Cloudflare *before* Cloudflare
has all the records. So the whole game is: **stage every record first, switch last.**

---

## 3. The process, start to finish

1. **Added `royalglass.co.nz` to Cloudflare** (free plan) and let it scan/import the
   existing Bluehost records.

2. **Captured the live zone directly from DNS** as the source of truth, rather than trusting
   the import blindly. We queried the authoritative records (A, CNAME, MX, TXT) over public
   resolvers. This is also how we recovered the **DKIM key** (see Issue C).

3. **Recreated every record in Cloudflare** and compared against the live capture:
   - `A @` and `A mail` → `108.179.214.94`
   - `CNAME www / webmail / cpanel / ftp` → `royalglass.co.nz`
   - `MX` → `mxbiz1.qq.com` (5), `mxbiz2.qq.com` (10)
   - `TXT` SPF, four `google-site-verification` records
   - `TXT default._domainkey` → the QQ DKIM key
   - Plus extras the import found: Resend (`resend._domainkey`), Amazon SES (`send`
     subdomain MX + SPF), Mailchimp (`k2/k3._domainkey`)
   - All mail/site records set to **DNS only (grey cloud)**; only the website (`@`, `www`)
     left **Proxied (orange)**.

4. **Changed the nameservers at 1st Domains** to the Cloudflare pair:
   `jason.ns.cloudflare.com` / `walk.ns.cloudflare.com`.

5. **Waited for propagation** until Cloudflare reported the zone **Active** (well under the
   24h worst case).

6. **Verified** site + email still worked, then **bound the Workers** to their custom
   domains and deployed.

---

## 4. Issues we hit and how we solved them

### Issue A — "Will my email get moved to Cloudflare?"
**Concern:** changing nameservers would somehow transfer the QQ mailboxes.
**Reality / fix:** No. Nameservers only control DNS resolution. Email stays on QQ Exmail;
we just recreate the `MX` records (still pointing at `mxbiz1/2.qq.com`) in Cloudflare so the
answer stays identical. Verified after the switch that MX was unchanged.

### Issue B — Registrar warning about disrupting services
**Symptom:** 1st Domains showed a warning: *"Updating name servers… may result in the
disruption of any existing services such as email and web hosting."*
**Fix:** Treated it as a reminder to **stage all records first**. Before clicking Submit we
confirmed Cloudflare's DNS already contained the website `A` record, both QQ `MX` records,
SPF, and DKIM. Only then submitted.

### Issue C — DKIM key not available from QQ admin
**Problem:** We did **not** have access to the QQ Exmail admin console, so we couldn't read
the DKIM record from there. Missing DKIM would weaken email deliverability.
**Fix:** Read the live `default._domainkey.royalglass.co.nz` **TXT record straight from
public DNS**. `nslookup` truncated the long RSA key, so we fetched the complete value via
Google's DNS-over-HTTPS JSON API (`https://dns.google/resolve?...&type=TXT`) and recreated
it exactly. DKIM selector turned out to be **`default`**.

### Issue D — cPanel service records imported as Proxied (orange cloud)
**Problem:** Cloudflare's import set `cpanel`, `whm`, `webmail`, and `webdisk` to **Proxied**.
These run on **non-standard ports** (2082–2096, 2087) that Cloudflare's proxy does **not**
forward — so they'd appear broken after the switch.
**Fix:** Switched all four to **DNS only (grey cloud)** so they resolve straight to Bluehost.
(`mail` and `ftp` were already correctly DNS-only.) Note: the cPanel service itself never
stops — this only affected reaching it via the hostname; the direct
`https://108.179.214.94:2083` route always works as a fallback.

### Issue E — Duplicate / invalid DMARC
**Problem:** Two `_dmarc` TXT records existed (only one is valid per spec):
- `v=DMARC1; p=none; rua=mailto:support@royalglass.co.nz`
- `v=DMARC1; p=quarantine; pct=100; rua=mailto:info@royalglass.co.nz`
**Fix:** Deleted the weaker `p=none … support@` record; kept the stricter
`p=quarantine … info@` one.

### Issue F — `wrangler deploy` run from the wrong directory
**Symptom:** Running `pnpm wrangler deploy` from the **repo root** launched the Next.js
framework wizard — it tried to deploy the whole app as a Worker named `rgtools` with output
dir `.next`. That is **not** what we wanted (the app lives on Vercel; `.next` won't run on
Cloudflare without an adapter anyway).
**Fix:** Cancelled with `Ctrl+C` and ran the deploy from **inside the worker's folder**
(`workers/viewer`), where its own `wrangler.toml` (`name = "rg-viewer"`) lives. From there
wrangler deploys the small standalone Worker and binds the custom-domain route — no Next.js
prompts.

### Issue G — DNSSEC temptation
**Risk avoided:** The registrar offered an "Enable DNSSEC" button. Enabling it at the
registrar **without** configuring a matching DS record in Cloudflare would have broken the
**entire domain** (unresolvable site + email).
**Decision:** Left DNSSEC **disabled**. It can be added safely later via Cloudflare's guided
flow (Cloudflare generates the DS record, you paste it at 1st Domains).

### Issue H — Quote links still showed the old workers.dev URL (app-level, post-migration)
**Symptom:** After the domain was live, newly tracked quotes still produced links like
`https://rg-viewer.royalglass.workers.dev/q/<code>`.
**Root cause:** Quote links are generated **at runtime** from the `VIEWER_BASE_URL`
environment variable (`apps/web/modules/quote-tracker/create-tracked-quote.ts` -> `viewerLink()`),
**not** stored in the database. The Vercel production env still had `VIEWER_BASE_URL` set to
the old workers.dev URL, which overrides the code default.
**Fix:** Set `VIEWER_BASE_URL = https://quotes.royalglass.co.nz` in Vercel and redeploy.
No database change needed — old quotes also re-render with the new domain because the URL is
computed, not persisted.

---

## 5. Verification (after the switch)

| Check | Command | Expected | Result |
|-------|---------|----------|--------|
| Nameservers flipped | `nslookup -type=ns royalglass.co.nz` | `jason/walk.ns.cloudflare.com` | ✅ |
| Email intact | `nslookup -type=mx royalglass.co.nz` | `mxbiz1/2.qq.com` (5/10) | ✅ |
| Website up | `curl -I https://royalglass.co.nz` | `200 OK` + `cf-ray` header | ✅ |
| www redirect | `curl -I https://www.royalglass.co.nz` | `301` → apex | ✅ |
| Quote viewer | open `https://quotes.royalglass.co.nz/q/<code>` | PDF viewer loads | ✅ |
| Tracker endpoint | `curl -I https://track.royalglass.co.nz/track` | `405` on GET (POST-only) + `cf-ray` | ✅ |

Plus a real end-to-end check: opened a live quote and confirmed view events recorded.

---

## 6. Outcome

- **DNS is now hosted by Cloudflare** (`jason`/`walk.ns.cloudflare.com`).
- **Email (QQ Exmail) and the Bluehost website kept working throughout — no outage.**
- **`quotes.royalglass.co.nz`** → `rg-viewer` Worker (custom domain, auto TLS).
- **`track.royalglass.co.nz`** → `rg-tracker` Worker (moved off `*.workers.dev` so
  engagement beacons aren't blocked by ad-blockers/firewalls). The viewer's `TRACKER_URL`
  points at `https://track.royalglass.co.nz/track`.
- Both Workers bind via `custom_domain = true` in their `wrangler.toml`; Cloudflare
  auto-creates the proxied DNS record and edge cert on `wrangler deploy`.

### Follow-ups / open items
- **Vercel:** set `VIEWER_BASE_URL = https://quotes.royalglass.co.nz` and redeploy (Issue H).
- **Mobile "time spent" tracking bug** — aggregate time shows `0s` for mobile sessions even
  though per-page durations record; being investigated on a separate thread.
- **Optional:** enable DNSSEC later via Cloudflare's guided DS-record flow.

---

## 7. Values we changed (revert reference)

Everything we changed, with the **original value** to restore if reverting. Keep this table
as the source of truth for a rollback.

### Registrar — nameservers (1st Domains)

| | Value |
|---|---|
| **Original (Bluehost)** | `ns1.bluehost.com` / `ns2.bluehost.com` |
| **Current (Cloudflare)** | `jason.ns.cloudflare.com` / `walk.ns.cloudflare.com` |

> The Cloudflare nameservers assigned to *this* zone were `jason`/`walk`. If you ever
> re-add the zone to Cloudflare it may assign a **different** pair — always use the pair
> Cloudflare shows in the dashboard, not these verbatim.

### Cloudflare DNS — proxy toggles we flipped

These were set to **Proxied (orange)** by Cloudflare's import; we changed them to
**DNS only (grey)**. To revert a change, flip them back to Proxied (though DNS-only is the
*correct* state — see Issue D).

| Record | Type | Content | We set it to |
|--------|------|---------|--------------|
| `cpanel` | CNAME | `royalglass.co.nz` | DNS only (was Proxied) |
| `whm` | A | `108.179.214.94` | DNS only (was Proxied) |
| `webmail` | CNAME | `royalglass.co.nz` | DNS only (was Proxied) |
| `webdisk` | A | `108.179.214.94` | DNS only (was Proxied) |

Left **Proxied** (unchanged, correct): `royalglass.co.nz` (`A`), `www` (`CNAME`).
Already **DNS only** (unchanged): `mail` (`A`), `ftp` (`CNAME`), all `MX` and `TXT`.

### Cloudflare DNS — the DMARC record we deleted

| Action | Record |
|--------|--------|
| **Deleted** | `_dmarc` TXT → `v=DMARC1; p=none; rua=mailto:support@royalglass.co.nz` |
| **Kept** | `_dmarc` TXT → `v=DMARC1; p=quarantine; pct=100; rua=mailto:info@royalglass.co.nz` |

To revert, re-add the deleted record. (Note: having both is invalid per the DMARC spec, so
restoring it is not recommended.)

### Worker config — `workers/viewer/wrangler.toml`

| Setting | Original | Changed to |
|---------|----------|------------|
| `TRACKER_URL` (`[vars]`) | `https://rg-tracker.royalglass.workers.dev/track` | `https://track.royalglass.co.nz/track` |
| Custom-domain route | *(commented out)* | `pattern = "quotes.royalglass.co.nz"`, `custom_domain = true` |

### Worker config — `workers/tracker/wrangler.toml`

| Setting | Original | Changed to |
|---------|----------|------------|
| Custom-domain route | *(commented out; referenced `tracker.rgtools.co.nz`)* | `pattern = "track.royalglass.co.nz"`, `custom_domain = true` |

### App env — Vercel

| Variable | Original | Should be |
|----------|----------|-----------|
| `VIEWER_BASE_URL` | `https://rg-viewer.royalglass.workers.dev` | `https://quotes.royalglass.co.nz` |

---

## 8. How to revert

The recovery path was confirmed available before we started. Choose the scope you need —
you rarely need all of it.

### Full rollback — DNS back to Bluehost (the escape hatch)

Use this if email or the website breaks and you need everything back the way it was.

1. **1st Domains** → manage `royalglass.co.nz` → **Update Name Servers** → set:
   - `ns1.bluehost.com`
   - `ns2.bluehost.com`
2. Submit. Bluehost still holds the **original, untouched zone**, so the old DNS restores as
   it propagates (minutes to a few hours).
3. Verify it came back:
   ```
   nslookup -type=ns royalglass.co.nz     # expect *.bluehost.com
   nslookup -type=mx royalglass.co.nz     # expect mxbiz1/2.qq.com
   curl -I https://royalglass.co.nz       # expect 200
   ```

**Caveats on full rollback:**
- Not instant — propagation applies in this direction too.
- You **lose** the custom domains `quotes.royalglass.co.nz` and `track.royalglass.co.nz` —
  Worker custom domains only work while DNS is on Cloudflare. **But the Workers themselves
  keep running** on their `*.workers.dev` URLs (see next subsection to keep the tracker
  working).
- Any **Cloudflare-only records** that were *not* in Bluehost's old zone (e.g. Resend/SES
  `send` records) will drop. Re-add them at Bluehost if still needed.
- **Core QQ email + the Bluehost website were always safe** because their records existed in
  both zones.

#### Keep the quote tracker running on the Worker after a full rollback

The `rg-viewer` and `rg-tracker` Workers are **independent of the `royalglass.co.nz` zone** —
they run on Cloudflare's `*.workers.dev` domain whether or not DNS is on Cloudflare (both have
`workers_dev = true`). So after a DNS rollback you can keep the quote tracker fully working by
pointing everything back at the workers.dev URLs:

1. **Confirm the Workers are still reachable** (these don't depend on the zone):
   ```
   curl -I https://rg-viewer.royalglass.workers.dev/q/<code>     # expect 200 + cf-ray
   curl -I https://rg-tracker.royalglass.workers.dev/track       # expect 405 on GET (POST-only)
   ```
2. **Point the viewer's tracker URL back to workers.dev** — in `workers/viewer/wrangler.toml`:
   ```toml
   [vars]
   TRACKER_URL = "https://rg-tracker.royalglass.workers.dev/track"
   ```
   (Optional: comment out the `[[routes]]` custom-domain block in both
   `workers/viewer/wrangler.toml` and `workers/tracker/wrangler.toml` so deploys don't try to
   bind the now-dead custom domains.)
3. **Redeploy both Workers** from inside each folder so the change takes effect:
   ```
   cd workers/tracker && pnpm wrangler deploy
   cd workers/viewer  && pnpm wrangler deploy
   ```
4. **Repoint the app** — in **Vercel**, set
   `VIEWER_BASE_URL = https://rg-viewer.royalglass.workers.dev` and redeploy. New *and* old
   quote links now resolve to the workers.dev viewer (links are computed at runtime, not
   stored).
5. **Verify end-to-end**: open a quote at `https://rg-viewer.royalglass.workers.dev/q/<code>`,
   then confirm a view event records (the viewer now beacons to the workers.dev tracker).

Net effect: identical functionality to before the migration — just on the `*.workers.dev`
URLs instead of the branded `quotes.`/`track.` subdomains.

### Partial revert — undo the Worker custom domains, keep DNS on Cloudflare

Use this if you want to keep DNS on Cloudflare but stop serving the branded subdomains.

1. In each `wrangler.toml`, comment out the `[[routes]]` block (or delete the Custom Domain
   in the Cloudflare dashboard → Workers → the worker → Settings → Domains & Routes).
   - `workers/viewer/wrangler.toml`
   - `workers/tracker/wrangler.toml`
2. Restore the viewer's tracker URL in `workers/viewer/wrangler.toml`:
   ```toml
   [vars]
   TRACKER_URL = "https://rg-tracker.royalglass.workers.dev/track"
   ```
3. `pnpm wrangler deploy` from inside **each** worker folder.
4. In **Vercel**, set `VIEWER_BASE_URL = https://rg-viewer.royalglass.workers.dev` and
   redeploy, so quote links use the workers.dev URL again.

### Revert just the app link domain (no DNS/Worker change)

If only the generated quote-link domain is wrong, it's purely the Vercel env var:
set `VIEWER_BASE_URL` to the desired base URL and redeploy. Links are computed at runtime,
not stored, so this takes effect for old and new quotes alike.
