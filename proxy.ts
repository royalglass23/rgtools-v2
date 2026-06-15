import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const proxy = auth((req) => {
  if (req.nextUrl.pathname === '/api/lead-intake/calculator-submit' || req.nextUrl.pathname === '/api/pricing') {
    return NextResponse.next()
  }

  if (!req.auth) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
})

export const config = {
  matcher: ['/((?!login|api/auth|api/lead-intake/calculator-submit|api/pricing|q/|_next/static|_next/image|favicon.ico).*)'],
}
