'use client'

import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { SparkPoint } from './kpis'
import styles from './SparkLine.module.css'

export function SparkLine({ data, color = 'var(--brand-primary)' }: { data: SparkPoint[]; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data}>
        <Tooltip
          content={({ active, payload }: TooltipContentProps<number, string>) => {
            if (!active || !payload?.length) return null
            return (
              <div className={styles.tooltip}>
                {payload[0]?.value}
              </div>
            )
          }}
        />
        <Line type="monotone" dataKey="value" stroke={color} dot={false} strokeWidth={1.5} />
      </LineChart>
    </ResponsiveContainer>
  )
}
