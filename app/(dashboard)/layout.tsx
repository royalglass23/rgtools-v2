import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { signOutAction } from './actions'
import { getAccessibleModules } from '@/lib/access-db'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const accessibleModules = await getAccessibleModules(session.user.id)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-gray-900 hover:text-gray-700 transition-colors">
            rgtools
          </Link>
          {accessibleModules.length > 0 && (
            <div className="flex items-center gap-4">
              {accessibleModules.map((mod) => (
                <Link
                  key={mod.id}
                  href={`/${mod.slug}`}
                  className="text-sm text-gray-600 hover:text-blue-600 transition-colors"
                >
                  {mod.name}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {session.user?.name}
            {session.user?.role === 'admin' && (
              <span className="ml-1 text-xs text-blue-600">(admin)</span>
            )}
          </span>
          <form action={signOutAction}>
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}
