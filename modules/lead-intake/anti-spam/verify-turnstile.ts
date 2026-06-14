type FetchFn = typeof fetch

export type TurnstileResult =
  | { ok: true; skipped: true }
  | { ok: true; skipped: false }
  | { ok: false; reason: string }

export async function verifyTurnstileToken(
  token: unknown,
  remoteIp: string,
  { fetchFn = fetch }: { fetchFn?: FetchFn } = {},
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET
  if (!secret) return { ok: true, skipped: true }

  if (typeof token !== 'string' || !token.trim()) {
    return { ok: false, reason: 'missing-token' }
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  })
  if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp)

  const response = await fetchFn('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  })

  if (!response.ok) return { ok: false, reason: `siteverify-http-${response.status}` }

  const json = await response.json() as { success?: boolean; 'error-codes'?: string[] }
  if (json.success) return { ok: true, skipped: false }

  return {
    ok: false,
    reason: json['error-codes']?.join(',') || 'turnstile-failed',
  }
}
