'use server'

import { and, desc, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { userCanAccessSlug } from '@/lib/access-db'
import { db } from '@/lib/db'
import {
  psConfigurationAuditEntries,
  psConfigVersions,
  psDescriptionTemplates,
  psFieldMappings,
  psOptionValues,
  psSystemOptionRules,
  psSystems,
  psTemplateVariants,
} from '@rgtools/db/schema-ps-generator'

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

      if (before.label === label && before.isActive === isActive) continue

      await tx
        .update(psOptionValues)
        .set({
          label,
          isActive,
          updatedAt: now,
        })
        .where(eq(psOptionValues.id, optionValueId))

      await tx.insert(psConfigurationAuditEntries).values({
        actorId,
        entityType: 'option_value',
        entityId: optionValueId,
        action: 'draft_saved',
        configVersionId,
        before,
        after: {
          ...before,
          label,
          isActive,
        },
      })
    }
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
      .where(eq(psSystems.configVersionId, configVersionId))
    await tx
      .update(psTemplateVariants)
      .set({ state: 'published', archivedAt: null, updatedAt: now })
      .where(eq(psTemplateVariants.configVersionId, configVersionId))
    await tx
      .update(psDescriptionTemplates)
      .set({ state: 'published', archivedAt: null, updatedAt: now })
      .where(eq(psDescriptionTemplates.configVersionId, configVersionId))

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
