"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeekLeads, WeekPipeline } from "./kpis";
import { SectionHeading } from "@/components/precision-ui/PrecisionUI";
import styles from "./ChartSection.module.css";

function shortWeek(week: string) {
  return week.split("-")[1] ?? week;
}

function LeadsPerWeekChart({ data }: { data: WeekLeads[] }) {
  return (
    <article className={styles.chartCard} aria-label="Lead volume trend">
      <div className={styles.chartHeader}>
        <div>
          <div className={styles.chartTitle}>Lead volume</div>
          <p>New leads received each week</p>
        </div>
        <div className={styles.chartKey}>
          <span data-series="leads" aria-hidden="true" /> Lead count
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, left: 8, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
          <XAxis
            dataKey="week"
            tickFormatter={shortWeek}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
            height={32}
            label={{
              value: "Week",
              position: "insideBottomRight",
              offset: -6,
              fill: "var(--text-muted)",
              fontSize: 11,
            }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
            width={44}
            label={{
              value: "Leads",
              angle: -90,
              position: "insideLeft",
              fill: "var(--text-muted)",
              fontSize: 11,
            }}
          />
          <Tooltip
            formatter={(value) => [value, "Leads"]}
            labelFormatter={(label) => shortWeek(String(label))}
          />
          <Bar
            dataKey="count"
            name="Leads"
            fill="var(--brand-accent)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </article>
  );
}

function QuotePipelineChart({ data }: { data: WeekPipeline[] }) {
  return (
    <article
      className={styles.chartCard}
      aria-label="ServiceM8 quote pipeline trend"
    >
      <div className={styles.chartHeader}>
        <div>
          <div className={styles.chartTitle}>ServiceM8 quote pipeline</div>
          <p>Tracked quotes grouped by current status</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, left: 8, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
          <XAxis
            dataKey="week"
            tickFormatter={shortWeek}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
            height={32}
            label={{
              value: "Week",
              position: "insideBottomRight",
              offset: -6,
              fill: "var(--text-muted)",
              fontSize: 11,
            }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
            width={44}
            label={{
              value: "Quotes",
              angle: -90,
              position: "insideLeft",
              fill: "var(--text-muted)",
              fontSize: 11,
            }}
          />
          <Tooltip labelFormatter={(label) => shortWeek(String(label))} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          <Bar
            dataKey="hot"
            name="Hot"
            stackId="a"
            fill="var(--state-critical)"
          />
          <Bar
            dataKey="warm"
            name="Warm"
            stackId="a"
            fill="var(--state-warning)"
          />
          <Bar
            dataKey="cold"
            name="Cold"
            stackId="a"
            fill="var(--state-info)"
          />
          <Bar
            dataKey="dead"
            name="Dead"
            stackId="a"
            fill="var(--text-muted)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </article>
  );
}

export function ChartSection({
  leadsPerWeek,
  pipelineByWeek,
}: {
  leadsPerWeek: WeekLeads[];
  pipelineByWeek: WeekPipeline[];
}) {
  return (
    <section className={styles.section}>
      <div>
        <SectionHeading title="Business performance" />
        <p className={styles.sectionDescription}>
          Weekly activity across the last eight weeks.
        </p>
      </div>
      <div className={styles.chartGrid}>
        <LeadsPerWeekChart data={leadsPerWeek} />
        <QuotePipelineChart data={pipelineByWeek} />
      </div>
    </section>
  );
}
