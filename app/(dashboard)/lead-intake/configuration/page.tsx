import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { LeadTableConfiguration } from '@/modules/leads/LeadTableConfiguration'
import { loadTablePrefs } from '@/modules/leads/table-prefs'
import { DEFAULT_LEADS_PREFS } from '@/modules/leads/table-prefs-shared'

export default async function LeadIntakeConfigurationPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'admin') redirect('/?denied=lead-intake/configuration')

  const prefs = await loadTablePrefs(session.user.id, 'leads').catch(() => DEFAULT_LEADS_PREFS)

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">Lead Intake Configuration</h1>
        <p className="mt-1 text-sm text-gray-500">Configure the lead intake list columns and default sorting.</p>
      </div>

      <LeadTableConfiguration prefs={prefs} />
    </div>
  )
}
