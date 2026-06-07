import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { signOutAction } from './actions'
import { getAccessibleModules } from '@/lib/access-db'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const accessibleModules = await getAccessibleModules(session.user.id)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="flex items-center justify-between border-b border-sky-900/40 bg-[#142B3A] px-6 py-3 shadow-sm">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex h-[72px] items-center transition-opacity hover:opacity-85"
            aria-label="Royal Glass tools home"
          >
            <Image
              src="/royal-glass-logo-white.png"
              alt="Royal Glass"
              width={300}
              height={144}
              priority
              unoptimized
              className="h-[72px] w-auto"
            />
          </Link>
          {accessibleModules.length > 0 && (
            <div className="flex items-center gap-4">
              {accessibleModules.map((mod) => (
                <Link
                  key={mod.id}
                  href={`/${mod.slug}`}
                  className="text-sm text-slate-100/85 transition-colors hover:text-white"
                >
                  {mod.name}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-100/80">
            {session.user?.name}
            {session.user?.role === 'admin' && (
              <span className="ml-1 text-xs text-sky-200">(admin)</span>
            )}
          </span>
          <form action={signOutAction}>
            <button type="submit" className="text-sm text-slate-100/80 transition-colors hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}
