// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const orderByCalls = vi.hoisted(() => [] as unknown[][])
const whereCalls = vi.hoisted(() => [] as unknown[])

vi.mock('drizzle-orm', () => {
  function columnName(column: { name?: string }) {
    return column?.name
  }

  return {
    and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions })),
    asc: vi.fn((column: { name?: string }) => ({ direction: 'asc', column: columnName(column) })),
    count: vi.fn(() => 'count'),
    desc: vi.fn((column: unknown) => ({ direction: 'desc', column })),
    eq: vi.fn((column: { name?: string }, value: unknown) => ({ type: 'eq', column: columnName(column), value })),
    ilike: vi.fn((column: { name?: string }, value: unknown) => ({ type: 'ilike', column: columnName(column), value })),
    or: vi.fn((...conditions: unknown[]) => ({ type: 'or', conditions })),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: 'sql',
      text: strings.join('?'),
      values,
    })),
  }
})

vi.mock('@rgtools/db/schema-leads', () => ({
  clients: { id: { name: 'clients.id' }, name: { name: 'clients.name' }, companyName: { name: 'clients.company_name' } },
  leads: {
    id: { name: 'leads.id' },
    clientId: { name: 'leads.client_id' },
    seedScore: { name: 'leads.seed_score' },
    servicem8JobUuid: { name: 'leads.servicem8_job_uuid' },
    servicem8JobNumber: { name: 'leads.servicem8_job_number' },
  },
}))

vi.mock('@rgtools/db/schema-workorders', () => ({
  workOrderHardwareStatusOptions: {
    id: { name: 'hardware.id' },
    displayName: { name: 'hardware.display_name' },
    isActive: { name: 'hardware.is_active' },
    sortOrder: { name: 'hardware.sort_order' },
  },
  workOrderInstallers: {
    id: { name: 'installers.id' },
    displayName: { name: 'installers.display_name' },
    isActive: { name: 'installers.is_active' },
  },
  workOrders: {
    id: { name: 'work_orders.id' },
    servicem8Status: { name: 'work_orders.servicem8_status' },
    isCurrent: { name: 'work_orders.is_current' },
    jobNumber: { name: 'work_orders.job_number' },
    jobAddress: { name: 'work_orders.job_address' },
    jobDescription: { name: 'work_orders.job_description' },
    clientName: { name: 'work_orders.client_name' },
    companyName: { name: 'work_orders.company_name' },
    leadScore: { name: 'work_orders.lead_score' },
    installerId: { name: 'work_orders.installer_id' },
    stageOptionId: { name: 'work_orders.stage_option_id' },
    hardwareStatusOptionId: { name: 'work_orders.hardware_status_option_id' },
    installDate: { name: 'work_orders.install_date' },
    dateCompleted: { name: 'work_orders.date_completed' },
    riskLevelOverride: { name: 'work_orders.risk_level_override' },
    aiRiskLevel: { name: 'work_orders.ai_risk_level' },
    importanceOverride: { name: 'work_orders.importance_override' },
    aiImportance: { name: 'work_orders.ai_importance' },
    aiSuggestion: { name: 'work_orders.ai_suggestion' },
    clientContextSummary: { name: 'work_orders.client_context_summary' },
    clientApproachNote: { name: 'work_orders.client_approach_note' },
    updatedAt: { name: 'work_orders.updated_at' },
    servicem8JobUuid: { name: 'work_orders.servicem8_job_uuid' },
  },
  workOrderStageOptions: {
    id: { name: 'stages.id' },
    displayName: { name: 'stages.display_name' },
    isActive: { name: 'stages.is_active' },
    sortOrder: { name: 'stages.sort_order' },
  },
}))

function queryBuilder(result: unknown) {
  const builder: Record<string, unknown> = {}
  builder.leftJoin = vi.fn(() => builder)
  builder.innerJoin = vi.fn(() => builder)
  builder.groupBy = vi.fn(() => builder)
  builder.orderBy = vi.fn((...orders: unknown[]) => {
    orderByCalls.push(orders)
    return builder
  })
  builder.where = vi.fn((condition: unknown) => {
    whereCalls.push(condition)
    return builder
  })
  builder.limit = vi.fn(() => builder)
  builder.offset = vi.fn(async () => result)
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return builder
}

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn((shape: Record<string, unknown>) => ({
      from: vi.fn(() => queryBuilder('total' in shape ? [{ total: 0 }] : [])),
    })),
  },
}))

import { listWorkOrders } from '../queries'
import type { WorkOrderListFilters } from '../list-filters'

const filters: WorkOrderListFilters = {
  q: '',
  current: 'current',
  risk: 'all',
  importance: 'all',
  stage: 'all',
  hardware: 'all',
  sort: 'lead_score',
  page: 1,
  size: 10,
}

beforeEach(() => {
  vi.clearAllMocks()
  orderByCalls.length = 0
  whereCalls.length = 0
})

describe('listWorkOrders', () => {
  it('excludes non-current records by default without narrowing to one ServiceM8 status', async () => {
    await listWorkOrders(filters)

    expect(whereCalls[1]).toEqual(expect.objectContaining({
      type: 'and',
      conditions: [{ type: 'eq', column: 'work_orders.is_current', value: true }],
    }))
  })

  it('searches the summary identifiers staff use in quote tracker and lead intake', async () => {
    await listWorkOrders({ ...filters, q: 'R260210' })

    expect(whereCalls[1]).toEqual(expect.objectContaining({
      type: 'and',
      conditions: expect.arrayContaining([
        expect.objectContaining({
          type: 'or',
          conditions: expect.arrayContaining([
            { type: 'ilike', column: 'work_orders.client_name', value: '%R260210%' },
            { type: 'ilike', column: 'work_orders.company_name', value: '%R260210%' },
            { type: 'ilike', column: 'work_orders.job_number', value: '%R260210%' },
            { type: 'ilike', column: 'work_orders.job_address', value: '%R260210%' },
            { type: 'ilike', column: 'work_orders.job_description', value: '%R260210%' },
          ]),
        }),
      ]),
    }))
  })

  it('uses the default priority sort before falling back to oldest untouched records', async () => {
    await listWorkOrders(filters)

    expect(orderByCalls[0]).toHaveLength(5)
    expect(orderByCalls[0][0]).toEqual(expect.objectContaining({
      type: 'sql',
      text: '? desc nulls last',
    }))
    expect(orderByCalls[0][3]).toEqual(expect.objectContaining({
      type: 'sql',
      text: '? asc nulls last',
    }))
    expect(orderByCalls[0][4]).toEqual({ direction: 'asc', column: 'work_orders.updated_at' })
  })
})
