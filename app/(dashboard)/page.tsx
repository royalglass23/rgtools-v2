import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { quotes } from '@/drizzle/schema'
import { and, isNull, isNotNull, inArray, desc, count, sum, eq } from 'drizzle-orm'

const STAGE_LABELS: Record<string, string> = {
  estimate: 'Estimate',
  pending_quote: 'Pending',
  quote_sent: 'Sent',
  intent_scoring: 'Scoring',
  closed: 'Closed',
}

const STAGE_ORDER = ['estimate', 'pending_quote', 'quote_sent', 'intent_scoring', 'closed'] as const

const TAG_CLASS: Record<string, string> = {
  hot: 'bg-red-50 text-red-700 border-red-200',
  warm: 'bg-orange-50 text-orange-700 border-orange-200',
  cold: 'bg-blue-50 text-blue-700 border-blue-200',
  dead: 'bg-gray-50 text-gray-500 border-gray-200',
}

function fmtCurrency(val: string | null) {
  if (!val) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? '—' : `$${Math.round(n).toLocaleString('en-AU')}`
}

function fmtDate(d: Date | null) {
  if (!d) return '—'
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { denied } = await searchParams

  const activeWhere = and(isNull(quotes.archivedAt), isNull(quotes.outcome))

  // ── KPIs ──────────────────────────────────────────────────────────────────
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

  // ── Pipeline snapshot ──────────────────────────────────────────────────────
  const stageRows = await db
    .select({ stage: quotes.pipelineStage, n: count() })
    .from(quotes)
    .where(isNull(quotes.archivedAt))
    .groupBy(quotes.pipelineStage)

  const stageCounts = Object.fromEntries(stageRows.map((r) => [r.stage, r.n]))

  // ── Urgent actions ─────────────────────────────────────────────────────────
  const urgent = await db
    .select({
      id: quotes.id,
      clientName: quotes.clientName,
      companyName: quotes.companyName,
      quoteValue: quotes.quoteValue,
      pipelineStage: quotes.pipelineStage,
      statusTag: quotes.statusTag,
      aiScore: quotes.aiScore,
      sentAt: quotes.sentAt,
    })
    .from(quotes)
    .where(
      and(
        isNull(quotes.archivedAt),
        isNull(quotes.outcome),
        inArray(quotes.statusTag, ['hot', 'warm']),
      ),
    )
    .orderBy(desc(quotes.aiScore))
    .limit(10)

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

      {/* Urgent actions */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Needs Attention
        </h2>
        {urgent.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded px-4 py-10 text-sm text-gray-400 text-center">
            No urgent quotes right now.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Tag</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {urgent.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{q.clientName}</div>
                      {q.companyName && (
                        <div className="text-xs text-gray-400">{q.companyName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{fmtCurrency(q.quoteValue)}</td>
                    <td className="px-4 py-3 text-gray-600">{STAGE_LABELS[q.pipelineStage] ?? q.pipelineStage}</td>
                    <td className="px-4 py-3">
                      {q.statusTag && (
                        <span className={`text-xs font-medium border rounded px-1.5 py-0.5 ${TAG_CLASS[q.statusTag] ?? ''}`}>
                          {q.statusTag}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{q.aiScore ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(q.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pipeline snapshot */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Pipeline
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {STAGE_ORDER.map((stage) => (
            <div key={stage} className="bg-white border border-gray-200 rounded p-4">
              <div className="text-2xl font-semibold text-gray-900">
                {stageCounts[stage] ?? 0}
              </div>
              <div className="text-xs text-gray-400 mt-1">{STAGE_LABELS[stage]}</div>
            </div>
          ))}
        </div>
      </section>
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
