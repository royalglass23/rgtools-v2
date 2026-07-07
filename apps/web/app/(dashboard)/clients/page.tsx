import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getClientsList, type ClientCleanupFilter } from '@/modules/clients/queries'
import { ServiceM8ClientsImportButton } from '@/modules/clients/ServiceM8ClientsImportButton'

const cleanupFilters: Array<{ value: ClientCleanupFilter; label: string }> = [
  { value: 'all', label: 'All clients' },
  { value: 'imported', label: 'Imported' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'possible_duplicates', label: 'Possible Duplicates' },
  { value: 'no_contact_details', label: 'No Contact Details' },
  { value: 'no_client_type', label: 'No Client Type' },
  { value: 'servicem8_linked', label: 'ServiceM8 Linked' },
]

type ClientsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams
  const search = firstParam(params?.search) ?? ''
  const cleanupFilter = parseCleanupFilter(firstParam(params?.filter))
  const [clients, session] = await Promise.all([
    getClientsList({ search, cleanupFilter }),
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

      <form className="flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-white p-3 shadow-sm">
        <div className="min-w-64 flex-1">
          <label htmlFor="client-search" className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Search
          </label>
          <input
            id="client-search"
            name="search"
            defaultValue={search}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-950 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            placeholder="Name or alias"
          />
        </div>
        <div>
          <label htmlFor="client-filter" className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Cleanup filter
          </label>
          <select
            id="client-filter"
            name="filter"
            defaultValue={cleanupFilter}
            className="mt-1 min-w-56 rounded border border-gray-300 px-3 py-2 text-sm text-gray-950 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          >
            {cleanupFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>{filter.label}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">
          Apply
        </button>
        {(search || cleanupFilter !== 'all') && (
          <Link href="/clients" className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Reset
          </Link>
        )}
      </form>

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
                  {client.aliasNames.length > 0 && (
                    <div className="mt-1 text-xs text-gray-500">Aliases: {client.aliasNames.join(', ')}</div>
                  )}
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

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function parseCleanupFilter(value: string | undefined): ClientCleanupFilter {
  return cleanupFilters.some((filter) => filter.value === value) ? value as ClientCleanupFilter : 'all'
}
