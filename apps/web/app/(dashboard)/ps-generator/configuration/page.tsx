import { and, asc, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { requireModule } from '@/lib/guard'
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
import { PsConfigurationOptionsEditor } from './PsConfigurationOptionsEditor'

const visibleOptionCategorySlugs = new Set([
  'system',
  'structure_material',
  'structure_type',
  'location',
  'structure_built',
  'glass_type',
  'thickness',
  'gate_required',
])

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

  const visibleCategories = categories.filter((category) => visibleOptionCategorySlugs.has(category.slug))

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">PS Configuration</h1>
        <p className="mt-1 text-sm text-gray-500">Edit draft option names and visibility, then publish when ready.</p>
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
            <PsConfigurationOptionsEditor
              categories={visibleCategories.map((category) => ({
                ...category,
                values: values.filter((value) => value.categoryId === category.id && !value.archivedAt),
              }))}
              isDraft={isDraft}
            />
            <div className="rounded border border-gray-200 bg-white p-4">
              <h2 className="text-base font-semibold text-gray-950">Add option value</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr]">
                <label className="text-sm font-medium text-gray-700">
                  Category
                  <select name="newOptionCategoryId" disabled={!isDraft} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm">
                    <option value="">Choose</option>
                    {visibleCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Name
                  <input name="newOptionLabel" disabled={!isDraft} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                </label>
              </div>
            </div>
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
