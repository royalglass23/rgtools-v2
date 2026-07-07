import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { updateClientDashboardAction } from '@/modules/clients/dashboard-actions'
import { getClientDetail } from '@/modules/clients/queries'

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [client, session] = await Promise.all([
    getClientDetail(id),
    auth(),
  ])
  if (!client) notFound()
  const canEdit = session?.user?.role === 'admin'
  const updateAction = updateClientDashboardAction.bind(null, client.id)
  const primaryContact = client.contacts[0]

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <Link href="/clients" className="text-sm text-gray-500 hover:text-gray-900">Back to clients</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-950">{client.companyName}</h1>
          {client.servicem8CompanyUuid ? (
            <span className="inline-flex rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">ServiceM8 linked</span>
          ) : (
            <span className="inline-flex rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Provisional</span>
          )}
          {client.cleanupFlags.imported && (
            <span className="inline-flex rounded bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800">Imported</span>
          )}
          <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${reviewStatusClass(client.reviewStatus)}`}>
            {reviewStatusLabel(client.reviewStatus)}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {client.contactCount} contacts · {client.projectCount} projects · Last activity {formatDateTime(client.lastActivityAt)}
        </p>
      </div>

      {canEdit && (
        <Section title="Client cleanup">
          <form action={updateAction} className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name" name="name" defaultValue={client.name} required />
            <Field label="Company name" name="companyName" defaultValue={client.companyName} />
            <Field label="Client email" name="email" defaultValue={client.email} type="email" />
            <Field label="Client phone" name="phone" defaultValue={client.phone} />
            <SelectField
              label="Client type"
              name="clientType"
              defaultValue={client.clientType}
              options={[
                ['', 'Not set'],
                ['homeowner', 'Homeowner'],
                ['builder', 'Builder'],
                ['developer', 'Developer'],
                ['investor', 'Investor'],
                ['repeat_exclusive', 'Repeat exclusive'],
              ]}
            />
            <SelectField
              label="Identity type"
              name="identityType"
              defaultValue={client.identityType}
              options={[
                ['', 'Not set'],
                ['company', 'Company'],
                ['individual_homeowner', 'Individual homeowner'],
                ['household', 'Household'],
                ['contractor', 'Contractor'],
                ['sole_trader', 'Sole trader'],
                ['other', 'Other'],
              ]}
            />
            <Field label="Primary contact name" name="primaryContactName" defaultValue={primaryContact?.name} />
            <Field label="Primary contact email" name="primaryContactEmail" defaultValue={primaryContact?.email} type="email" />
            <Field label="Primary contact phone" name="primaryContactPhone" defaultValue={primaryContact?.phone ?? primaryContact?.phoneNormalized} />
            <SelectField
              label="Review status"
              name="reviewStatus"
              defaultValue={client.reviewStatus}
              options={[
                ['pending_review', 'Needs review'],
                ['reviewed', 'Reviewed'],
                ['dismissed', 'Dismissed'],
              ]}
            />
            <TextAreaField label="Client notes" name="notes" defaultValue={client.notes} className="sm:col-span-2" />
            <TextAreaField label="Review note" name="reviewNote" defaultValue={client.reviewNote} className="sm:col-span-2" />
            <TextAreaField
              label="Manual aliases"
              name="aliases"
              defaultValue={client.manualAliasNames.join('\n')}
              className="sm:col-span-2"
            />
            {client.sourceAliasNames.length > 0 && (
              <div className="sm:col-span-2 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                Preserved import and merge aliases: {client.sourceAliasNames.join(', ')}
              </div>
            )}
            <div className="sm:col-span-2">
              <button type="submit" className="rounded bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">
                Save client
              </button>
            </div>
          </form>
        </Section>
      )}

      <Section title="Related details">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <DetailTerm label="Client type" value={client.clientType ?? client.identityType} />
          <DetailTerm label="Email" value={client.email} />
          <DetailTerm label="Phone" value={client.phone} />
          <DetailTerm label="Aliases" value={[...client.sourceAliasNames, ...client.manualAliasNames].join(', ') || null} />
        </dl>
      </Section>

      <Section title="Notes">
        {client.notes ? (
          <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{client.notes}</p>
        ) : (
          <p className="text-sm text-gray-500">No shared client notes.</p>
        )}
      </Section>

      <Section title="Contacts">
        <div className="overflow-hidden rounded border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {client.contacts.map((contact) => (
                <tr key={contact.id}>
                  <td className="px-4 py-3 font-medium text-gray-950">{contact.name ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{contact.email ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{contact.phone ?? contact.phoneNormalized ?? '-'}</td>
                </tr>
              ))}
              {client.contacts.length === 0 && <EmptyRow colSpan={3} label="No contacts." />}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Projects">
        <div className="overflow-hidden rounded border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {client.projects.map((project) => (
                <tr key={`${project.kind}-${project.id}`}>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                      {projectKindLabel(project.kind)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-950">
                    <Link href={projectHref(project.kind, project.id)} className="hover:text-sky-800">
                      {project.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{project.address ?? '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">{formatDate(project.updatedAt)}</td>
                </tr>
              ))}
              {client.projects.length === 0 && <EmptyRow colSpan={4} label="No projects." />}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Work Orders">
        <div className="overflow-hidden rounded border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Current</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {client.workOrders.map((workOrder) => (
                <tr key={workOrder.id}>
                  <td className="px-4 py-3 font-medium text-gray-950">
                    <Link href={`/work-orders/${workOrder.id}`} className="hover:text-sky-800">
                      {workOrder.jobDescription ?? workOrder.jobNumber ?? 'Work order'}
                    </Link>
                    {workOrder.jobNumber && (
                      <div className="mt-1 text-xs font-normal text-gray-500">{workOrder.jobNumber}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{workOrder.jobAddress ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{workOrder.servicem8Status}</td>
                  <td className="px-4 py-3 text-gray-700">{workOrder.isCurrent ? 'Current' : 'Historic'}</td>
                </tr>
              ))}
              {client.workOrders.length === 0 && <EmptyRow colSpan={4} label="No work orders." />}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Leads">
        <div className="overflow-hidden rounded border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Job number</th>
                <th className="px-4 py-3">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {client.leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-4 py-3 font-medium text-gray-950">
                    <Link href={`/leads/${lead.id}`} className="hover:text-sky-800">{lead.projectType ?? 'Lead'}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{lead.location ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{lead.servicem8JobNumber ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{lead.tier ?? '-'}</td>
                </tr>
              ))}
              {client.leads.length === 0 && <EmptyRow colSpan={4} label="No leads." />}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Quotes">
        <div className="overflow-hidden rounded border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Quote</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {client.quotes.map((quote) => (
                <tr key={quote.id}>
                  <td className="px-4 py-3 font-medium text-gray-950">
                    <Link href={`/quote-tracker/${quote.id}`} className="hover:text-sky-800">{quote.jobDescription ?? quote.shortCode ?? 'Quote'}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{quote.jobAddress ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{quote.quoteValue ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{quote.statusTag ?? '-'}</td>
                </tr>
              ))}
              {client.quotes.length === 0 && <EmptyRow colSpan={4} label="No quotes." />}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Recent Activity">
        <ol className="divide-y divide-gray-100 overflow-hidden rounded border border-gray-200 text-sm">
          {client.recentActivity.map((activity) => (
            <li key={`${activity.kind}-${activity.id}-${activity.occurredAt.toISOString()}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="font-medium text-gray-950">{activity.title}</span>
                <span className="ml-2 inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                  {activityKindLabel(activity.kind)}
                </span>
                {activity.detail && <p className="mt-1 text-gray-600">{activity.detail}</p>}
              </div>
              <time className="whitespace-nowrap text-xs text-gray-500">{formatDateTime(activity.occurredAt)}</time>
            </li>
          ))}
          {client.recentActivity.length === 0 && (
            <li className="px-4 py-6 text-center text-gray-500">No recent activity.</li>
          )}
        </ol>
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

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-6 text-center text-gray-500">{label}</td>
    </tr>
  )
}

function DetailTerm({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-gray-950">{value || '-'}</dd>
    </div>
  )
}

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
  required = false,
}: {
  label: string
  name: string
  defaultValue?: string | null
  type?: string
  required?: boolean
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ''}
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-950 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
    </label>
  )
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string
  name: string
  defaultValue?: string | null
  options: Array<[string, string]>
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ''}
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-950 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      >
        {options.map(([value, labelText]) => (
          <option key={value} value={value}>{labelText}</option>
        ))}
      </select>
    </label>
  )
}

function TextAreaField({
  label,
  name,
  defaultValue,
  className = '',
}: {
  label: string
  name: string
  defaultValue?: string | null
  className?: string
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ''}
        rows={3}
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-950 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
    </label>
  )
}

function formatDate(date: Date | string) {
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

function projectKindLabel(kind: 'lead' | 'quote' | 'work_order') {
  if (kind === 'lead') return 'Lead'
  if (kind === 'quote') return 'Quote'
  return 'Work order'
}

function projectHref(kind: 'lead' | 'quote' | 'work_order', id: string) {
  if (kind === 'lead') return `/leads/${id}`
  if (kind === 'quote') return `/quote-tracker/${id}`
  return `/work-orders/${id}`
}

function activityKindLabel(kind: 'client' | 'contact' | 'lead' | 'quote' | 'work_order') {
  if (kind === 'work_order') return 'Work order'
  return kind.charAt(0).toUpperCase() + kind.slice(1)
}

function reviewStatusLabel(status: 'pending_review' | 'reviewed' | 'dismissed') {
  if (status === 'pending_review') return 'Needs review'
  if (status === 'reviewed') return 'Reviewed'
  return 'Dismissed'
}

function reviewStatusClass(status: 'pending_review' | 'reviewed' | 'dismissed') {
  if (status === 'pending_review') return 'bg-amber-100 text-amber-800'
  if (status === 'reviewed') return 'bg-emerald-100 text-emerald-800'
  return 'bg-gray-100 text-gray-700'
}
