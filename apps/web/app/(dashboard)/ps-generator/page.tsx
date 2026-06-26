const defaults = [
  ['System', 'Double Disc'],
  ['Structure material', 'Timber'],
  ['Structure type', 'Deck'],
  ['Location', 'External'],
  ['Structure built', 'New'],
  ['Glass type', 'Toughened'],
  ['Thickness', '12mm'],
  ['Gate required', 'No'],
]

const modes = [
  ['PS1 only', 'Prepare the PS1 producer statement package.'],
  ['PS3 only', 'Prepare the PS3 producer statement package.'],
  ['PS1 + PS3', 'Create both producer statement packages under one generation event.'],
]

export default function PsGeneratorPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Generate PS</h1>
          <p className="mt-1 text-sm text-gray-500">Create PS1 and PS3 producer statement packages from the published configuration.</p>
        </div>
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          Configuration-backed generation foundation
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        {modes.map(([title, body]) => (
          <div key={title} className="rounded border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-gray-950">{title}</h2>
            <p className="mt-2 text-sm text-gray-600">{body}</p>
          </div>
        ))}
      </section>

      <section className="rounded border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-950">Generation defaults</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {defaults.map(([label, value]) => (
            <div key={label} className="rounded border border-gray-100 bg-gray-50 p-3">
              <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-950">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-950">Next implementation surface</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {['Published systems and option rules', 'Server-side PDF generation with R2 objects', 'Generation records and retained downloads'].map((item) => (
            <div key={item} className="rounded border border-gray-100 p-3 text-sm text-gray-700">{item}</div>
          ))}
        </div>
      </section>
    </div>
  )
}
