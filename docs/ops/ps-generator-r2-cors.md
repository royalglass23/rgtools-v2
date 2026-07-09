# PS Generator R2 CORS

PS Generator system-template uploads use a browser `PUT` to a presigned R2 URL.
The `rg-quotes` bucket must allow the app origin and the request headers sent by
the presigned upload.

Apply the policy from the repo root:

```powershell
npx.cmd wrangler r2 bucket cors set rg-quotes --file docs/ops/r2-cors-rg-quotes.json --force
```

Verify the policy:

```powershell
npx.cmd wrangler r2 bucket cors list rg-quotes
```

The policy must include:

- `https://rgtools-delta.vercel.app`
- `https://rgtools.co.nz`
- `https://www.rgtools.co.nz`
- `PUT`
- `content-type`
- `x-amz-content-sha256`

Cloudflare notes that CORS propagation can take up to 30 seconds.
