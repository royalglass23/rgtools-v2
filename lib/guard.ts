/**
 * Server-side guard for module access — defence in depth.
 * Middleware is NOT a security boundary on its own; this is the real enforcement.
 */

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { userCanAccessSlug } from '@/lib/access-db'
import { logError } from '@/lib/logger'

/**
 * Re-checks access via session + DB and redirects to `/?denied=<slug>` if denied.
 * Intended to be called inside a module's layout or page server component.
 *
 * @param slug - The module slug to guard (e.g., 'quote-tracker')
 * @throws Redirects to /login if no session, or /?denied=<slug> if access denied
 */
export async function requireModule(slug: string): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  let allowed = false

  try {
    allowed = await userCanAccessSlug(session.user.id, slug)
  } catch (err) {
    await logError('guard.requireModule', err, {
      userId: session.user.id,
      metadata: { slug },
    })
    redirect('/?denied=' + slug)
  }

  if (!allowed) redirect(`/?denied=${slug}`)
}
