import { requireModule } from '@/lib/guard'
import {
  createWorkOrderHardwareStatusAction,
  createWorkOrderInstallerAction,
  createWorkOrderStageAction,
  deactivateWorkOrderHardwareStatusAction,
  deactivateWorkOrderInstallerAction,
  deactivateWorkOrderStageAction,
  saveWorkOrderSummaryConfigAction,
} from '@/modules/work-orders/actions'
import { getWorkOrderConfigLists } from '@/modules/work-orders/queries'
import { SummaryFieldsEditor } from '@/modules/work-orders/SummaryFieldsEditor'
import { getWorkOrderSummaryConfig } from '@/modules/work-orders/summary-config'

export default async function WorkOrderConfigurationPage() {
  await requireModule('admin/work-orders')
  const [{ installers, stages, hardwareStatuses }, summaryFields] = await Promise.all([
    getWorkOrderConfigLists(),
    getWorkOrderSummaryConfig(),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">Work Order Configuration</h1>
        <p className="mt-1 text-sm text-gray-500">Controlled installer, stage, and hardware status lists.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ConfigPanel
          title="Installers"
          action={createWorkOrderInstallerAction}
          deactivateAction={deactivateWorkOrderInstallerAction}
          rows={installers}
        />
        <ConfigPanel
          title="Stages"
          action={createWorkOrderStageAction}
          deactivateAction={deactivateWorkOrderStageAction}
          rows={stages}
        />
        <ConfigPanel
          title="Hardware Statuses"
          action={createWorkOrderHardwareStatusAction}
          deactivateAction={deactivateWorkOrderHardwareStatusAction}
          rows={hardwareStatuses}
        />
      </div>

      <SummaryFieldsPanel fields={summaryFields} />
    </div>
  )
}

function ConfigPanel({
  title,
  action,
  deactivateAction,
  rows,
}: {
  title: string
  action: (formData: FormData) => Promise<void>
  deactivateAction: (optionId: string) => Promise<void>
  rows: Array<{ id: string; displayName: string; isActive: boolean }>
}) {
  return (
    <section className="rounded border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-4">
        <h2 className="text-sm font-semibold text-gray-950">{title}</h2>
        <form action={action} className="mt-3 flex gap-2">
          <input
            name="displayName"
            className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
            placeholder="Add option"
          />
          <button type="submit" className="rounded bg-[#142B3A] px-3 py-2 text-sm font-medium text-white hover:bg-[#1d3d52]">
            Add
          </button>
        </form>
      </div>
      <ul className="divide-y divide-gray-100">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="font-medium text-gray-800">{row.displayName}</span>
            <div className="flex items-center gap-2">
              <span className={`rounded px-2 py-1 text-xs font-semibold ${row.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {row.isActive ? 'Active' : 'Inactive'}
              </span>
              {row.isActive && (
                <form action={deactivateAction.bind(null, row.id)}>
                  <button type="submit" className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                    Deactivate
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="px-4 py-6 text-sm text-gray-500">No options yet.</li>
        )}
      </ul>
    </section>
  )
}

function SummaryFieldsPanel({
  fields,
}: {
  fields: Awaited<ReturnType<typeof getWorkOrderSummaryConfig>>
}) {
  return (
    <section className="rounded border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-4">
        <h2 className="text-sm font-semibold text-gray-950">Work Order Summary Fields</h2>
      </div>
      <form action={saveWorkOrderSummaryConfigAction}>
        <SummaryFieldsEditor fields={fields} />
        <div className="border-t border-gray-100 p-4">
          <button type="submit" className="rounded bg-[#142B3A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d3d52]">
            Save summary fields
          </button>
        </div>
      </form>
    </section>
  )
}
