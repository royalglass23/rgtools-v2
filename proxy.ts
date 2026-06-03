import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { userCanAccessSlug } from '@/lib/access-db'

// Maps the first path segment to a module slug.
// Add new entries here as modules are added to the app.
const PATH_TO_SLUG: Record<string, string> = {
  'quote-tracker': 'quote-tracker',
  'admin': 'admin',
}

export const proxy = auth(async (req) => {
  if (!req.auth) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Determine if this path maps to a gated module.
  // e.g. /quote-tracker/foo → firstSegment = "quote-tracker"
  const firstSegment = req.nextUrl.pathname.split('/')[1] ?? ''
  const slug = PATH_TO_SLUG[firstSegment]

  if (slug) {
    const userId = req.auth.user?.id

    // Guard: treat missing userId as unauthenticated.
    if (!userId) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }

    const allowed = await userCanAccessSlug(userId, slug)

    if (!allowed) {
      const deniedUrl = new URL('/', req.url)
      deniedUrl.searchParams.set('denied', slug)
      return NextResponse.redirect(deniedUrl)
    }
  }
})

export const config = {
  matcher: ['/((?!login|api/auth|q/|_next/static|_next/image|favicon.ico).*)'],
}
