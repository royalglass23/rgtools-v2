import { requireModule } from '@/lib/guard'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, modules, userModuleAccess, auditLog } from '@/drizzle/schema'
import { desc } from 'drizzle-orm'
import { CreateUserForm } from './CreateUserForm'
import { UserRow } from './UserRow'

export default async function AdminPage() {
  // Guard: admin-only module
  await requireModule('admin')

  const session = await auth()

  // Fetch all data server-side
  const [allUsers, allModules, allGrants, auditRows] = await Promise.all([
    db.select().from(users).orderBy(users.createdAt),
    db.select().from(modules).orderBy(modules.sortOrder),
    db.select().from(userModuleAccess),
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(100),
  ])

  // Build a map of userId → Set<moduleId> for quick grant lookups
  const grantsByUser = new Map<string, Set<string>>()
  for (const grant of allGrants) {
    if (!grantsByUser.has(grant.userId)) {
      grantsByUser.set(grant.userId, new Set())
    }
    grantsByUser.get(grant.userId)!.add(grant.moduleId)
  }

  // Identify the current actor
  const currentUser = allUsers.find((u) => u.id === session?.user?.id)
  const isProtectedActor = currentUser?.isProtected ?? false

  // Build a map of userId → username for audit log resolution
  const usernameById = new Map<string, string>()
  for (const u of allUsers) {
    usernameById.set(u.id, u.username)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <h1 className="text-2xl font-semibold text-gray-900">Admin Panel</h1>

      {/* ── User List ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Users</h2>

        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Username
                </th>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Role
                </th>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Access
                </th>
                <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map((user) => (
                <UserRow
                  key={user.id}
                  user={{
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    isProtected: user.isProtected,
                  }}
                  isCurrentUser={user.id === session?.user?.id}
                  isProtectedActor={isProtectedActor}
                  modules={allModules.map((m) => ({
                    id: m.id,
                    slug: m.slug,
                    name: m.name,
                    adminOnly: m.adminOnly,
                    isActive: m.isActive,
                  }))}
                  grantedModuleIds={grantsByUser.get(user.id) ?? new Set()}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Create User ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Create User</h2>
        <div className="bg-white border border-gray-200 rounded shadow-sm p-5">
          <CreateUserForm />
        </div>
      </section>

      {/* ── Audit Log ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Audit Log
          <span className="ml-2 text-sm font-normal text-gray-400">(last 100 entries, newest first — read-only)</span>
        </h2>

        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-x-auto">
          {auditRows.length === 0 ? (
            <p className="py-6 px-4 text-sm text-gray-500">No audit entries yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Timestamp
                  </th>
                  <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Actor
                  </th>
                  <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Action
                  </th>
                  <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Target
                  </th>
                  <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Detail
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((row) => {
                  // Resolve actor: use actorId → username if present; fall back to detail.username or 'deleted user'
                  const detail = row.detail as Record<string, unknown> | null
                  const actorName = row.actorId
                    ? (usernameById.get(row.actorId) ?? detail?.username ?? 'deleted user')
                    : (detail?.username ?? 'deleted user')

                  // Target: detail.username or targetId
                  const targetName = detail?.username ?? row.targetId ?? '—'

                  // Detail fields: omit 'username' (already shown in Target), render rest as key: value
                  const detailFields = detail
                    ? Object.entries(detail)
                        .filter(([k]) => k !== 'username')
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join(' · ')
                    : ''

                  const ts = new Date(row.createdAt)
                  const formatted = ts.toLocaleDateString('en-AU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  }) + ' ' + ts.toLocaleTimeString('en-AU', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })

                  return (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-4 text-gray-500 whitespace-nowrap font-mono text-xs">
                        {formatted}
                      </td>
                      <td className="py-2 px-4 text-gray-700 font-medium whitespace-nowrap">
                        {String(actorName)}
                      </td>
                      <td className="py-2 px-4">
                        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                          {row.action}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-gray-700 whitespace-nowrap">
                        {String(targetName)}
                      </td>
                      <td className="py-2 px-4 text-gray-500 text-xs">
                        {detailFields || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
