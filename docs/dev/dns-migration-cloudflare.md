# DNS Migration: Bluehost → Cloudflare (royalglass.co.nz)

Goal: move DNS management to Cloudflare so the `rg-viewer` Worker can serve
`quotes.royalglass.co.nz`, **without disrupting the website or email**.

## Who does what (don't confuse these)

| Service        | Provider          | Changes? |
|----------------|-------------------|----------|
| Registrar      | 1st Domains (1stdomains.nz) — registrant Roxy Huang | Change nameservers here |
| DNS host       | Bluehost → **Cloudflare** | This is what we're moving |
| Website files  | Bluehost server `108.179.214.94` | **No change** — stays on Bluehost |
| Email          | QQ / Tencent Exmail (`mxbiz1/2.qq.com`) | **No change** |

## Order of operations

1. Add `royalglass.co.nz` to Cloudflare (free plan). Let it scan/import.
2. Compare imported records against the checklist below. Add anything missing.
3. Set site/mail records to **DNS only (grey cloud)** for a clean 1:1 swap.
4. Dedupe DMARC down to ONE record (see below).
5. Check QQ Exmail admin for a DKIM record and copy it if present.
6. Only then: change nameservers at **1st Domains** to the two Cloudflare ones.
7. Wait for Cloudflare to show **Active** (hours, up to 24).
8. Verify: load site + send/receive a test email.
9. Then add `quotes` record + `wrangler deploy` the Worker route.

Rollback: switch nameservers back to `ns1/ns2.bluehost.com` at 1st Domains.
Bluehost still holds the original zone, so it restores within a few hours.
(Never delete records at Bluehost — that's the safety net.)

## Complete record checklist (recreate ALL in Cloudflare)

Proxy = whether the orange cloud is on. Start everything DNS-only (grey).

- [ ] **A**    `@` (root)   → `108.179.214.94`            — DNS only
- [ ] **CNAME** `www`       → `royalglass.co.nz`          — DNS only
- [ ] **A**    `mail`       → `108.179.214.94`            — DNS only (never proxy mail)
- [ ] **CNAME** `webmail`   → `royalglass.co.nz`          — DNS only
- [ ] **CNAME** `cpanel`    → `royalglass.co.nz`          — DNS only
- [ ] **CNAME** `ftp`       → `royalglass.co.nz`          — DNS only
- [ ] **A**    `webdisk`    → `108.179.214.94`            — DNS only
- [ ] **MX**   `@`          → `mxbiz1.qq.com`   priority **5**
- [ ] **MX**   `@`          → `mxbiz2.qq.com`   priority **10**
- [ ] **TXT**  `@` (SPF)    → `v=spf1 a mx ip4:96.125.174.107 ip4:108.179.214.94 include:spf.mail.qq.com ~all`
- [ ] **TXT**  `@`          → `google-site-verification=cPFodRsSg1WcMD-7TcARSIpR8fYkkl3UHWagXpOZSw0`
- [ ] **TXT**  `@`          → `google-site-verification=2HtRNC0cB56-nYsgF6H0YVCnGr3beDhoBAEoOocofgU`
- [ ] **TXT**  `@`          → `google-site-verification=Uk6y8yaZO6QmONzVgK3JvuYc2Cp_EUq95qeTAVoJ9o0`
- [ ] **TXT**  `@`          → `google-site-verification=4skcz3MHV3LFUMUo8GP6XimWlbPa8ZzCHnuf0x-B8ws`
- [ ] **TXT**  `_dmarc`     → `v=DMARC1; p=quarantine; pct=100; rua=mailto:info@royalglass.co.nz`
- [ ] **DKIM** (check QQ Exmail admin — selector unknown; copy if DKIM is enabled)

### DMARC dedupe — IMPORTANT
Bluehost currently serves TWO `_dmarc` records (invalid — only one allowed):
- KEEP:   `v=DMARC1; p=quarantine; pct=100; rua=mailto:info@royalglass.co.nz`
- DELETE: `v=DMARC1; p=none; rua=mailto:support@royalglass.co.nz`

## Verify after switch

```
nslookup -type=ns royalglass.co.nz     # should show *.ns.cloudflare.com
nslookup -type=mx royalglass.co.nz     # should still show mxbiz1/2.qq.com
nslookup -type=a  royalglass.co.nz     # should still be 108.179.214.94
```
Plus: load https://royalglass.co.nz and send a test email both directions.

## After it's stable — the Worker (quotes.royalglass.co.nz)

Uncomment in `workers/viewer/wrangler.toml`:

```toml
[[routes]]
pattern = "quotes.royalglass.co.nz/*"
zone_name = "royalglass.co.nz"
```

Then `wrangler deploy`. Cloudflare creates the proxied `quotes` record
automatically when the route binds. Confirm with:
`curl -I https://quotes.royalglass.co.nz` (expect a cf-ray header).
