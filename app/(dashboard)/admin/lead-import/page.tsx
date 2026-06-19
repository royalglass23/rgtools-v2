import { requireModule } from '@/lib/guard'
import { getActiveScoringOptionLists } from '@/modules/lead-intake/scoring/config-options'
import { LeadImportClient } from '@/modules/lead-intake/import/LeadImportClient'

export default async function LeadImportPage() {
  await requireModule('admin/lead-import')
  const optionLists = await getActiveScoringOptionLists()

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">Lead Import</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload the canonical template, review ServiceM8-enriched rows, and commit scored leads.
        </p>
      </div>

      <LeadImportClient optionLists={optionLists} />
    </div>
  )
}

