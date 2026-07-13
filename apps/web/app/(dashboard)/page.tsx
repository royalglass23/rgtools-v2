import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChartSection } from '@/modules/dashboard/ChartSection'
import { getDashboardTables } from '@/modules/dashboard/config'
import { getDashboardActionCounts, getDashboardChartData, getDashboardKpis } from '@/modules/dashboard/kpis'
import type { SparkPoint } from '@/modules/dashboard/kpis'
import { SERVER_TABLES } from '@/modules/dashboard/registry'
import { SparkLine } from '@/modules/dashboard/SparkLine'
import { getTableMeta } from '@/modules/dashboard/tables'
import { auth } from '@/lib/auth'
import styles from './dashboard.module.css'

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

  const [actionCounts, kpis, chartData] = await Promise.all([
    getDashboardActionCounts(),
    getDashboardKpis(),
    getDashboardChartData(),
  ])

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
  const firstName = session.user.name?.trim().split(/\s+/)[0]

  return (
    <div className={styles.dashboard}>
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.eyebrow}>Royal Glass operations</div>
          <h1>Operations dashboard</h1>
          <p>
            {firstName ? `Welcome back, ${firstName}. ` : ''}
            Here&apos;s what needs attention across the business.
          </p>
        </div>
        <div className={styles.liveStatus}>
          <span aria-hidden="true" />
          Live overview
        </div>
      </header>

      {denied !== undefined && (
        <div className={styles.deniedNotice}>
          You don&apos;t have access to that tool.
        </div>
      )}

      <ActionsNeededSection counts={actionCounts} />

      {isAdmin && <BusinessOverviewSection kpis={kpis} />}
      {isAdmin && (
        <ChartSection
          leadsPerWeek={chartData.leadsPerWeek}
          pipelineByWeek={chartData.pipelineByWeek}
        />
      )}

      {visibleSections.length === 0 ? (
        <div className={styles.emptyState}>
          No dashboard tables selected. An admin can choose them in Dashboard Settings.
        </div>
      ) : (
        visibleSections.map((section) => (
          <section key={section.key} className={styles.dataSection}>
            <SectionHeading title={section.label} eyebrow="Live data" />
            {section.content}
          </section>
        ))
      )}
    </div>
  )
}

type DashboardKpis = {
  pipelineValue: number
  conversionRate: number
  volumeTrend: number
  leadVolume: number
  pipelineSparkline: SparkPoint[]
  conversionSparkline: SparkPoint[]
  volumeSparkline: SparkPoint[]
}

function BusinessOverviewSection({ kpis }: { kpis: DashboardKpis }) {
  const formattedPipeline = kpis.pipelineValue >= 1_000_000
    ? `$${(kpis.pipelineValue / 1_000_000).toFixed(1)}m`
    : `$${Math.round(kpis.pipelineValue).toLocaleString('en-AU')}`

  const trendPositive = kpis.volumeTrend > 0
  const trendNeutral = kpis.volumeTrend === 0
  const trendValue = trendNeutral
    ? `${kpis.leadVolume} leads`
    : `${trendPositive ? '+' : ''}${kpis.volumeTrend}%`
  const trendSub = trendNeutral ? 'this 30 days (no prior data)' : 'vs prior 30 days'

  return (
    <section className={styles.section}>
      <SectionHeading title="Business overview" eyebrow="Performance" />
      <div className={styles.overviewGrid}>
        <OverviewCard
          label="Pipeline Value"
          value={formattedPipeline}
          sub="Active hot/warm quotes"
          sparkline={kpis.pipelineSparkline}
          color="#1d9dad"
          marker="$"
        />
        <OverviewCard
          label="Conversion Rate"
          value={`${kpis.conversionRate}%`}
          sub="Won quotes out of all closed quotes"
          sparkline={kpis.conversionSparkline}
          color="#24a174"
          marker="%"
        />
        <OverviewCard
          label="Lead Volume Trend"
          value={trendValue}
          sub={trendSub}
          sparkline={kpis.volumeSparkline}
          color={trendPositive ? '#24a174' : trendNeutral ? '#71878f' : '#d5554e'}
          marker="↗"
        />
      </div>
    </section>
  )
}

function OverviewCard({
  label,
  value,
  sub,
  sparkline,
  color,
  marker,
}: {
  label: string
  value: string
  sub: string
  sparkline: SparkPoint[]
  color: string
  marker: string
}) {
  return (
    <article className={styles.overviewCard}>
      <div className={styles.cardTopline}>
        <span>{label}</span>
        <span className={styles.metricMarker} aria-hidden="true">{marker}</span>
      </div>
      <div className={styles.metricValue}>{value}</div>
      <div className={styles.metricSub}>{sub}</div>
      <div className={styles.sparkline}>
        {sparkline.length > 0
          ? <SparkLine data={sparkline} color={color} />
          : <span>No trend data yet</span>}
      </div>
    </article>
  )
}

type ActionCounts = {
  staleLeads: number
  unsynced: number
  expiringSoon: number
  neverOpened: number
  forwarding: number
  goneCold: number
}

type ActionTone = 'critical' | 'warning' | 'info' | 'muted'

function ActionsNeededSection({ counts }: { counts: ActionCounts }) {
  const cards: Array<{ label: string; count: number; href: string; tone: ActionTone }> = [
    { label: 'Tier A/B — No SM8 Job', count: counts.unsynced, href: '/leads?sm8=pending', tone: 'critical' },
    { label: 'Stale Leads (7d+)', count: counts.staleLeads, href: '/leads?stale=true', tone: 'warning' },
    { label: 'Expiring Soon', count: counts.expiringSoon, href: '/quote-tracker?activity=expiring', tone: 'warning' },
    { label: 'Never Opened', count: counts.neverOpened, href: '/quote-tracker?activity=never_opened', tone: 'info' },
    { label: 'Forwarding Suspected', count: counts.forwarding, href: '/quote-tracker?activity=forwarding', tone: 'info' },
    { label: 'Gone Cold (14d+)', count: counts.goneCold, href: '/quote-tracker?activity=gone_cold', tone: 'muted' },
  ]

  return (
    <section className={styles.section}>
      <SectionHeading title="Actions Needed" eyebrow="Priority queue" />
      <div className={styles.actionGrid}>
        {cards.map(({ label, count, href, tone }) => (
          <ActionCard key={label} label={label} count={count} href={href} tone={tone} />
        ))}
      </div>
    </section>
  )
}

function ActionCard({
  label,
  count,
  href,
  tone,
}: {
  label: string
  count: number
  href: string
  tone: ActionTone
}) {
  const hasAction = count > 0

  return (
    <Link href={href} className={styles.actionCard} data-tone={hasAction ? tone : 'clear'}>
      <div className={styles.actionCardTopline}>
        <span className={styles.actionDot} aria-hidden="true" />
        <span>{hasAction ? 'Needs review' : 'Up to date'}</span>
      </div>
      <div className={styles.actionCount}>{count}</div>
      <div className={styles.actionLabel}>{label}</div>
      <div className={styles.actionLink}>Review queue <span aria-hidden="true">→</span></div>
    </Link>
  )
}

function SectionHeading({ title, eyebrow }: { title: string; eyebrow: string }) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
    </div>
  )
}
