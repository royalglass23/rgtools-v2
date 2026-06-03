import { NextResponse } from 'next/server'
import { desc, gte } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLog, errorLog } from '@/drizzle/schema'

type ExportKind = 'system' | 'audit'
type ExportRange = 'day' | 'week' | 'month' | '3months'

function parseKind(value: string | null): ExportKind {
  return value === 'audit' ? 'audit' : 'system'
}

function parseRange(value: string | null): ExportRange {
  if (value === 'week' || value === 'month' || value === '3months') return value
  return 'day'
}

function rangeStart(range: ExportRange) {
  const date = new Date()
  if (range === 'day') date.setDate(date.getDate() - 1)
  if (range === 'week') date.setDate(date.getDate() - 7)
  if (range === 'month') date.setMonth(date.getMonth() - 1)
  if (range === '3months') date.setMonth(date.getMonth() - 3)
  return date
}

function csvValue(value: unknown) {
  if (value == null) return ''
  const text = value instanceof Date ? value.toISOString() : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function csv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvValue).join(',')).join('\n')
}

export async function GET(request: Request) {
  const session = await auth()
  if (session?.user?.role !== 'admin') {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const url = new URL(request.url)
  const kind = parseKind(url.searchParams.get('kind'))
  const range = parseRange(url.searchParams.get('range'))
  const start = rangeStart(range)

  if (kind === 'audit') {
    const rows = await db
      .select()
      .from(auditLog)
      .where(gte(auditLog.createdAt, start))
      .orderBy(desc(auditLog.createdAt))

    const body = csv([
      ['id', 'createdAt', 'actorId', 'action', 'targetId', 'detail'],
      ...rows.map((row) => [
        row.id,
        row.createdAt,
        row.actorId,
        row.action,
        row.targetId,
        JSON.stringify(row.detail ?? {}),
      ]),
    ])

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-log-${range}.csv"`,
      },
    })
  }

  const rows = await db
    .select()
    .from(errorLog)
    .where(gte(errorLog.createdAt, start))
    .orderBy(desc(errorLog.createdAt))

  const body = csv([
    ['id', 'createdAt', 'level', 'source', 'message', 'stack', 'userId', 'requestId', 'metadata'],
    ...rows.map((row) => [
      row.id,
      row.createdAt,
      row.level,
      row.source,
      row.message,
      row.stack,
      row.userId,
      row.requestId,
      JSON.stringify(row.metadata ?? {}),
    ]),
  ])

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="system-errors-${range}.csv"`,
    },
  })
}
