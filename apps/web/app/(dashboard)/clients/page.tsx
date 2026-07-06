import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getClientsList } from '@/modules/clients/queries'
import { ServiceM8ClientsImportButton } from '@/modules/clients/ServiceM8ClientsImportButton'

export default async function ClientsPage() {
  const [clients, session] = await Promise.all([
    getClientsList(),
    auth(),
  ])
  const canImportFromServiceM8 = session?.user?.role === 'admin'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Clients</h1>
          <p className="mt-1 text-sm text-gray-600">Companies with their contacts, leads, and tracked quotes.</p>
        </div>
        {canImportFromServiceM8 && <ServiceM8ClientsImportButton />}
      </div>

      <div className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Contacts</th>
              <th className="px-4 py-3">Projects</th>
              <th className="px-4 py-3">Last activity</th>
              <th className="px-4 py-3">ServiceM8</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/clients/${client.id}`} className="font-medium text-gray-950">
                    {client.companyName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <Link href={`/clients/${client.id}`} className="block">{client.contactCount}</Link>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <Link href={`/clients/${client.id}`} className="block">{client.projectCount}</Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                  <Link href={`/clients/${client.id}`} className="block">{formatDate(client.lastActivityAt)}</Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/clients/${client.id}`} className="block">
                    {client.servicem8CompanyUuid ? (
                      <span className="inline-flex rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">Linked</span>
                    ) : (
                      <span className="inline-flex rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Provisional</span>
                    )}
                  </Link>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No clients found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}
