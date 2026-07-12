import Link from 'next/link'

export interface GuideSection {
  title: string
  body?: string
  items?: string[]
}

export interface ModuleGuide {
  title: string
  summary: string
  backHref: string
  backLabel: string
  sections: GuideSection[]
}

export function ModuleGuidePage({ guide }: { guide: ModuleGuide }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">{guide.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">{guide.summary}</p>
        </div>
        <Link
          href={guide.backHref}
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          {guide.backLabel}
        </Link>
      </div>

      <div className="space-y-4">
        {guide.sections.map((section) => (
          <section key={section.title} className="rounded border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-950">{section.title}</h2>
            {section.body && <p className="mt-2 text-sm leading-6 text-gray-600">{section.body}</p>}
            {section.items && (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-gray-600">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
