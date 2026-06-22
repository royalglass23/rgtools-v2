import { requireModule } from '@/lib/guard'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, modules, userModuleAccess, auditLog, errorLog } from '@/drizzle/schema'
import { count, desc } from 'drizzle-orm'
import Link from 'next/link'
import { CreateUserForm } from '@/modules/admin/CreateUserForm'
import { TestErrorButton } from '@/modules/admin/TestErrorButton'
import { UserRow } from '@/modules/admin/UserRow'
import { ExportDropdown } from '@/modules/admin/ExportDropdown'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

function parsePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number(raw ?? '1')
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function parsePageSize(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number(raw ?? '10')
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed) ? parsed : 10
}

function buildHref(
  params: Record<string, string | string[] | undefined>,
  overrides: Record<string, string>,
) {
  const query = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    const v = Array.isArray(val) ? val[0] : val
    if (v) query.set(key, v)
  }
  for (const [key, val] of Object.entries(overrides)) {
    query.set(key, val)
  }
  return `/admin/administration?${query.toString()}`
}

function Pagination({
  currentPage,
  pageSize,
  totalRows,
  pageParam,
  sizeParam,
  searchParams,
}: {
  currentPage: number
  pageSize: number
  totalRows: number
  pageParam: string
  sizeParam: string
  searchParams: Record<string, string | string[] | undefined>
}) {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Per page:</span>
        {PAGE_SIZE_OPTIONS.map((size) => (
          <Link
            key={size}
            href={buildHref(searchParams, { [pageParam]: '1', [sizeParam]: String(size) })}
            className={`text-xs border rounded px-2 py-1 ${pageSize === size ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          >
            {size}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-xs">
          Page {currentPage} of {totalPages}
        </span>
        <Link
          href={buildHref(searchParams, { [pageParam]: String(Math.max(1, currentPage - 1)) })}
          className={`border border-gray-200 rounded px-3 py-1 ${currentPage <= 1 ? 'pointer-events-none text-gray-300' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          Previous
        </Link>
        <Link
          href={buildHref(searchParams, { [pageParam]: String(Math.min(totalPages, currentPage + 1)) })}
          className={`border border-gray-200 rounded px-3 py-1 ${currentPage >= totalPages ? 'pointer-events-none text-gray-300' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          Next
        </Link>
      </div>
    </div>
  )
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Guard: admin-only module
  await requireModule('admin')

  const session = await auth()
  const params = await searchParams
  const errorPage = parsePage(params.errorPage)
  const auditPage = parsePage(params.auditPage)
  const errorSize = parsePageSize(params.errorSize)
  const auditSize = parsePageSize(params.auditSize)

  // Fetch all data server-side
  const [allUsers, allModules, allGrants, auditRows, auditCountRows] = await Promise.all([
    db.select().from(users).orderBy(users.createdAt),
    db.select().from(modules).orderBy(modules.sortOrder),
    db.select().from(userModuleAccess),
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(auditSize).offset((auditPage - 1) * auditSize),
    db.select({ value: count() }).from(auditLog),
  ])
  const auditTotalRows = auditCountRows[0]?.value ?? 0

  let errorRows: (typeof errorLog.$inferSelect)[] = []
  let errorTotalRows = 0
  try {
    const [rows, countRows] = await Promise.all([
      db.select().from(errorLog).orderBy(desc(errorLog.createdAt)).limit(errorSize).offset((errorPage - 1) * errorSize),
      db.select({ value: count() }).from(errorLog),
    ])
    errorRows = rows
    errorTotalRows = countRows[0]?.value ?? 0
  } catch (err) {
    console.error('[admin.errorLog.read]', err)
  }

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
                  ServiceM8 Staff UUID
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
                    servicem8StaffUuid: user.servicem8StaffUuid,
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

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Diagnostics</h2>
        <div className="bg-white border border-gray-200 rounded shadow-sm p-5">
          <TestErrorButton />
        </div>
      </section>

      {/* ── Audit Log ─────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-800">
            System Errors
            <span className="ml-2 text-sm font-normal text-gray-400">({errorTotalRows} total)</span>
          </h2>
          <ExportDropdown kind="system" />
        </div>

        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-x-auto">
          {errorRows.length === 0 ? (
            <p className="py-6 px-4 text-sm text-gray-500">No system errors logged.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Timestamp
                  </th>
                  <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Ref
                  </th>
                  <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Source
                  </th>
                  <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Message
                  </th>
                  <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Context
                  </th>
                </tr>
              </thead>
              <tbody>
                {errorRows.map((row) => {
                  const metadata = row.metadata as Record<string, unknown> | null
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
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                      <td className="py-2 px-4 text-gray-500 whitespace-nowrap font-mono text-xs">
                        {formatted}
                      </td>
                      <td className="py-2 px-4 font-mono text-xs text-gray-600 whitespace-nowrap">
                        {row.id}
                      </td>
                      <td className="py-2 px-4">
                        <span className="font-mono text-xs bg-red-50 px-1.5 py-0.5 rounded text-red-700">
                          {row.source}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-gray-700 min-w-64">
                        {row.message}
                        {row.stack && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-gray-400">Stack</summary>
                            <pre className="mt-2 max-w-xl whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-500">
                              {row.stack}
                            </pre>
                          </details>
                        )}
                      </td>
                      <td className="py-2 px-4 text-gray-500 text-xs min-w-56">
                        {metadata ? JSON.stringify(metadata) : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <Pagination
            currentPage={errorPage}
            pageSize={errorSize}
            totalRows={errorTotalRows}
            pageParam="errorPage"
            sizeParam="errorSize"
            searchParams={params}
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-800">
            Audit Log
            <span className="ml-2 text-sm font-normal text-gray-400">({auditTotalRows} total)</span>
          </h2>
          <ExportDropdown kind="audit" />
        </div>

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
                  // Resolve actor: use actorId → username if present; fall back to 'deleted user'
                  // Note: detail.username is the TARGET user's name, not the actor's
                  const detail = row.detail as Record<string, unknown> | null
                  const actorName = row.actorId
                    ? (usernameById.get(row.actorId) ?? 'deleted user')
                    : 'deleted user'

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
          <Pagination
            currentPage={auditPage}
            pageSize={auditSize}
            totalRows={auditTotalRows}
            pageParam="auditPage"
            sizeParam="auditSize"
            searchParams={params}
          />
        </div>
      </section>
    </div>
  )
}
