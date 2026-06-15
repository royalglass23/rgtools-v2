import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { quotes } from '@/drizzle/schema'
import { and, isNull, isNotNull, count, sum, eq } from 'drizzle-orm'
import { getDashboardTables } from '@/modules/dashboard/config'
import { getTableMeta } from '@/modules/dashboard/tables'
import { SERVER_TABLES } from '@/modules/dashboard/registry'

function fmtCurrency(val: string | null) {
  if (!val) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? '—' : `$${Math.round(n).toLocaleString('en-AU')}`
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

  const activeWhere = and(isNull(quotes.archivedAt), isNull(quotes.outcome))

  // ── KPIs (unchanged — kept while KPI redesign is parked) ────────────────────
  const [{ openCount }] = await db
    .select({ openCount: count() })
    .from(quotes)
    .where(activeWhere)

  const [{ pipelineTotal }] = await db
    .select({ pipelineTotal: sum(quotes.quoteValue) })
    .from(quotes)
    .where(activeWhere)

  const [{ hotCount }] = await db
    .select({ hotCount: count() })
    .from(quotes)
    .where(and(isNull(quotes.archivedAt), eq(quotes.statusTag, 'hot')))

  const closedRows = await db
    .select({ outcome: quotes.outcome, n: count() })
    .from(quotes)
    .where(isNotNull(quotes.outcome))
    .groupBy(quotes.outcome)

  const wonCount = closedRows.find((r) => r.outcome === 'won')?.n ?? 0
  const totalClosed = closedRows.reduce((acc, r) => acc + r.n, 0)
  const winRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : null

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
        <KpiCard label="Pipeline Value" value={fmtCurrency(pipelineTotal)} />
        <KpiCard label="Open Quotes" value={String(openCount)} />
        <KpiCard label="Hot Leads" value={String(hotCount)} hot={hotCount > 0} />
        <KpiCard label="Win Rate" value={winRate !== null ? `${winRate}%` : '—'} />
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
