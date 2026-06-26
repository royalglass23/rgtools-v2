import { NextResponse } from 'next/server'
import { and, desc, eq, gte, isNull, like, lte, or } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLog, errorLog, users } from '@rgtools/db/schema'
import { auditExportRowsToCsv, rowsToCsv } from '@/lib/audit-export'

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

export async function GET(request: Request) {
  const session = await auth()
  if (session?.user?.role !== 'admin') {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const url = new URL(request.url)
  const kind = parseKind(url.searchParams.get('kind'))
  const range = parseRange(url.searchParams.get('range'))
  const start = rangeStart(range)
  const dateFrom = parseDate(url.searchParams.get('dateFrom')) ?? start
  const dateTo = parseDate(url.searchParams.get('dateTo'))
  const actorId = url.searchParams.get('actorId')
  const entityType = url.searchParams.get('entityType')
  const action = url.searchParams.get('action')?.trim()
  const showArchived = url.searchParams.get('showArchived') === '1'

  if (kind === 'audit') {
    const filters = [
      gte(auditLog.createdAt, dateFrom),
      dateTo ? lte(auditLog.createdAt, endOfDay(dateTo)) : undefined,
      actorId ? eq(auditLog.actorId, actorId) : undefined,
      entityType ? or(eq(auditLog.entityType, entityType), like(auditLog.action, `${entityType}.%`)) : undefined,
      action ? like(auditLog.action, `%${action}%`) : undefined,
      showArchived ? undefined : isNull(auditLog.archivedAt),
    ].filter(Boolean)

    const rows = await db
      .select({
        id: auditLog.id,
        createdAt: auditLog.createdAt,
        actorId: auditLog.actorId,
        actorName: users.username,
        entityType: auditLog.entityType,
        action: auditLog.action,
        targetId: auditLog.targetId,
        detail: auditLog.detail,
        ipAddress: auditLog.ipAddress,
        archivedAt: auditLog.archivedAt,
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.actorId, users.id))
      .where(and(...filters))
      .orderBy(desc(auditLog.createdAt))

    const body = auditExportRowsToCsv(rows.map((row) => ({
      ...row,
      actorName: row.actorId ? (row.actorName ?? 'deleted user') : 'deleted user',
    })))

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

  const body = rowsToCsv([
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

function parseDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function endOfDay(date: Date) {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}
