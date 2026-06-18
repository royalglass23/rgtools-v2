import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getLeadDetail } from '@/modules/leads/queries'
import { ServiceM8FetchButton } from '@/modules/leads/ServiceM8FetchButton'
import { DeleteLeadButton } from '@/modules/leads/DeleteLeadButton'
import { AiSuggestionButton } from '@/modules/leads/AiSuggestionButton'
import { deleteLeadAction, generateLeadSuggestionAction } from './actions'

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [lead, session] = await Promise.all([getLeadDetail(id), auth()])
  if (!lead) notFound()

  const tier = lead.tier ?? 'D'
  const boundDeleteAction = deleteLeadAction.bind(null, lead.id)

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/leads" className="text-sm text-gray-500 hover:text-gray-900">Back to leads</Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-950">{lead.clientName}</h1>
            <TierBadge tier={tier} />
          </div>
          {lead.companyName && <p className="mt-1 text-sm text-gray-500">{lead.companyName}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/lead-intake?leadId=${lead.id}`}
            className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit
          </Link>
          {session?.user?.role === 'admin' && (
            <form action={boundDeleteAction}>
              <DeleteLeadButton clientName={lead.clientName} />
            </form>
          )}
        </div>
      </div>

      <Section title="Client">
        <dl className="grid gap-4 sm:grid-cols-4">
          <Field label="Name" value={lead.clientName} />
          <Field label="Company" value={lead.companyName ?? '-'} />
          <Field label="Phone" value={lead.phone ?? '-'} />
          <Field label="Email" value={lead.email ?? '-'} />
        </dl>
      </Section>

      <Section title="Lead">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Job Address" value={lead.location ?? '-'} />
          <Field label="Driving Distance" value={lead.distanceBand} />
          <Field label="Project Type" value={lead.projectType ?? '-'} />
          <Field label="Source" value={lead.source} />
          <Field label="Resource Consent" value={lead.rcStatus ?? '-'} />
          <Field label="Building Consent" value={lead.bcStatus ?? '-'} />
          <Field label="Building Stage" value={lead.buildingStage ?? '-'} />
          <Field label="Follow-up date" value={formatNullableDate(lead.followUpDate)} />
          <Field label="Last update" value={formatDateTime(lead.updatedAt)} />
          <Field label="Anything else" value={lead.freeText ?? '-'} />
        </dl>
      </Section>

      <Section title="Scored Fields">
        <div className="overflow-hidden rounded border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Selected answer</th>
                <th className="px-4 py-3">Points earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lead.scoredFields.map((field) => (
                <tr key={field.category}>
                  <td className="px-4 py-3 font-medium text-gray-900">{field.label}</td>
                  <td className="px-4 py-3 text-gray-700">{field.answer}</td>
                  <td className="px-4 py-3 text-gray-700">{field.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Score Summary">
        <dl className="grid gap-4 sm:grid-cols-5">
          <Field label="Tier" value={tier} />
          <Field label="Score" value={String(lead.seedScore ?? 0)} />
          <Field label="Completeness" value={`${lead.completeness ?? 0}%`} />
          <Field label="Flag note" value={lead.strikeFlag ?? '-'} />
          <Field label="Score reason" value={lead.scoreReason ?? '-'} />
        </dl>
      </Section>

      <Section title="Suggested next step">
        <AiSuggestionButton
          leadId={lead.id}
          initialSuggestion={lead.aiSuggestion}
          initialGeneratedAt={lead.aiSuggestionAt}
          action={generateLeadSuggestionAction}
        />
      </Section>

      <Section title="ServiceM8">
        <ServiceM8FetchButton
          leadId={lead.id}
          initialJobUuid={lead.servicem8JobUuid}
          initialJobStatus={lead.servicem8Status}
          initialLeadsQuality={lead.tier ? `Leads Quality ${lead.tier}` : 'Not set'}
        />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-950">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-gray-950">{value}</dd>
    </div>
  )
}

function formatNullableDate(date: Date | string | null) {
  if (!date) return '-'
  return new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date))
}

function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

function TierBadge({ tier }: { tier: string }) {
  const classes = {
    A: 'bg-green-100 text-green-800',
    B: 'bg-blue-100 text-blue-800',
    C: 'bg-yellow-100 text-yellow-800',
    D: 'bg-gray-100 text-gray-700',
  }[tier] ?? 'bg-gray-100 text-gray-700'

  return <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${classes}`}>{tier}</span>
}
