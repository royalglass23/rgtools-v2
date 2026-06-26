import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { quoteEngagement, quotes } from '@rgtools/db/schema'
import { and, count, eq, gt, isNull, or, sql, sum } from 'drizzle-orm'
import { getDashboardTables } from '@/modules/dashboard/config'
import { getTableMeta } from '@/modules/dashboard/tables'
import { SERVER_TABLES } from '@/modules/dashboard/registry'

function fmtCurrency(val: string | null) {
  if (!val) return '$0'
  const n = parseFloat(val)
  return isNaN(n) ? '$0' : `$${Math.round(n).toLocaleString('en-AU')}`
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const params = await searchParams
  const denied = typeof params.denied === 'string' ? params.denied : undefined
  const isAdmin = session.user.role === 'admin'

  const activeTrackedWhere = and(
    isNull(quotes.archivedAt),
    isNull(quotes.outcome),
    or(isNull(quotes.expiresAt), gt(quotes.expiresAt, sql`now()`)),
  )

  // KPI cards reflect active, unclosed tracked quote links.
  const [{ activeCount, trackedTotal, priorityCount, viewedCount }] = await db
    .select({
      activeCount: count(),
      trackedTotal: sum(quotes.quoteValue),
      priorityCount: count(sql`case when ${quotes.statusTag} in ('hot', 'warm') then 1 end`),
      viewedCount: count(sql`case when ${quoteEngagement.totalOpens} > 0 then 1 end`),
    })
    .from(quotes)
    .leftJoin(quoteEngagement, eq(quoteEngagement.quoteId, quotes.id))
    .where(activeTrackedWhere)

  // ── Admin-selected tables ───────────────────────────────────────────────────
  const config = await getDashboardTables()
  const sections = await Promise.all(
    config.map(async (entry) => {
      const meta = getTableMeta(entry.key)
      const server = SERVER_TABLES[entry.key]
      if (!meta || !meta.available || !server) return null
      const content = await server.render({ searchParams: params, filter: entry.filter, isAdmin })
      return { key: entry.key, label: meta.label, content }
    }),
  )
  const visibleSections = sections.filter((section) => section !== null)

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {denied !== undefined && (
        <div className="bg-yellow-50 border border-yellow-200 rounded px-4 py-3 text-sm text-yellow-800">
          You don&apos;t have access to that tool.
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Tracked Quote Value" value={fmtCurrency(trackedTotal)} />
        <KpiCard label="Active Tracked Quotes" value={String(activeCount)} />
        <KpiCard label="Hot/Warm Quotes" value={String(priorityCount)} hot={priorityCount > 0} />
        <KpiCard label="Viewed Quotes" value={String(viewedCount)} />
      </div>

      {/* Configurable tables */}
      {visibleSections.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded px-4 py-10 text-sm text-gray-400 text-center">
          No dashboard tables selected. An admin can choose them in Dashboard Settings.
        </div>
      ) : (
        visibleSections.map((section) => (
          <section key={section.key} className="space-y-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {section.label}
            </h2>
            {section.content}
          </section>
        ))
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  hot,
}: {
  label: string
  value: string
  hot?: boolean
}) {
  return (
    <div className="bg-white border border-gray-200 rounded p-5">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${hot ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  )
}
