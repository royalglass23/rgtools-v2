'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WeekLeads, WeekPipeline } from './kpis'
import { SectionHeading } from '@/components/precision-ui/PrecisionUI'
import styles from './ChartSection.module.css'

function shortWeek(week: string) {
  return week.split('-')[1] ?? week
}

function LeadsPerWeekChart({ data }: { data: WeekLeads[] }) {
  return (
    <article className={styles.chartCard}>
      <div className={styles.chartTitle}>Leads per week</div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
          <XAxis dataKey="week" tickFormatter={shortWeek} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value) => [value, 'Leads']} labelFormatter={(label) => shortWeek(String(label))} />
          <Bar dataKey="count" fill="var(--brand-accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </article>
  )
}

function QuotePipelineChart({ data }: { data: WeekPipeline[] }) {
  return (
    <article className={styles.chartCard}>
      <div className={styles.chartTitle}>Quote pipeline by week</div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
          <XAxis dataKey="week" tickFormatter={shortWeek} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={(label) => shortWeek(String(label))} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="hot" stackId="a" fill="var(--state-critical)" />
          <Bar dataKey="warm" stackId="a" fill="var(--state-warning)" />
          <Bar dataKey="cold" stackId="a" fill="var(--text-muted)" />
          <Bar dataKey="dead" stackId="a" fill="var(--border-strong)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </article>
  )
}

export function ChartSection({
  leadsPerWeek,
  pipelineByWeek,
}: {
  leadsPerWeek: WeekLeads[]
  pipelineByWeek: WeekPipeline[]
}) {
  return (
    <section className={styles.section}>
      <SectionHeading eyebrow="Momentum" title="Trends (last 8 weeks)" />
      <div className={styles.chartGrid}>
        <LeadsPerWeekChart data={leadsPerWeek} />
        <QuotePipelineChart data={pipelineByWeek} />
      </div>
    </section>
  )
}
