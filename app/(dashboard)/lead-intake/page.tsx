import { getActiveScoringOptionLists } from '@/lib/scoring/config-options'
import { getLeadIntakeForEdit } from './actions'
import { LeadIntakeForm } from './LeadIntakeForm'

export default async function LeadIntakePage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>
}) {
  const optionLists = await getActiveScoringOptionLists()
  const { leadId } = await searchParams
  const initialInput = leadId ? await getLeadIntakeForEdit(leadId) : null

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">Lead Intake</h1>
        <p className="mt-1 text-sm text-gray-500">
          {initialInput ? 'Qualify an existing lead and refresh its score.' : 'Capture the first conversation and get an immediate seed tier.'}
        </p>
      </div>
      <LeadIntakeForm optionLists={optionLists} initialInput={initialInput ?? undefined} />
    </div>
  )
}
