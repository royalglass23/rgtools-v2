import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

const sections = [
  ['Systems', 'Display names, height rules, visibility state, and template variants.'],
  ['Option rules', 'Fixed Phase 1 categories with per-system allowed values.'],
  ['Templates', 'R2-backed fillable PDFs with discovered AcroForm fields.'],
  ['Field mappings', 'Text and checkbox mappings from project values, rules, dates, descriptions, or fixed states.'],
  ['Description templates', 'Versioned wording used by generated producer statement packages.'],
  ['Audit trail', 'Draft saves, test generations, publishes, archives, and migration activity.'],
]

export default async function PsConfigurationPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'admin') redirect('/?denied=ps-generator/configuration')

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">PS Configuration</h1>
        <p className="mt-1 text-sm text-gray-500">Manage draft and published configuration for PS Generator systems, templates, mappings, and wording.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map(([title, body]) => (
          <section key={title} className="rounded border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-gray-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">{body}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
