import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAccessibleModules } from '@/lib/access-db'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const params = await searchParams
  const denied = params.denied

  const accessibleModules = await getAccessibleModules(session.user.id ?? '')

  return (
    <div className="max-w-4xl mx-auto">
      {denied !== undefined && (
        <div className="mb-6 flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded px-4 py-3 text-sm text-yellow-800">
          <span>You don&apos;t have access to that tool.</span>
        </div>
      )}

      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Dashboard</h1>

      {accessibleModules.length === 0 ? (
        <p className="text-gray-500">No modules available. Contact an admin to request access.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accessibleModules.map((mod) => (
            <Link
              key={mod.id}
              href={`/${mod.slug}`}
              className="block bg-white border border-gray-200 rounded shadow-sm p-5 hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <h2 className="font-semibold text-gray-900">{mod.name}</h2>
                {mod.adminOnly && (
                  <span className="ml-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 shrink-0">
                    Admin
                  </span>
                )}
              </div>
              {mod.description && (
                <p className="text-sm text-gray-500">{mod.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
