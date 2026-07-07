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
                      {project.kind === 'lead' ? 'Lead' : 'Quote'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-950">
                    <Link href={project.kind === 'lead' ? `/leads/${project.id}` : `/quote-tracker/${project.id}`} className="hover:text-sky-800">
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
