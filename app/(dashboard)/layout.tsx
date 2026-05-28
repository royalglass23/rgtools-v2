import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { signOutAction } from './actions'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-900">rgtools</span>
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
