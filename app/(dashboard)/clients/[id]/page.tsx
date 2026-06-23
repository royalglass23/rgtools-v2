import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getClientDetail } from '@/modules/clients/queries'

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = await getClientDetail(id)
  if (!client) notFound()

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
