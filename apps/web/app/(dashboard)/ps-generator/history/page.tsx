import Link from 'next/link'
import { desc, eq, inArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import { requireModule } from '@/lib/guard'
import { buildPsGenerationHistory, type PsHistoryGenerationRecord } from '@/modules/ps-generator/history'
import {
  psGeneratedPdfObjects,
  psGenerationEvents,
} from '@rgtools/db/schema-ps-generator'

interface PsGeneratorHistoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PsGeneratorHistoryPage({ searchParams }: PsGeneratorHistoryPageProps) {
  await requireModule('ps-generator/history')

  const params = await searchParams
  const jobNumber = parseString(params.jobNumber)
  const records = await loadHistoryRecords(jobNumber)
  const history = buildPsGenerationHistory(records, { jobNumber })

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">PS History</h1>
        <p className="mt-1 text-sm text-gray-500">Find retained Producer Statement records and downloads.</p>
      </div>

      <form className="flex flex-col gap-3 rounded border border-gray-200 bg-white p-4 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-medium text-gray-700">
          Job number
          <input
            name="jobNumber"
            defaultValue={jobNumber ?? ''}
            placeholder="R260210"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <button type="submit" className="rounded bg-gray-950 px-4 py-2 text-sm font-semibold text-white">
          Search
        </button>
        {jobNumber ? (
          <Link href="/ps-generator/history" className="rounded border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">
            Clear
          </Link>
        ) : null}
      </form>

      {history.length === 0 ? (
        <div className="rounded border border-gray-200 bg-white p-6 text-sm text-gray-500">
          No PS generation records found.
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((record) => (
            <article key={record.id} className="rounded border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-950">{record.clientName}</h2>
                  <p className="mt-1 text-sm text-gray-600">{record.jobAddress}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {record.jobNumber ?? 'No job number'} · {formatMode(record.generationMode)} · {record.actorLabel}
                  </p>
                </div>
                <time className="text-sm text-gray-500">{record.createdAt.toLocaleString('en-NZ')}</time>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Snapshot</h3>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div>
                      <dt className="inline text-gray-500">System: </dt>
                      <dd className="inline text-gray-950">{record.systemLabel ?? 'Not recorded'}</dd>
                    </div>
                    {record.selectedOptions.map((option) => (
                      <div key={`${record.id}:${option.categoryLabel}:${option.label}`}>
                        <dt className="inline text-gray-500">{option.categoryLabel}: </dt>
                        <dd className="inline text-gray-950">{option.label}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Descriptions</h3>
                  <ul className="mt-2 space-y-2 text-sm text-gray-700">
                    {record.generatedDescriptions.length === 0 ? (
                      <li>Not recorded</li>
                    ) : record.generatedDescriptions.map((description) => (
                      <li key={`${record.id}:${description.documentKind}`}>
                        <span className="font-medium uppercase">{description.documentKind}</span>: {description.description ?? 'Not recorded'}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Downloads</h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {record.downloads.length === 0 ? (
                      <li className="text-gray-500">No retained PDF objects.</li>
                    ) : record.downloads.map((download) => (
                      <li key={`${record.id}:${download.r2ObjectKey}`}>
                        {download.retained ? (
                          <Link
                            href={`/api/ps-generator/generated/${download.id}`}
                            className="font-medium text-gray-950 underline underline-offset-2"
                          >
                            Download {download.documentKind.toUpperCase()}
                          </Link>
                        ) : (
                          <span className="text-gray-500">{download.documentKind.toUpperCase()} expired</span>
                        )}
                        <span className="block text-xs text-gray-500">Retained until {download.retainedUntil.toLocaleDateString('en-NZ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

async function loadHistoryRecords(jobNumber: string | null): Promise<PsHistoryGenerationRecord[]> {
  const eventRows = await db
    .select()
    .from(psGenerationEvents)
    .where(jobNumber ? eq(psGenerationEvents.jobNumber, jobNumber) : undefined)
    .orderBy(desc(psGenerationEvents.createdAt))
    .limit(100)

  if (eventRows.length === 0) return []

  const eventIds = eventRows.map((event) => event.id)
  const pdfRows = await db
    .select()
    .from(psGeneratedPdfObjects)
    .where(inArray(psGeneratedPdfObjects.generationEventId, eventIds))

  return eventRows.map((event) => ({
    id: event.id,
    actorLabel: event.actorLabel,
    generationMode: event.generationMode,
    jobNumber: event.jobNumber,
    clientName: event.clientName,
    jobAddress: event.jobAddress,
    bcNumber: event.bcNumber,
    lotDescription: event.lotDescription,
    selectionsSnapshot: event.selectionsSnapshot,
    descriptionSnapshot: event.descriptionSnapshot,
    createdAt: event.createdAt,
    pdfObjects: pdfRows
      .filter((object) => object.generationEventId === event.id)
      .map((object) => ({
        id: object.id,
        documentKind: object.documentKind,
        filename: object.filename,
        r2ObjectKey: object.r2ObjectKey,
        retainedUntil: object.retainedUntil,
        deletedAt: object.deletedAt,
      })),
  }))
}

function parseString(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  return raw?.trim() ? raw.trim().toUpperCase() : null
}

function formatMode(mode: PsHistoryGenerationRecord['generationMode']) {
  if (mode === 'both') return 'PS1 + PS3'
  return mode === 'ps1_only' ? 'PS1 only' : 'PS3 only'
}
