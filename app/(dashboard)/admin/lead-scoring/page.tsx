import { requireModule } from '@/lib/guard'

export default async function LeadScoringAdminPage() {
  await requireModule('admin/lead-scoring')

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Lead Scoring</h1>
      <div className="rounded border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-600">
          Lead scoring administration will be added here when the scoring UI issue lands.
        </p>
      </div>
    </div>
  )
}
