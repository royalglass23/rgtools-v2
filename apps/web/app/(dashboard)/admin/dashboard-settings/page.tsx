import { requireModule } from '@/lib/guard'
import { getDashboardTables } from '@/modules/dashboard/config'
import { DashboardTablesEditor } from '@/modules/admin/dashboard/DashboardTablesEditor'

export default async function DashboardSettingsAdminPage() {
  await requireModule('admin/dashboard-settings')

  const config = await getDashboardTables()

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Control which tables appear on everyone&apos;s dashboard and their default filters.
        </p>
      </div>

      <DashboardTablesEditor initialConfig={config} />
    </div>
  )
}
