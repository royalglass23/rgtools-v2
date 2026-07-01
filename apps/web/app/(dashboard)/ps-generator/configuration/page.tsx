import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'

import { requireModule } from '@/lib/guard'
import { db } from '@/lib/db'
import {
  psConfigVersions,
  psDescriptionTemplates,
  psFieldMappings,
  psOptionCategories,
  psOptionValues,
  psSystemOptionRules,
  psSystems,
  psTemplateVariants,
} from '@rgtools/db/schema-ps-generator'
import {
  createPsConfigurationDraftAction,
  publishPsConfigurationDraftAction,
  runPsConfigurationTestGenerationAction,
  updatePsConfigurationDescriptionTemplatesAction,
  updatePsConfigurationFieldMappingsAction,
  updatePsConfigurationOptionsAction,
  updatePsConfigurationRulesAction,
  updatePsConfigurationSystemsAction,
  uploadPsConfigurationTemplateAction,
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

  const systems = version ? await db
    .select({
      id: psSystems.id,
      slug: psSystems.slug,
      displayName: psSystems.displayName,
      sortOrder: psSystems.sortOrder,
      archivedAt: psSystems.archivedAt,
    })
    .from(psSystems)
    .where(eq(psSystems.configVersionId, version.id))
    .orderBy(asc(psSystems.sortOrder), asc(psSystems.slug))
    : []

  const systemRules = systems.length > 0 ? await db
    .select({
      id: psSystemOptionRules.id,
      systemId: psSystemOptionRules.systemId,
      optionValueId: psSystemOptionRules.optionValueId,
      isAllowed: psSystemOptionRules.isAllowed,
    })
    .from(psSystemOptionRules)
    .where(inArray(psSystemOptionRules.systemId, systems.map((system) => system.id)))
    : []

  const templates = version ? await db
    .select({
      id: psTemplateVariants.id,
      systemId: psTemplateVariants.systemId,
      documentKind: psTemplateVariants.documentKind,
      variantKind: psTemplateVariants.variantKind,
      label: psTemplateVariants.label,
      r2ObjectKey: psTemplateVariants.r2ObjectKey,
      originalFilename: psTemplateVariants.originalFilename,
      fieldDiscovery: psTemplateVariants.fieldDiscovery,
      archivedAt: psTemplateVariants.archivedAt,
    })
    .from(psTemplateVariants)
    .where(eq(psTemplateVariants.configVersionId, version.id))
    .orderBy(asc(psTemplateVariants.documentKind), asc(psTemplateVariants.variantKind), asc(psTemplateVariants.label))
    : []

  const fieldMappings = templates.length > 0 ? await db
    .select({
      id: psFieldMappings.id,
      templateVariantId: psFieldMappings.templateVariantId,
      fieldName: psFieldMappings.fieldName,
      fieldType: psFieldMappings.fieldType,
      sourceType: psFieldMappings.sourceType,
      sourceKey: psFieldMappings.sourceKey,
      fixedValue: psFieldMappings.fixedValue,
      checkboxValue: psFieldMappings.checkboxValue,
      sortOrder: psFieldMappings.sortOrder,
      archivedAt: psFieldMappings.archivedAt,
    })
    .from(psFieldMappings)
    .where(inArray(psFieldMappings.templateVariantId, templates.map((template) => template.id)))
    .orderBy(asc(psFieldMappings.sortOrder), asc(psFieldMappings.fieldName))
    : []

  const descriptionTemplates = version ? await db
    .select({
      id: psDescriptionTemplates.id,
      slug: psDescriptionTemplates.slug,
      label: psDescriptionTemplates.label,
      pattern: psDescriptionTemplates.pattern,
      archivedAt: psDescriptionTemplates.archivedAt,
    })
    .from(psDescriptionTemplates)
    .where(eq(psDescriptionTemplates.configVersionId, version.id))
    .orderBy(asc(psDescriptionTemplates.slug))
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
                        <label className="text-sm font-medium text-gray-700">
                          <span className="sr-only">Sort order for {value.slug}</span>
                          <input
                            name={`sortOrder:${value.id}`}
                            type="number"
                            defaultValue={value.sortOrder}
                            disabled={!isDraft}
                            className="block w-24 rounded border border-gray-300 px-3 py-2 text-sm"
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
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            name={`archive:${value.id}`}
                            disabled={!isDraft}
                            className="h-4 w-4"
                          />
                          Archive
                        </label>
                      </div>
                    ))}
                  </div>
                </details>
              )
            })}
            <div className="rounded border border-gray-200 bg-white p-4">
              <h2 className="text-base font-semibold text-gray-950">Add option value</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_1fr_120px]">
                <label className="text-sm font-medium text-gray-700">
                  Category
                  <select name="newOptionCategoryId" disabled={!isDraft} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm">
                    <option value="">Choose</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Slug
                  <input name="newOptionSlug" disabled={!isDraft} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Label
                  <input name="newOptionLabel" disabled={!isDraft} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Order
                  <input name="newOptionSortOrder" type="number" disabled={!isDraft} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
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

          <form action={updatePsConfigurationSystemsAction} className="rounded border border-gray-200 bg-white p-4">
            <input type="hidden" name="configVersionId" value={version.id} />
            <h2 className="text-base font-semibold text-gray-950">Systems</h2>
            <div className="mt-3 divide-y divide-gray-100">
              {systems.map((system) => (
                <div key={system.id} className="grid gap-3 py-3 md:grid-cols-[1fr_2fr_120px_auto] md:items-center">
                  <input type="hidden" name="systemId" value={system.id} />
                  <span className="text-sm font-medium text-gray-700">{system.slug}</span>
                  <input name={`displayName:${system.id}`} defaultValue={system.displayName} disabled={!isDraft} className="rounded border border-gray-300 px-3 py-2 text-sm" />
                  <input name={`systemSortOrder:${system.id}`} type="number" defaultValue={system.sortOrder} disabled={!isDraft} className="rounded border border-gray-300 px-3 py-2 text-sm" />
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" name={`archiveSystem:${system.id}`} disabled={!isDraft} className="h-4 w-4" />
                    Archive
                  </label>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 md:grid-cols-[1fr_2fr_120px]">
              <label className="text-sm font-medium text-gray-700">
                New slug
                <input name="newSystemSlug" disabled={!isDraft} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-gray-700">
                New display name
                <input name="newSystemDisplayName" disabled={!isDraft} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Order
                <input name="newSystemSortOrder" type="number" disabled={!isDraft} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button type="submit" disabled={!isDraft} className="rounded bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300">
                Save systems
              </button>
            </div>
          </form>

          {systems.map((system) => (
            <form key={`rules:${system.id}`} action={updatePsConfigurationRulesAction} className="rounded border border-gray-200 bg-white p-4">
              <input type="hidden" name="configVersionId" value={version.id} />
              <input type="hidden" name="rulesSystemId" value={system.id} />
              <h2 className="text-base font-semibold text-gray-950">Rules for {system.displayName}</h2>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {categories.map((category) => {
                  const categoryValues = values.filter((value) => value.categoryId === category.id && !value.archivedAt)
                  if (categoryValues.length === 0) return null
                  return (
                    <fieldset key={`${system.id}:${category.id}`} className="rounded border border-gray-200 p-3">
                      <legend className="px-1 text-sm font-semibold text-gray-800">{category.label}</legend>
                      <div className="mt-2 space-y-2">
                        {categoryValues.map((value) => {
                          const rule = systemRules.find((candidate) => candidate.systemId === system.id && candidate.optionValueId === value.id)
                          return (
                            <label key={`${system.id}:${value.id}`} className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                name={`allow:${system.id}:${value.id}`}
                                defaultChecked={rule?.isAllowed ?? false}
                                disabled={!isDraft}
                                className="h-4 w-4"
                              />
                              {value.label}
                            </label>
                          )
                        })}
                      </div>
                    </fieldset>
                  )
                })}
              </div>
              <div className="mt-4 flex justify-end">
                <button type="submit" disabled={!isDraft} className="rounded bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300">
                  Save rules
                </button>
              </div>
            </form>
          ))}

          <form action={updatePsConfigurationDescriptionTemplatesAction} className="rounded border border-gray-200 bg-white p-4">
            <input type="hidden" name="configVersionId" value={version.id} />
            <h2 className="text-base font-semibold text-gray-950">Description templates</h2>
            <div className="mt-3 space-y-4">
              {descriptionTemplates.map((template) => (
                <div key={template.id} className="rounded border border-gray-200 p-3">
                  <input type="hidden" name="descriptionTemplateId" value={template.id} />
                  <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-start">
                    <label className="text-sm font-medium text-gray-700">
                      Label
                      <input name={`descriptionLabel:${template.id}`} defaultValue={template.label} disabled={!isDraft} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm font-medium text-gray-700">
                      Pattern
                      <textarea name={`descriptionPattern:${template.id}`} defaultValue={template.pattern} disabled={!isDraft} rows={3} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="mt-7 flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" name={`archiveDescription:${template.id}`} disabled={!isDraft} className="h-4 w-4" />
                      Archive
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 md:grid-cols-[1fr_1fr_2fr]">
              <label className="text-sm font-medium text-gray-700">
                New slug
                <input name="newDescriptionSlug" disabled={!isDraft} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-gray-700">
                New label
                <input name="newDescriptionLabel" disabled={!isDraft} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-gray-700">
                New pattern
                <textarea name="newDescriptionPattern" disabled={!isDraft} rows={3} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button type="submit" disabled={!isDraft} className="rounded bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300">
                Save descriptions
              </button>
            </div>
          </form>

          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-950">Template variants and field mappings</h2>
            <form action={runPsConfigurationTestGenerationAction} className="rounded border border-gray-200 bg-white p-4">
              <input type="hidden" name="configVersionId" value={version.id} />
              <h3 className="text-sm font-semibold text-gray-950">Draft test generation</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="text-sm font-medium text-gray-700">
                  Mode
                  <select name="generationMode" disabled={!isDraft} defaultValue="ps3_only" className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm">
                    <option value="ps1_only">PS1 only</option>
                    <option value="ps3_only">PS3 only</option>
                    <option value="both">Both</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Client
                  <input name="clientName" defaultValue="Mapping Test Client" disabled={!isDraft} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Job address
                  <input name="jobAddress" defaultValue="1 Test Generation Way" disabled={!isDraft} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Job number
                  <input name="jobNumber" defaultValue="TEST-PS" disabled={!isDraft} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  BC number
                  <input name="bcNumber" defaultValue="BC-TEST" disabled={!isDraft} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Lot
                  <input name="lotDescription" defaultValue="Lot 1 DP Test" disabled={!isDraft} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="text-sm font-medium text-gray-700">
                  System
                  <select name="selection:system" disabled={!isDraft} defaultValue={systems.find((system) => !system.archivedAt)?.slug ?? ''} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm">
                    {systems.filter((system) => !system.archivedAt).map((system) => (
                      <option key={system.id} value={system.slug}>{system.displayName}</option>
                    ))}
                  </select>
                </label>
                {categories.filter((category) => category.slug !== 'system').map((category) => {
                  const categoryValues = values.filter((value) => value.categoryId === category.id && !value.archivedAt && value.isActive)
                  if (categoryValues.length === 0) return null
                  return (
                    <label key={`test:${category.id}`} className="text-sm font-medium text-gray-700">
                      {category.label}
                      <select name={`selection:${category.slug}`} disabled={!isDraft} defaultValue={categoryValues[0]?.slug ?? ''} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm">
                        {categoryValues.map((value) => (
                          <option key={value.id} value={value.slug}>{value.label}</option>
                        ))}
                      </select>
                    </label>
                  )
                })}
              </div>
              <div className="mt-4 flex justify-end">
                <button type="submit" disabled={!isDraft} className="rounded bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300">
                  Run test generation
                </button>
              </div>
            </form>
            {templates.map((template) => {
              const mappingRows = fieldMappings.filter((mapping) => mapping.templateVariantId === template.id && !mapping.archivedAt)
              const discovered = readDiscoveredFields(template.fieldDiscovery)
              return (
                <section key={template.id} className="rounded border border-gray-200 bg-white p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-950">{template.label}</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {template.documentKind.toUpperCase()} - {template.variantKind} - {template.originalFilename ?? template.r2ObjectKey}
                      </p>
                      {discovered.length > 0 ? (
                        <p className="mt-1 text-xs text-gray-500">Discovered fields: {discovered.join(', ')}</p>
                      ) : null}
                    </div>
                    <form action={uploadPsConfigurationTemplateAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input type="hidden" name="configVersionId" value={version.id} />
                      <input type="hidden" name="templateVariantId" value={template.id} />
                      <input type="file" name="templatePdf" accept="application/pdf" disabled={!isDraft} className="text-sm" />
                      <button type="submit" disabled={!isDraft} className="rounded bg-gray-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300">
                        Upload
                      </button>
                    </form>
                  </div>

                  <form action={updatePsConfigurationFieldMappingsAction} className="mt-4 space-y-3">
                    <input type="hidden" name="configVersionId" value={version.id} />
                    <input type="hidden" name="mappingTemplateVariantId" value={template.id} />
                    {mappingRows.map((mapping) => (
                      <div key={mapping.id} className="grid gap-2 rounded border border-gray-100 p-3 md:grid-cols-[1fr_120px_160px_1fr_1fr_90px_auto] md:items-center">
                        <input type="hidden" name="fieldMappingId" value={mapping.id} />
                        <input name={`fieldName:${mapping.id}`} defaultValue={mapping.fieldName} disabled={!isDraft} className="rounded border border-gray-300 px-2 py-2 text-sm" />
                        <select name={`fieldType:${mapping.id}`} defaultValue={mapping.fieldType} disabled={!isDraft} className="rounded border border-gray-300 px-2 py-2 text-sm">
                          <option value="text">Text</option>
                          <option value="checkbox">Checkbox</option>
                        </select>
                        <select name={`sourceType:${mapping.id}`} defaultValue={mapping.sourceType} disabled={!isDraft} className="rounded border border-gray-300 px-2 py-2 text-sm">
                          {sourceTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <input name={`sourceKey:${mapping.id}`} defaultValue={mapping.sourceKey ?? ''} disabled={!isDraft} className="rounded border border-gray-300 px-2 py-2 text-sm" />
                        <input name={`fixedValue:${mapping.id}`} defaultValue={mapping.fixedValue ?? ''} disabled={!isDraft} className="rounded border border-gray-300 px-2 py-2 text-sm" />
                        <input name={`mappingSortOrder:${mapping.id}`} type="number" defaultValue={mapping.sortOrder} disabled={!isDraft} className="rounded border border-gray-300 px-2 py-2 text-sm" />
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" name={`archiveMapping:${mapping.id}`} disabled={!isDraft} className="h-4 w-4" />
                          Archive
                        </label>
                      </div>
                    ))}
                    <div className="grid gap-2 rounded border border-gray-100 p-3 md:grid-cols-[1fr_120px_160px_1fr_1fr_90px]">
                      <input name="newFieldName" placeholder="New field" disabled={!isDraft} className="rounded border border-gray-300 px-2 py-2 text-sm" />
                      <select name="newFieldType" disabled={!isDraft} className="rounded border border-gray-300 px-2 py-2 text-sm">
                        <option value="text">Text</option>
                        <option value="checkbox">Checkbox</option>
                      </select>
                      <select name="newSourceType" disabled={!isDraft} className="rounded border border-gray-300 px-2 py-2 text-sm">
                        {sourceTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <input name="newSourceKey" placeholder="Source key" disabled={!isDraft} className="rounded border border-gray-300 px-2 py-2 text-sm" />
                      <input name="newFixedValue" placeholder="Fixed value" disabled={!isDraft} className="rounded border border-gray-300 px-2 py-2 text-sm" />
                      <input name="newMappingSortOrder" type="number" placeholder="Order" disabled={!isDraft} className="rounded border border-gray-300 px-2 py-2 text-sm" />
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" disabled={!isDraft} className="rounded bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300">
                        Save mappings
                      </button>
                    </div>
                  </form>
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

const sourceTypeOptions = [
  { value: 'project_value', label: 'Project' },
  { value: 'selected_option', label: 'Option' },
  { value: 'system_rule', label: 'System rule' },
  { value: 'description_template', label: 'Description' },
  { value: 'date', label: 'Date' },
  { value: 'fixed_value', label: 'Fixed' },
]

function readDiscoveredFields(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  const record = value as Record<string, unknown>
  const text = Array.isArray(record.text) ? record.text.filter((field): field is string => typeof field === 'string') : []
  const checkbox = Array.isArray(record.checkbox) ? record.checkbox.filter((field): field is string => typeof field === 'string') : []
  return [...text, ...checkbox].sort((a, b) => a.localeCompare(b))
}
