# Gap report — everything (security branch, retrofit)

Updated: 2026-06-30 · Reviewed-commit: c4c6b3b9d6999f6024af60a19e515b5862b66730

---

## Gaps resolved (this branch — MT-137/138/139/140)

1. ~~**Missing audit log — AI suggestion generation**~~ → **RESOLVED** (MT-137)
   - `lead.ai_suggestion_generated` event now emitted in `generateLeadSuggestionAction`.

2. ~~**No rate limiting — AI suggestion endpoint**~~ → **RESOLVED** (MT-138)
   - 60-second cooldown enforced via `lead.aiSuggestionAt` DB timestamp. Persists across requests and cold starts.

3. ~~**No rate limiting — ServiceM8 import endpoint**~~ → **RESOLVED** (MT-139)
   - 10-second in-process cooldown per `session.user.id` via `importCooldowns` Map.
   - Limitation noted: resets on cold start / does not propagate across multiple Vercel instances. Acceptable for current single-org, low-volume usage.

4. ~~**Missing negative security tests**~~ → **RESOLVED** (MT-140)
   - Auth/role rejection tests added:
     - `generateLeadSuggestionAction` → unauthenticated returns `{ error }`, read-only check, 60s cooldown
     - `batchDeleteLeadsAction` → unauthenticated + non-admin throws Forbidden
     - `restoreLeadAction` → unauthenticated + non-admin throws Forbidden
     - `deleteLeadAction` → unauthenticated + non-admin throws Forbidden
     - `importServiceM8LeadAction` → unauthenticated returns `{ ok: false }`, rate-limit test

---

## Gaps remaining (pre-existing, not introduced by this branch)

### 5. [Low] Missing HTTP security headers

- **File:** `apps/web/next.config.ts`
- **What's wrong:** No `headers()` configuration. Headers absent: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **Risk:** Low for an internal tool behind authentication middleware. Becomes Medium if any route ever becomes public-facing.
- **Fix:**

```typescript
// In next.config.ts
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ]
},
```

CSP should be added once inline styles/scripts inventory is complete (Next.js uses inline scripts by default; nonce-based CSP requires additional config).

---

## Process notes

- Findings 1–4 all verified resolved in commit `c4c6b3b9`. Tests run: 506 passed, 0 failed.
- Finding 5 (security headers) is tracked here for future remediation. Not a blocker for the current internal deployment.
