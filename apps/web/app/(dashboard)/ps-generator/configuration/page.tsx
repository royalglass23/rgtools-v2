import { and, asc, desc, eq, isNull } from 'drizzle-orm'

import { requireModule } from '@/lib/guard'
import { db } from '@/lib/db'
import {
  psConfigVersions,
  psOptionCategories,
  psOptionValues,
} from '@rgtools/db/schema-ps-generator'
import {
  createPsConfigurationDraftAction,
  publishPsConfigurationDraftAction,
  updatePsConfigurationOptionsAction,
} from './actions'

export default async function PsConfigurationPage() {
  await requireModule('ps-generator/configuration')

  const [draftVersion] = await db
    .select({
      id: psConfigVersions.id,
      versionLabel: psConfigVersions.versionLabel,
      state: psConfigVersions.state,
      publishedAt: psConfigVersions.publishedAt,
    })
    .from(psConfigVersions)
    .where(and(eq(psConfigVersions.state, 'draft'), isNull(psConfigVersions.archivedAt)))
    .orderBy(desc(psConfigVersions.createdAt))
    .limit(1)

  const [publishedVersion] = await db
    .select({
      id: psConfigVersions.id,
      versionLabel: psConfigVersions.versionLabel,
      state: psConfigVersions.state,
      publishedAt: psConfigVersions.publishedAt,
    })
    .from(psConfigVersions)
    .where(and(eq(psConfigVersions.state, 'published'), isNull(psConfigVersions.archivedAt)))
    .orderBy(desc(psConfigVersions.publishedAt), desc(psConfigVersions.createdAt))
    .limit(1)

  const version = draftVersion ?? publishedVersion
  const isDraft = version?.state === 'draft'

  const categories = version ? await db
    .select({
      id: psOptionCategories.id,
      slug: psOptionCategories.slug,
      label: psOptionCategories.label,
      sortOrder: psOptionCategories.sortOrder,
    })
    .from(psOptionCategories)
    .where(eq(psOptionCategories.isActive, true))
    .orderBy(asc(psOptionCategories.sortOrder), asc(psOptionCategories.slug))
    : []

  const values = version ? await db
    .select({
      id: psOptionValues.id,
      categoryId: psOptionValues.categoryId,
      slug: psOptionValues.slug,
      label: psOptionValues.label,
      sortOrder: psOptionValues.sortOrder,
      isActive: psOptionValues.isActive,
      archivedAt: psOptionValues.archivedAt,
    })
    .from(psOptionValues)
    .where(eq(psOptionValues.configVersionId, version.id))
    .orderBy(asc(psOptionValues.sortOrder), asc(psOptionValues.slug))
    : []

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">PS Configuration</h1>
        <p className="mt-1 text-sm text-gray-500">Edit draft option labels and visibility, then publish when ready.</p>
      </div>

      {!publishedVersion && !draftVersion ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No published PS Generator configuration is available. Run the PS Generator seed before editing configuration.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
            <div>
              Active editor: <span className="font-medium text-gray-950">{version?.versionLabel}</span>
              <span className="ml-2 rounded border border-gray-200 px-2 py-0.5 text-xs uppercase text-gray-500">{isDraft ? 'Draft' : 'Published'}</span>
              {publishedVersion ? (
                <span className="mt-1 block text-xs text-gray-500">
                  Generate PS uses {publishedVersion.versionLabel} until a draft is published.
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {!isDraft ? (
                <form action={createPsConfigurationDraftAction}>
                  <button type="submit" className="rounded bg-gray-950 px-3 py-2 text-sm font-semibold text-white">
                    Create draft
                  </button>
                </form>
              ) : (
                <form action={publishPsConfigurationDraftAction}>
                  <input type="hidden" name="configVersionId" value={version.id} />
                  <button type="submit" className="rounded bg-gray-950 px-3 py-2 text-sm font-semibold text-white">
                    Publish draft
                  </button>
                </form>
              )}
            </div>
          </div>

          <form action={updatePsConfigurationOptionsAction} className="space-y-4">
            <input type="hidden" name="configVersionId" value={version.id} />
            {categories.map((category) => {
              const categoryValues = values.filter((value) => value.categoryId === category.id && !value.archivedAt)
              if (categoryValues.length === 0) return null

              return (
                <details key={category.id} className="rounded border border-gray-200 bg-white shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border-b border-gray-100 px-4 py-3">
                    <span>
                      <span className="block text-base font-semibold text-gray-950">{category.label}</span>
                      <span className="mt-1 block text-xs text-gray-500">{category.slug} - {categoryValues.length} options</span>
                    </span>
                    <span className="text-sm font-medium text-gray-600">Expand</span>
                  </summary>
                  <div className="divide-y divide-gray-100">
                    {categoryValues.map((value) => (
                      <div key={value.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(140px,1fr)_minmax(220px,2fr)_auto] md:items-center">
                        <input type="hidden" name="optionValueId" value={value.id} />
                        <div className="text-sm font-medium text-gray-700">{value.slug}</div>
                        <label className="text-sm font-medium text-gray-700">
                          <span className="sr-only">Label for {value.slug}</span>
                          <input
                            name={`label:${value.id}`}
                            defaultValue={value.label}
                            disabled={!isDraft}
                            className="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            name={`isActive:${value.id}`}
                            defaultChecked={value.isActive}
                            disabled={!isDraft}
                            className="h-4 w-4"
                          />
                          Active
                        </label>
                      </div>
                    ))}
                  </div>
                </details>
              )
            })}
            <div className="sticky bottom-0 flex justify-end border-t border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
              <button
                type="submit"
                disabled={!isDraft}
                className="rounded bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                Save draft
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
