import Link from 'next/link'
import { auth } from '@/lib/auth'
import { LeadsTableControls } from '@/modules/leads/LeadsTableControls'
import { getLeadsList, parseLeadsListFilters } from '@/modules/leads/queries'

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseLeadsListFilters(await searchParams)
  const [{ rows, total, pageCount }, session] = await Promise.all([
    getLeadsList(filters),
    auth(),
  ])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-950">Leads</h1>
        <Link
          href="/lead-intake"
          className="rounded bg-[#142B3A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d3d52]"
        >
          New Lead
        </Link>
      </div>

      <LeadsTableControls
        filters={filters}
        rows={rows}
        total={total}
        pageCount={pageCount}
        isAdmin={session?.user?.role === 'admin'}
      />
    </div>
  )
}
