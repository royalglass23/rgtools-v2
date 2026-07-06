import { requireModule } from '@/lib/guard'
import { loadClientMergeRows } from '@/modules/clients/merge-cleanup'
import { planClientMerges, type ClientMergePlanRow } from '@/modules/clients/merge-planner'
import { confirmClientMergeReviewGroup } from '@/modules/clients/review-actions'
import type { ServiceM8FetchRequest } from '@/lib/servicem8/client'

const noExternalServiceM8: ServiceM8FetchRequest = async () => ({
  ok: false,
  status: 503,
  json: async () => null,
})

export default async function ClientMergeReviewPage() {
  await requireModule('admin')
  await requireModule('clients')

  const rows = await loadClientMergeRows(noExternalServiceM8)
  const plan = planClientMerges(rows)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Client Merge Review</h1>
          <p className="mt-1 text-sm text-slate-600">
            Ambiguous client groups need a human confirmation before anything is merged.
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <Stat label="Auto" value={plan.autoMergeGroups.length} />
          <Stat label="Review" value={plan.reviewGroups.length} />
        </div>
      </div>

      {plan.reviewGroups.length === 0 ? (
        <div className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No ambiguous client groups are waiting for review.
        </div>
      ) : (
        <div className="space-y-4">
          {plan.reviewGroups.map((group) => (
            <section key={group.key} className="rounded border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="text-sm font-medium text-slate-950">{group.reason.replace('_', ' ')}</div>
                <div className="text-xs text-slate-500">{group.key}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Client</th>
                      <th className="px-4 py-2 font-medium">Company UUID</th>
                      <th className="px-4 py-2 font-medium">Phone</th>
                      <th className="px-4 py-2 font-medium">Email</th>
                      <th className="px-4 py-2 font-medium">Created</th>
                      <th className="px-4 py-2 font-medium">Confirm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.rows.map((row) => (
                      <ReviewRow key={row.id} survivor={row} rows={group.rows} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded border border-slate-200 bg-white px-3 py-2 text-right">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-950">{value}</div>
    </div>
  )
}

function ReviewRow({ survivor, rows }: { survivor: ClientMergePlanRow; rows: ClientMergePlanRow[] }) {
  const loserIds = rows.filter((row) => row.id !== survivor.id).map((row) => row.id)

  return (
    <tr>
      <td className="px-4 py-3">
        <div className="font-medium text-slate-950">{survivor.name}</div>
        <div className="text-xs text-slate-500">{survivor.companyName ?? 'No company name'}</div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-slate-600">
        {survivor.servicem8CompanyUuid ?? survivor.resolvedServiceM8CompanyUuid ?? '-'}
      </td>
      <td className="px-4 py-3 text-slate-700">{survivor.phoneNormalized ?? '-'}</td>
      <td className="px-4 py-3 text-slate-700">{survivor.email ?? '-'}</td>
      <td className="px-4 py-3 text-slate-700">{formatDate(survivor.createdAt)}</td>
      <td className="px-4 py-3">
        <form action={confirmClientMergeReviewGroup}>
          <input type="hidden" name="survivorId" value={survivor.id} />
          {loserIds.map((id) => (
            <input key={id} type="hidden" name="loserIds" value={id} />
          ))}
          <button
            type="submit"
            className="rounded border border-sky-700 px-3 py-1.5 text-sm font-medium text-sky-800 transition-colors hover:bg-sky-50"
          >
            Keep this row
          </button>
        </form>
      </td>
    </tr>
  )
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'medium',
  }).format(date)
}
