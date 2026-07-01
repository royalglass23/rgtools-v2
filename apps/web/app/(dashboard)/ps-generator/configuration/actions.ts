'use server'

import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { userCanAccessSlug } from '@/lib/access-db'
import { db } from '@/lib/db'
import { getStorage } from '@/lib/storage'
import {
  buildConfigurationReadModel,
  type PsConfigurationRows,
} from '@/modules/ps-generator/configuration'
import { generateProducerStatementPackage, type PsGenerationMode } from '@/modules/ps-generator/generation'
import { discoverPdfFields } from '@/modules/ps-generator/template-fields'
import {
  psConfigurationAuditEntries,
  psConfigVersions,
  psDescriptionTemplates,
  psFieldMappings,
  psOptionCategories,
  psOptionValues,
  psSystemOptionRules,
  psSystems,
  psTemplateVariants,
} from '@rgtools/db/schema-ps-generator'

const fieldTypes = new Set(['text', 'checkbox'])
const sourceTypes = new Set(['project_value', 'selected_option', 'system_rule', 'description_template', 'date', 'fixed_value'])
const generationModes = new Set(['ps1_only', 'ps3_only', 'both'])

export async function createPsConfigurationDraftAction(): Promise<void> {
  const actorId = await requireConfigEditor()
  const now = new Date()

  await db.transaction(async (tx) => {
    const [published] = await tx
      .select()
      .from(psConfigVersions)
      .where(and(eq(psConfigVersions.state, 'published'), isNull(psConfigVersions.archivedAt)))
      .orderBy(desc(psConfigVersions.publishedAt), desc(psConfigVersions.createdAt))
      .limit(1)
    if (!published) throw new Error('A published PS configuration is required before creating a draft.')

    const [existingDraft] = await tx
      .select({ id: psConfigVersions.id })
      .from(psConfigVersions)
      .where(and(eq(psConfigVersions.state, 'draft'), isNull(psConfigVersions.archivedAt)))
      .limit(1)
    if (existingDraft) return

    const [draft] = await tx
      .insert(psConfigVersions)
      .values({
        versionLabel: `${published.versionLabel}-draft-${now.toISOString().slice(0, 10)}`,
        state: 'draft',
        createdBy: actorId,
        createdAt: now,
      })
      .returning({ id: psConfigVersions.id, versionLabel: psConfigVersions.versionLabel })

    const systems = await tx.select().from(psSystems).where(eq(psSystems.configVersionId, published.id))
    const insertedSystems = systems.length > 0
      ? await tx.insert(psSystems).values(systems.map((system) => ({
        configVersionId: draft.id,
        slug: system.slug,
        displayName: system.displayName,
        state: 'draft' as const,
        sortOrder: system.sortOrder,
        heightRules: system.heightRules,
        metadata: system.metadata,
        createdAt: now,
        updatedAt: now,
        archivedAt: system.archivedAt,
      }))).returning({ id: psSystems.id, slug: psSystems.slug })
      : []
    const systemIdByOldId = new Map(systems.map((system) => [
      system.id,
      insertedSystems.find((inserted) => inserted.slug === system.slug)?.id,
    ]))

    const optionValues = await tx.select().from(psOptionValues).where(eq(psOptionValues.configVersionId, published.id))
    const insertedOptions = optionValues.length > 0
      ? await tx.insert(psOptionValues).values(optionValues.map((value) => ({
        configVersionId: draft.id,
        categoryId: value.categoryId,
        slug: value.slug,
        label: value.label,
        sortOrder: value.sortOrder,
        isActive: value.isActive,
        createdAt: now,
        updatedAt: now,
        archivedAt: value.archivedAt,
      }))).returning({ id: psOptionValues.id, categoryId: psOptionValues.categoryId, slug: psOptionValues.slug })
      : []
    const optionIdByOldId = new Map(optionValues.map((value) => [
      value.id,
      insertedOptions.find((inserted) => inserted.categoryId === value.categoryId && inserted.slug === value.slug)?.id,
    ]))

    const rules = await tx.select().from(psSystemOptionRules)
    const draftRules = rules
      .map((rule) => ({
        systemId: systemIdByOldId.get(rule.systemId),
        optionValueId: optionIdByOldId.get(rule.optionValueId),
        isAllowed: rule.isAllowed,
        createdAt: now,
        updatedAt: now,
      }))
      .filter((rule): rule is { systemId: string; optionValueId: string; isAllowed: boolean; createdAt: Date; updatedAt: Date } => Boolean(rule.systemId && rule.optionValueId))
    if (draftRules.length > 0) await tx.insert(psSystemOptionRules).values(draftRules)

    const templates = await tx.select().from(psTemplateVariants).where(eq(psTemplateVariants.configVersionId, published.id))
    const insertedTemplates = templates.length > 0
      ? await tx.insert(psTemplateVariants).values(templates.map((template) => ({
        systemId: template.systemId ? systemIdByOldId.get(template.systemId) ?? null : null,
        configVersionId: draft.id,
        documentKind: template.documentKind,
        variantKind: template.variantKind,
        label: template.label,
        r2ObjectKey: template.r2ObjectKey,
        originalFilename: template.originalFilename,
        fieldDiscovery: template.fieldDiscovery,
        state: 'draft' as const,
        createdAt: now,
        updatedAt: now,
        archivedAt: template.archivedAt,
      }))).returning({ id: psTemplateVariants.id })
      : []
    const templateIdByOldId = new Map(templates.map((template, index) => [template.id, insertedTemplates[index]?.id]))

    const fieldMappings = await tx.select().from(psFieldMappings)
    const draftMappings = fieldMappings
      .map((mapping) => ({
        templateVariantId: templateIdByOldId.get(mapping.templateVariantId),
        fieldName: mapping.fieldName,
        fieldType: mapping.fieldType,
        sourceType: mapping.sourceType,
        sourceKey: mapping.sourceKey,
        fixedValue: mapping.fixedValue,
        checkboxValue: mapping.checkboxValue,
        sortOrder: mapping.sortOrder,
        createdAt: now,
        updatedAt: now,
        archivedAt: mapping.archivedAt,
      }))
      .filter((mapping): mapping is {
        templateVariantId: string
        fieldName: string
        fieldType: 'text' | 'checkbox'
        sourceType: 'project_value' | 'selected_option' | 'system_rule' | 'description_template' | 'date' | 'fixed_value'
        sourceKey: string | null
        fixedValue: string | null
        checkboxValue: boolean | null
        sortOrder: number
        createdAt: Date
        updatedAt: Date
        archivedAt: Date | null
      } => Boolean(mapping.templateVariantId))
    if (draftMappings.length > 0) await tx.insert(psFieldMappings).values(draftMappings)

    const descriptions = await tx.select().from(psDescriptionTemplates).where(eq(psDescriptionTemplates.configVersionId, published.id))
    if (descriptions.length > 0) {
      await tx.insert(psDescriptionTemplates).values(descriptions.map((template) => ({
        configVersionId: draft.id,
        slug: template.slug,
        label: template.label,
        pattern: template.pattern,
        state: 'draft' as const,
        createdAt: now,
        updatedAt: now,
        archivedAt: template.archivedAt,
      })))
    }

    await tx.insert(psConfigurationAuditEntries).values({
      actorId,
      entityType: 'config_version',
      entityId: draft.id,
      action: 'draft_saved',
      configVersionId: draft.id,
      before: null,
      after: { state: 'draft', versionLabel: draft.versionLabel },
      createdAt: now,
    })
  })

  revalidateConfigurationPaths()
}

export async function updatePsConfigurationOptionsAction(formData: FormData): Promise<void> {
  const actorId = await requireConfigEditor()
  const configVersionId = String(formData.get('configVersionId') ?? '')
  const optionValueIds = formData.getAll('optionValueId').map((value) => String(value)).filter(Boolean)

  if (!configVersionId || optionValueIds.length === 0) throw new Error('Missing option values.')

  const [version] = await db
    .select({ id: psConfigVersions.id, state: psConfigVersions.state })
    .from(psConfigVersions)
    .where(eq(psConfigVersions.id, configVersionId))
    .limit(1)
  if (version?.state !== 'draft') throw new Error('Only draft PS configuration can be edited here.')

  await db.transaction(async (tx) => {
    const now = new Date()
    for (const optionValueId of optionValueIds) {
      const label = String(formData.get(`label:${optionValueId}`) ?? '').trim()
      const isActive = formData.get(`isActive:${optionValueId}`) === 'on'

      if (!label) throw new Error('Option label is required.')

      const [before] = await tx
        .select()
        .from(psOptionValues)
        .where(and(
          eq(psOptionValues.id, optionValueId),
          eq(psOptionValues.configVersionId, configVersionId),
        ))
        .limit(1)
      if (!before) throw new Error('Option value was not found.')

      const sortOrder = parseInteger(formData.get(`sortOrder:${optionValueId}`), before.sortOrder)
      const archivedAt = isActive ? before.archivedAt : now

      if (before.label === label && before.isActive === isActive && before.sortOrder === sortOrder && before.archivedAt === archivedAt) continue

      await tx
        .update(psOptionValues)
        .set({
          label,
          isActive,
          sortOrder,
          archivedAt,
          updatedAt: now,
        })
        .where(eq(psOptionValues.id, optionValueId))

      await tx.insert(psConfigurationAuditEntries).values({
        actorId,
        entityType: 'option_value',
        entityId: optionValueId,
        action: archivedAt !== before.archivedAt ? 'archived' : 'draft_saved',
        configVersionId,
        before,
        after: {
          ...before,
          label,
          isActive,
          sortOrder,
          archivedAt,
        },
      })
    }

    const newCategoryId = String(formData.get('newOptionCategoryId') ?? '')
    const newLabel = String(formData.get('newOptionLabel') ?? '').trim()
    const newSlug = slugify(newLabel)
    if (newCategoryId && newSlug && newLabel) {
      const [category] = await tx
        .select({ id: psOptionCategories.id })
        .from(psOptionCategories)
        .where(and(eq(psOptionCategories.id, newCategoryId), eq(psOptionCategories.isActive, true)))
        .limit(1)
      if (!category) throw new Error('Option category is not available in this draft.')

      const [inserted] = await tx.insert(psOptionValues).values({
        configVersionId,
        categoryId: newCategoryId,
        slug: newSlug,
        label: newLabel,
        sortOrder: parseInteger(formData.get('newOptionSortOrder'), optionValueIds.length + 1),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }).returning({ id: psOptionValues.id })

      await tx.insert(psConfigurationAuditEntries).values({
        actorId,
        entityType: 'option_value',
        entityId: inserted.id,
        action: 'draft_saved',
        configVersionId,
        before: null,
        after: { categoryId: newCategoryId, slug: newSlug, label: newLabel },
        createdAt: now,
      })
    }
  })

  revalidateConfigurationPaths()
}

export async function updatePsConfigurationSystemsAction(formData: FormData): Promise<void> {
  const actorId = await requireConfigEditor()
  const configVersionId = await requireDraftVersion(String(formData.get('configVersionId') ?? ''))
  const systemIds = formData.getAll('systemId').map((value) => String(value)).filter(Boolean)

  await db.transaction(async (tx) => {
    const now = new Date()
    const systems = systemIds.length > 0
      ? await tx
        .select()
        .from(psSystems)
        .where(and(eq(psSystems.configVersionId, configVersionId), inArray(psSystems.id, systemIds)))
      : []

    for (const before of systems) {
      const displayName = String(formData.get(`displayName:${before.id}`) ?? '').trim()
      if (!displayName) throw new Error('System display name is required.')
      const after = {
        displayName,
        sortOrder: parseInteger(formData.get(`systemSortOrder:${before.id}`), before.sortOrder),
        archivedAt: formData.get(`archiveSystem:${before.id}`) === 'on' ? now : before.archivedAt,
        updatedAt: now,
      }
      if (before.displayName === after.displayName && before.sortOrder === after.sortOrder && before.archivedAt === after.archivedAt) continue

      await tx.update(psSystems).set(after).where(eq(psSystems.id, before.id))
      await tx.insert(psConfigurationAuditEntries).values({
        actorId,
        entityType: 'system',
        entityId: before.id,
        action: after.archivedAt !== before.archivedAt ? 'archived' : 'draft_saved',
        configVersionId,
        before,
        after: { ...before, ...after },
        createdAt: now,
      })
    }

    const newSystemSlug = slugify(formData.get('newSystemSlug'))
    const newSystemDisplayName = String(formData.get('newSystemDisplayName') ?? '').trim()
    if (newSystemSlug && newSystemDisplayName) {
      const [inserted] = await tx.insert(psSystems).values({
        configVersionId,
        slug: newSystemSlug,
        displayName: newSystemDisplayName,
        state: 'draft',
        sortOrder: parseInteger(formData.get('newSystemSortOrder'), systems.length + 1),
        heightRules: {},
        metadata: {},
        createdAt: now,
        updatedAt: now,
      }).returning({ id: psSystems.id })

      await tx.insert(psConfigurationAuditEntries).values({
        actorId,
        entityType: 'system',
        entityId: inserted.id,
        action: 'draft_saved',
        configVersionId,
        before: null,
        after: { slug: newSystemSlug, displayName: newSystemDisplayName },
        createdAt: now,
      })
    }
  })

  revalidateConfigurationPaths()
}

export async function updatePsConfigurationRulesAction(formData: FormData): Promise<void> {
  const actorId = await requireConfigEditor()
  const configVersionId = await requireDraftVersion(String(formData.get('configVersionId') ?? ''))
  const systemId = String(formData.get('rulesSystemId') ?? '')
  if (!systemId) throw new Error('Missing system.')

  await db.transaction(async (tx) => {
    const now = new Date()
    const [system] = await tx
      .select({ id: psSystems.id })
      .from(psSystems)
      .where(and(eq(psSystems.id, systemId), eq(psSystems.configVersionId, configVersionId)))
      .limit(1)
    if (!system) throw new Error('Draft system was not found.')

    const optionValues = await tx
      .select({ id: psOptionValues.id })
      .from(psOptionValues)
      .where(and(eq(psOptionValues.configVersionId, configVersionId), isNull(psOptionValues.archivedAt)))
    const existingRules = await tx.select().from(psSystemOptionRules).where(eq(psSystemOptionRules.systemId, systemId))

    for (const value of optionValues) {
      const isAllowed = formData.get(`allow:${systemId}:${value.id}`) === 'on'
      const before = existingRules.find((rule) => rule.optionValueId === value.id)
      if (before && before.isAllowed === isAllowed) continue

      if (before) {
        await tx.update(psSystemOptionRules).set({ isAllowed, updatedAt: now }).where(eq(psSystemOptionRules.id, before.id))
        await tx.insert(psConfigurationAuditEntries).values({
          actorId,
          entityType: 'system_option_rule',
          entityId: before.id,
          action: 'draft_saved',
          configVersionId,
          before,
          after: { ...before, isAllowed },
          createdAt: now,
        })
        continue
      }

      if (!isAllowed) continue

      const [inserted] = await tx.insert(psSystemOptionRules).values({
        systemId,
        optionValueId: value.id,
        isAllowed,
        createdAt: now,
        updatedAt: now,
      }).returning({ id: psSystemOptionRules.id })
      await tx.insert(psConfigurationAuditEntries).values({
        actorId,
        entityType: 'system_option_rule',
        entityId: inserted.id,
        action: 'draft_saved',
        configVersionId,
        before: null,
        after: { systemId, optionValueId: value.id, isAllowed },
        createdAt: now,
      })
    }
  })

  revalidateConfigurationPaths()
}

export async function updatePsConfigurationDescriptionTemplatesAction(formData: FormData): Promise<void> {
  const actorId = await requireConfigEditor()
  const configVersionId = await requireDraftVersion(String(formData.get('configVersionId') ?? ''))
  const templateIds = formData.getAll('descriptionTemplateId').map((value) => String(value)).filter(Boolean)

  await db.transaction(async (tx) => {
    const now = new Date()
    const templates = templateIds.length > 0
      ? await tx
        .select()
        .from(psDescriptionTemplates)
        .where(and(eq(psDescriptionTemplates.configVersionId, configVersionId), inArray(psDescriptionTemplates.id, templateIds)))
      : []

    for (const before of templates) {
      const label = String(formData.get(`descriptionLabel:${before.id}`) ?? '').trim()
      const pattern = String(formData.get(`descriptionPattern:${before.id}`) ?? '').trim()
      if (!label || !pattern) throw new Error('Description template label and pattern are required.')
      const archivedAt = formData.get(`archiveDescription:${before.id}`) === 'on' ? now : before.archivedAt
      if (before.label === label && before.pattern === pattern && before.archivedAt === archivedAt) continue

      await tx.update(psDescriptionTemplates).set({ label, pattern, archivedAt, updatedAt: now }).where(eq(psDescriptionTemplates.id, before.id))
      await tx.insert(psConfigurationAuditEntries).values({
        actorId,
        entityType: 'description_template',
        entityId: before.id,
        action: archivedAt !== before.archivedAt ? 'archived' : 'draft_saved',
        configVersionId,
        before,
        after: { ...before, label, pattern, archivedAt },
        createdAt: now,
      })
    }

    const newSlug = slugify(formData.get('newDescriptionSlug'))
    const newLabel = String(formData.get('newDescriptionLabel') ?? '').trim()
    const newPattern = String(formData.get('newDescriptionPattern') ?? '').trim()
    if (newSlug && newLabel && newPattern) {
      const [inserted] = await tx.insert(psDescriptionTemplates).values({
        configVersionId,
        slug: newSlug,
        label: newLabel,
        pattern: newPattern,
        state: 'draft',
        createdAt: now,
        updatedAt: now,
      }).returning({ id: psDescriptionTemplates.id })

      await tx.insert(psConfigurationAuditEntries).values({
        actorId,
        entityType: 'description_template',
        entityId: inserted.id,
        action: 'draft_saved',
        configVersionId,
        before: null,
        after: { slug: newSlug, label: newLabel, pattern: newPattern },
        createdAt: now,
      })
    }
  })

  revalidateConfigurationPaths()
}

export async function uploadPsConfigurationTemplateAction(formData: FormData): Promise<void> {
  const actorId = await requireConfigEditor()
  const configVersionId = await requireDraftVersion(String(formData.get('configVersionId') ?? ''))
  const templateVariantId = String(formData.get('templateVariantId') ?? '')
  const file = formData.get('templatePdf')
  if (!templateVariantId || !(file instanceof File) || file.size === 0) throw new Error('Choose a template PDF to upload.')
  if (file.type && file.type !== 'application/pdf') throw new Error('Template upload must be a PDF.')

  const [before] = await db
    .select()
    .from(psTemplateVariants)
    .where(and(
      eq(psTemplateVariants.id, templateVariantId),
      eq(psTemplateVariants.configVersionId, configVersionId),
      eq(psTemplateVariants.state, 'draft'),
    ))
    .limit(1)
  if (!before) throw new Error('Draft template variant was not found.')

  const bytes = Buffer.from(await file.arrayBuffer())
  const fieldDiscovery = await discoverPdfFields(bytes)
  const objectKey = `drafts/ps-generator/templates/${configVersionId}/${templateVariantId}/${sanitizeObjectPart(file.name)}`
  await getStorage().put(objectKey, bytes, 'application/pdf')

  await db.transaction(async (tx) => {
    const now = new Date()
    const after = {
      r2ObjectKey: objectKey,
      originalFilename: file.name,
      fieldDiscovery,
      updatedAt: now,
    }
    await tx.update(psTemplateVariants).set(after).where(eq(psTemplateVariants.id, templateVariantId))
    await tx.insert(psConfigurationAuditEntries).values({
      actorId,
      entityType: 'template_variant',
      entityId: templateVariantId,
      action: 'draft_saved',
      configVersionId,
      before,
      after: { ...before, ...after },
      createdAt: now,
    })
  })

  revalidateConfigurationPaths()
}

export async function updatePsConfigurationFieldMappingsAction(formData: FormData): Promise<void> {
  const actorId = await requireConfigEditor()
  const configVersionId = await requireDraftVersion(String(formData.get('configVersionId') ?? ''))
  const templateVariantId = String(formData.get('mappingTemplateVariantId') ?? '')
  if (!templateVariantId) throw new Error('Missing template variant.')

  await db.transaction(async (tx) => {
    const now = new Date()
    const [template] = await tx
      .select({ id: psTemplateVariants.id })
      .from(psTemplateVariants)
      .where(and(
        eq(psTemplateVariants.id, templateVariantId),
        eq(psTemplateVariants.configVersionId, configVersionId),
        eq(psTemplateVariants.state, 'draft'),
      ))
      .limit(1)
    if (!template) throw new Error('Draft template variant was not found.')

    const mappingIds = formData.getAll('fieldMappingId').map((value) => String(value)).filter(Boolean)
      if (mappingIds.length > 0) {
      const mappings = await tx.select().from(psFieldMappings).where(and(
        eq(psFieldMappings.templateVariantId, templateVariantId),
        inArray(psFieldMappings.id, mappingIds),
      ))
      for (const before of mappings) {
        const afterValues = readMappingValues(formData, before.id, before, now)
        if (!afterValues) continue
        await tx.update(psFieldMappings).set({ ...afterValues, updatedAt: now }).where(eq(psFieldMappings.id, before.id))
        await tx.insert(psConfigurationAuditEntries).values({
          actorId,
          entityType: 'field_mapping',
          entityId: before.id,
          action: afterValues.archivedAt ? 'archived' : 'draft_saved',
          configVersionId,
          before,
          after: { ...before, ...afterValues },
          createdAt: now,
        })
      }
    }

    const newFieldName = String(formData.get('newFieldName') ?? '').trim()
    if (newFieldName) {
      const fieldType = enumValue(formData.get('newFieldType'), fieldTypes, 'text')
      const sourceType = enumValue(formData.get('newSourceType'), sourceTypes, 'project_value')
      const [inserted] = await tx.insert(psFieldMappings).values({
        templateVariantId,
        fieldName: newFieldName,
        fieldType,
        sourceType,
        sourceKey: emptyToNull(formData.get('newSourceKey')),
        fixedValue: emptyToNull(formData.get('newFixedValue')),
        checkboxValue: checkboxValue(formData.get('newCheckboxValue')),
        sortOrder: parseInteger(formData.get('newMappingSortOrder'), mappingIds.length + 1),
        createdAt: now,
        updatedAt: now,
      }).returning({ id: psFieldMappings.id })
      await tx.insert(psConfigurationAuditEntries).values({
        actorId,
        entityType: 'field_mapping',
        entityId: inserted.id,
        action: 'draft_saved',
        configVersionId,
        before: null,
        after: { templateVariantId, fieldName: newFieldName, fieldType, sourceType },
        createdAt: now,
      })
    }
  })

  revalidateConfigurationPaths()
}

export async function runPsConfigurationTestGenerationAction(formData: FormData): Promise<void> {
  const actorId = await requireConfigEditor()
  const configVersionId = await requireDraftVersion(String(formData.get('configVersionId') ?? ''))
  const now = new Date()
  const rows = await loadConfigurationRows(configVersionId)
  const configuration = buildConfigurationReadModel(rows, configVersionId, 'draft')

  const selections: Record<string, string> = {}
  for (const category of configuration.optionCategories) {
    const value = String(formData.get(`selection:${category.slug}`) ?? '').trim()
    if (value) selections[category.slug] = value
  }
  selections.system = String(formData.get('selection:system') ?? selections.system ?? '').trim()

  await generateProducerStatementPackage({
    mode: enumValue(formData.get('generationMode'), generationModes, 'ps3_only' satisfies PsGenerationMode),
    projectDetails: {
      clientName: String(formData.get('clientName') ?? 'Mapping Test Client').trim() || 'Mapping Test Client',
      jobAddress: String(formData.get('jobAddress') ?? '1 Test Generation Way').trim() || '1 Test Generation Way',
      bcNumber: emptyToNull(formData.get('bcNumber')),
      jobNumber: emptyToNull(formData.get('jobNumber')),
      lotDescription: emptyToNull(formData.get('lotDescription')),
    },
    selections,
  }, {
    configuration,
    storage: getStorage(),
    now,
    operationId: `draft-test:${configVersionId}:${now.getTime()}`,
    persistGeneratedOutputs: false,
  })

  await db.insert(psConfigurationAuditEntries).values({
    actorId,
    entityType: 'config_version',
    entityId: configVersionId,
    action: 'test_generated',
    configVersionId,
    before: null,
    after: {
      mode: String(formData.get('generationMode') ?? 'ps3_only'),
      system: selections.system,
    },
    createdAt: now,
  })

  revalidateConfigurationPaths()
}

export async function publishPsConfigurationDraftAction(formData: FormData): Promise<void> {
  const actorId = await requireConfigPublisher()
  const configVersionId = String(formData.get('configVersionId') ?? '')
  if (!configVersionId) throw new Error('Missing draft.')

  const now = new Date()
  await db.transaction(async (tx) => {
    const [draft] = await tx
      .select()
      .from(psConfigVersions)
      .where(and(eq(psConfigVersions.id, configVersionId), eq(psConfigVersions.state, 'draft')))
      .limit(1)
    if (!draft) throw new Error('Draft PS configuration was not found.')

    await tx
      .update(psConfigVersions)
      .set({ state: 'archived', archivedAt: now })
      .where(and(eq(psConfigVersions.state, 'published'), isNull(psConfigVersions.archivedAt)))
    await tx
      .update(psSystems)
      .set({ state: 'archived', archivedAt: now, updatedAt: now })
      .where(and(eq(psSystems.state, 'published'), isNull(psSystems.archivedAt)))
    await tx
      .update(psTemplateVariants)
      .set({ state: 'archived', archivedAt: now, updatedAt: now })
      .where(and(eq(psTemplateVariants.state, 'published'), isNull(psTemplateVariants.archivedAt)))
    await tx
      .update(psDescriptionTemplates)
      .set({ state: 'archived', archivedAt: now, updatedAt: now })
      .where(and(eq(psDescriptionTemplates.state, 'published'), isNull(psDescriptionTemplates.archivedAt)))

    await tx
      .update(psConfigVersions)
      .set({ state: 'published', publishedAt: now, publishedBy: actorId, archivedAt: null })
      .where(eq(psConfigVersions.id, configVersionId))
    await tx
      .update(psSystems)
      .set({ state: 'published', archivedAt: null, updatedAt: now })
      .where(and(eq(psSystems.configVersionId, configVersionId), isNull(psSystems.archivedAt)))
    await tx
      .update(psSystems)
      .set({ state: 'archived', updatedAt: now })
      .where(and(eq(psSystems.configVersionId, configVersionId), isNotNull(psSystems.archivedAt)))
    await tx
      .update(psTemplateVariants)
      .set({ state: 'published', archivedAt: null, updatedAt: now })
      .where(and(eq(psTemplateVariants.configVersionId, configVersionId), isNull(psTemplateVariants.archivedAt)))
    await tx
      .update(psTemplateVariants)
      .set({ state: 'archived', updatedAt: now })
      .where(and(eq(psTemplateVariants.configVersionId, configVersionId), isNotNull(psTemplateVariants.archivedAt)))
    await tx
      .update(psDescriptionTemplates)
      .set({ state: 'published', archivedAt: null, updatedAt: now })
      .where(and(eq(psDescriptionTemplates.configVersionId, configVersionId), isNull(psDescriptionTemplates.archivedAt)))
    await tx
      .update(psDescriptionTemplates)
      .set({ state: 'archived', updatedAt: now })
      .where(and(eq(psDescriptionTemplates.configVersionId, configVersionId), isNotNull(psDescriptionTemplates.archivedAt)))

    await tx.insert(psConfigurationAuditEntries).values({
      actorId,
      entityType: 'config_version',
      entityId: configVersionId,
      action: 'published',
      configVersionId,
      before: { state: 'draft' },
      after: { state: 'published' },
      createdAt: now,
    })
  })

  revalidateConfigurationPaths()
}

async function requireConfigEditor(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const allowed = await userCanAccessSlug(session.user.id, 'ps-generator/configuration')
  if (!allowed) throw new Error('Forbidden')

  return session.user.id
}

async function requireDraftVersion(configVersionId: string): Promise<string> {
  if (!configVersionId) throw new Error('Missing draft.')
  const [version] = await db
    .select({ id: psConfigVersions.id, state: psConfigVersions.state })
    .from(psConfigVersions)
    .where(eq(psConfigVersions.id, configVersionId))
    .limit(1)
  if (version?.state !== 'draft') throw new Error('Only draft PS configuration can be edited here.')
  return configVersionId
}

async function requireConfigPublisher(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const allowed = await userCanAccessSlug(session.user.id, 'ps-generator/configuration/publish')
  if (!allowed) throw new Error('Forbidden')

  return session.user.id
}

function revalidateConfigurationPaths() {
  revalidatePath('/ps-generator')
  revalidatePath('/ps-generator/configuration')
}

async function loadConfigurationRows(configVersionId: string): Promise<PsConfigurationRows> {
  const [versions, systems, optionCategories, optionValues, systemOptionRules, templateVariants, fieldMappings, descriptionTemplates] = await Promise.all([
    db.select().from(psConfigVersions).where(eq(psConfigVersions.id, configVersionId)),
    db.select().from(psSystems).where(eq(psSystems.configVersionId, configVersionId)),
    db.select().from(psOptionCategories),
    db.select().from(psOptionValues).where(eq(psOptionValues.configVersionId, configVersionId)),
    db.select().from(psSystemOptionRules),
    db.select().from(psTemplateVariants).where(eq(psTemplateVariants.configVersionId, configVersionId)),
    db.select().from(psFieldMappings),
    db.select().from(psDescriptionTemplates).where(eq(psDescriptionTemplates.configVersionId, configVersionId)),
  ])

  return {
    versions,
    systems,
    optionCategories,
    optionValues,
    systemOptionRules,
    templateVariants,
    fieldMappings,
    descriptionTemplates,
  }
}

function readMappingValues(formData: FormData, id: string, before: typeof psFieldMappings.$inferSelect, now: Date) {
  const fieldName = String(formData.get(`fieldName:${id}`) ?? '').trim()
  if (!fieldName) throw new Error('Field name is required.')
  const values = {
    fieldName,
    fieldType: enumValue(formData.get(`fieldType:${id}`), fieldTypes, before.fieldType),
    sourceType: enumValue(formData.get(`sourceType:${id}`), sourceTypes, before.sourceType),
    sourceKey: emptyToNull(formData.get(`sourceKey:${id}`)),
    fixedValue: emptyToNull(formData.get(`fixedValue:${id}`)),
    checkboxValue: checkboxValue(formData.get(`checkboxValue:${id}`)),
    sortOrder: parseInteger(formData.get(`mappingSortOrder:${id}`), before.sortOrder),
    archivedAt: formData.get(`archiveMapping:${id}`) === 'on' ? now : before.archivedAt,
  }

  if (
    before.fieldName === values.fieldName
    && before.fieldType === values.fieldType
    && before.sourceType === values.sourceType
    && before.sourceKey === values.sourceKey
    && before.fixedValue === values.fixedValue
    && before.checkboxValue === values.checkboxValue
    && before.sortOrder === values.sortOrder
    && before.archivedAt === values.archivedAt
  ) return null
  return values
}

function parseInteger(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function slugify(value: FormDataEntryValue | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function enumValue<T extends string>(value: FormDataEntryValue | null, allowed: Set<string>, fallback: T): T {
  const raw = String(value ?? '')
  return (allowed.has(raw) ? raw : fallback) as T
}

function emptyToNull(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text ? text : null
}

function checkboxValue(value: FormDataEntryValue | null) {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function sanitizeObjectPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-')
}
