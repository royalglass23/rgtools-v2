import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function ClientsConfigurationPage() {
  const session = await auth()
  if (session?.user?.role !== 'admin') redirect('/?denied=clients')

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">Client Configuration</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Review the current client cleanup controls and duplicate-review workflow.
        </p>
      </div>

      <section className="rounded border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-950">Cleanup filters</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Client cleanup is handled from the Clients list and client detail pages. Use filters such as Needs Review,
          Possible Duplicates, No Contact Details, No Client Type, and ServiceM8 Linked to find records that need attention.
        </p>
        <div className="mt-4">
          <Link
            href="/clients?filter=needs_review"
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Open cleanup list
          </Link>
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-950">Duplicate review</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Merge Review is the admin-controlled place for confirming or dismissing possible duplicate client groups.
        </p>
        <div className="mt-4">
          <Link
            href="/admin/client-merge-review"
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Open merge review
          </Link>
        </div>
      </section>
    </div>
  )
}
