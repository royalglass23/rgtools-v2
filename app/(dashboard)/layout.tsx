import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { signOutAction } from './actions'
import { getAccessibleModules } from '@/lib/access-db'
import { buildDashboardNavigation } from '@/lib/admin-navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const accessibleModules = await getAccessibleModules(session.user.id)
  const { primaryModules, adminItems } = buildDashboardNavigation(accessibleModules)

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
          {(primaryModules.length > 0 || adminItems.length > 0) && (
            <div className="flex items-center gap-4">
              {primaryModules.map((mod) => (
                <Link
                  key={mod.id}
                  href={`/${mod.slug}`}
                  className="text-sm text-slate-100/85 transition-colors hover:text-white"
                >
                  {mod.name}
                </Link>
              ))}
              {adminItems.length > 0 && (
                <div className="group relative">
                  <button
                    type="button"
                    className="text-sm text-slate-100/85 transition-colors hover:text-white focus:text-white focus:outline-none"
                    aria-haspopup="menu"
                  >
                    Admin
                  </button>
                  <div
                    className="invisible absolute left-0 top-full z-20 min-w-56 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
                  >
                    <div
                      className="rounded border border-slate-200 bg-white py-2 shadow-lg"
                      role="menu"
                    >
                      {adminItems.map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          className="block px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
                          role="menuitem"
                        >
                          {item.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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
