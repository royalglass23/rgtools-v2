import { NextResponse } from 'next/server'
import { rowsToCsv } from '@/lib/audit-export'
import { requireModule } from '@/lib/guard'
import { parseWorkOrderListFilters } from '@/modules/work-orders/list-filters'
import { listWorkOrdersForExport, type WorkOrderRow } from '@/modules/work-orders/queries'
import { getWorkOrderSummaryConfig, type WorkOrderSummaryFieldConfig } from '@/modules/work-orders/summary-config'

export async function GET(request: Request) {
  await requireModule('work-orders')

  const url = new URL(request.url)
  const filters = parseWorkOrderListFilters(Object.fromEntries(url.searchParams.entries()))
  const [rows, fields] = await Promise.all([
    listWorkOrdersForExport(filters),
    getWorkOrderSummaryConfig(),
  ])
  const visibleFields = fields.filter((field) => field.visible)
  const body = rowsToCsv([
    visibleFields.map((field) => field.label),
    ...rows.map((row) => visibleFields.map((field) => valueForField(row, field))),
  ])

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="work-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}

function valueForField(row: WorkOrderRow, field: WorkOrderSummaryFieldConfig) {
  const values: Record<WorkOrderSummaryFieldConfig['id'], string | number | null> = {
    client: row.companyName ? `${row.clientName} (${row.companyName})` : row.clientName,
    jobNumber: row.jobNumber,
    jobAddress: row.jobAddress,
    leadScore: row.leadScore,
    importance: row.importance,
    risk: row.riskLevel,
    installer: row.installerName,
    stage: row.stageName,
    hardware: row.hardwareStatusName,
    installDate: row.installDate,
    dateCompleted: row.dateCompleted,
    servicem8Status: row.servicem8Status,
    jobDescription: row.jobDescription,
  }

  return values[field.id] ?? ''
}
