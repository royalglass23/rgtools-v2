// @vitest-environment node

import { getTableName } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const transactionValues = vi.hoisted(() => [] as Array<{ table: string; values: Record<string, unknown> }>)
const mockTransaction = vi.hoisted(() => vi.fn())
const mockSelect = vi.hoisted(() => vi.fn())
const mockRecordRefreshInsert = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  db: {
    insert: mockRecordRefreshInsert,
    select: mockSelect,
    transaction: mockTransaction,
  },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/audit-db', () => ({ logAudit: vi.fn() }))
vi.mock('@/lib/servicem8/client', () => ({ createServiceM8RequestFromEnv: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('../permissions', () => ({
  assertCurrentUserCanConfigureWorkOrders: vi.fn(),
  assertCurrentUserCanManageWorkOrders: vi.fn(),
}))
vi.mock('../queries', () => ({
  findLinkedLeadAndClient: vi.fn(async () => null),
}))

import { refreshWorkOrdersFromServiceM8 } from '../actions'

beforeEach(() => {
  vi.clearAllMocks()
  transactionValues.length = 0

  mockSelect.mockReturnValue({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => []),
      })),
    })),
  })

  mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
    const tx = {
      insert: vi.fn((table: Parameters<typeof getTableName>[0]) => ({
        values: vi.fn((values: Record<string, unknown>) => {
          const tableName = getTableName(table)
          transactionValues.push({ table: tableName, values })

          if (tableName === 'work_orders') {
            return {
              onConflictDoUpdate: vi.fn(() => ({
                returning: vi.fn(async () => [{ id: 'work-order-1', servicem8JobUuid: 'job-1' }]),
              })),
            }
          }

          if (tableName === 'work_order_items') {
            return { onConflictDoUpdate: vi.fn(async () => []) }
          }

          return Promise.resolve([])
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn(async () => []) })),
      })),
    }

    return callback(tx)
  })
})

describe('refreshWorkOrdersFromServiceM8', () => {
  it('persists every active item beneath one Work Order without copying job tracking values', async () => {
    const requestedPaths: string[] = []
    const request = vi.fn(async (path: string) => {
      requestedPaths.push(path)

      if (path.startsWith('/job.json')) {
        return Response.json([{
          uuid: 'job-1',
          active: 1,
          status: 'Work Order',
          generated_job_id: 'R260210',
          company_uuid: 'company-1',
        }])
      }
      if (path.startsWith('/company.json')) {
        return Response.json([{ uuid: 'company-1', name: 'Example Client' }])
      }
      if (path.startsWith('/jobmaterial.json')) {
        return Response.json([
          {
            uuid: 'item-1',
            active: 1,
            job_uuid: 'job-1',
            material_uuid: 'material-1',
            name: 'Shower glass',
            quantity: '1',
            price: '900',
            sort_order: '1',
          },
          {
            uuid: 'item-2',
            active: 1,
            job_uuid: 'job-1',
            material_uuid: 'material-2',
            name: 'Shower hardware',
            quantity: '2',
            price: '75',
            sort_order: '2',
          },
        ])
      }
      if (path.startsWith('/material.json')) {
        return Response.json([
          { uuid: 'material-1', item_number: 'GLASS-001' },
          { uuid: 'material-2', item_number: 'HARDWARE-001' },
        ])
      }

      return Response.json([], { status: 404 })
    })

    await expect(refreshWorkOrdersFromServiceM8(request)).resolves.toEqual({
      synced: 1,
      itemsSynced: 2,
    })

    expect(requestedPaths.some((path) => path.startsWith('/jobmaterial.json'))).toBe(true)
    expect(requestedPaths.some((path) => path.startsWith('/material.json'))).toBe(true)

    const itemWrites = transactionValues.filter((write) => write.table === 'work_order_items')
    expect(itemWrites).toHaveLength(2)
    expect(itemWrites.map((write) => write.values)).toEqual([
      expect.objectContaining({
        workOrderId: 'work-order-1',
        servicem8ItemUuid: 'item-1',
        servicem8JobUuid: 'job-1',
        itemCode: 'GLASS-001',
        quantity: '1',
        originalDescription: 'Shower glass',
        lineTotalExcludingGst: '900.00',
      }),
      expect.objectContaining({
        workOrderId: 'work-order-1',
        servicem8ItemUuid: 'item-2',
        itemCode: 'HARDWARE-001',
        quantity: '2',
        originalDescription: 'Shower hardware',
        lineTotalExcludingGst: '150.00',
      }),
    ])
    for (const write of itemWrites) {
      expect(write.values).not.toHaveProperty('installerId')
      expect(write.values).not.toHaveProperty('stageOptionId')
      expect(write.values).not.toHaveProperty('hardwareStatusOptionId')
      expect(write.values).not.toHaveProperty('maintenanceProgram')
    }
  })

  it('persists an empty parent without creating a placeholder item', async () => {
    const request = vi.fn(async (path: string) => {
      if (path.startsWith('/job.json')) {
        return Response.json([{
          uuid: 'job-1',
          active: 1,
          status: 'Work Order',
          generated_job_id: 'R260210',
        }])
      }
      return Response.json([])
    })

    await expect(refreshWorkOrdersFromServiceM8(request)).resolves.toEqual({
      synced: 1,
      itemsSynced: 0,
    })

    expect(transactionValues.filter((write) => write.table === 'work_orders')).toHaveLength(1)
    expect(transactionValues.filter((write) => write.table === 'work_order_items')).toHaveLength(0)
  })
})
