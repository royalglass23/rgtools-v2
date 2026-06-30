import { createHash } from 'node:crypto'
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
import { PS_GENERATOR_WORDPRESS_SEED } from '../modules/ps-generator/seed-config'

async function main() {
  const now = new Date()
  const archivedAt = new Date('2026-01-01T00:00:00.000Z')

  const [version] = await db
    .insert(psConfigVersions)
    .values({
      id: stableUuid('version:wordpress-plugin-v1'),
      versionLabel: PS_GENERATOR_WORDPRESS_SEED.version.versionLabel,
      state: PS_GENERATOR_WORDPRESS_SEED.version.state,
      publishedAt: now,
      archivedAt: null,
    })
    .onConflictDoUpdate({
      target: psConfigVersions.versionLabel,
      set: {
        state: PS_GENERATOR_WORDPRESS_SEED.version.state,
        publishedAt: now,
        archivedAt: null,
      },
    })
    .returning({ id: psConfigVersions.id })

  const categoryIds = new Map<string, string>()
  const optionValueIds = new Map<string, string>()

  for (const category of PS_GENERATOR_WORDPRESS_SEED.optionCategories) {
    const [row] = await db
      .insert(psOptionCategories)
      .values({
        id: stableUuid(`category:${category.slug}`),
        slug: category.slug,
        label: category.label,
        sortOrder: category.sortOrder,
        isActive: category.isActive ?? true,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: psOptionCategories.slug,
        set: {
          label: category.label,
          sortOrder: category.sortOrder,
          isActive: category.isActive ?? true,
          updatedAt: now,
        },
      })
      .returning({ id: psOptionCategories.id })
    categoryIds.set(category.slug, row.id)

    for (const value of category.values) {
      const [valueRow] = await db
        .insert(psOptionValues)
        .values({
          id: stableUuid(`option:${category.slug}:${value.slug}`),
          configVersionId: version.id,
          categoryId: row.id,
          slug: value.slug,
          label: value.label,
          sortOrder: value.sortOrder,
          isActive: value.isActive ?? true,
          archivedAt: value.archived ? archivedAt : null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [psOptionValues.categoryId, psOptionValues.slug, psOptionValues.configVersionId],
          set: {
            label: value.label,
            sortOrder: value.sortOrder,
            isActive: value.isActive ?? true,
            archivedAt: value.archived ? archivedAt : null,
            updatedAt: now,
          },
        })
        .returning({ id: psOptionValues.id })
      optionValueIds.set(`${category.slug}:${value.slug}`, valueRow.id)
    }
  }

  const systemIds = new Map<string, string>()
  for (const system of PS_GENERATOR_WORDPRESS_SEED.systems) {
    const [row] = await db
      .insert(psSystems)
      .values({
        id: stableUuid(`system:${system.slug}`),
        configVersionId: version.id,
        slug: system.slug,
        displayName: system.displayName,
        state: system.state,
        sortOrder: system.sortOrder,
        heightRules: system.heightRules,
        metadata: system.metadata,
        archivedAt: system.state === 'archived' ? archivedAt : null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [psSystems.slug, psSystems.configVersionId],
        set: {
          displayName: system.displayName,
          state: system.state,
          sortOrder: system.sortOrder,
          heightRules: system.heightRules,
          metadata: system.metadata,
          archivedAt: system.state === 'archived' ? archivedAt : null,
          updatedAt: now,
        },
      })
      .returning({ id: psSystems.id })
    systemIds.set(system.slug, row.id)
  }

  for (const system of PS_GENERATOR_WORDPRESS_SEED.systems) {
    const systemId = requireMapValue(systemIds, system.slug)
    for (const [categorySlug, optionSlugs] of Object.entries(system.allowedOptions)) {
      for (const optionSlug of optionSlugs) {
        const optionValueId = optionValueIds.get(`${categorySlug}:${optionSlug}`)
        if (!optionValueId) continue

        await db
          .insert(psSystemOptionRules)
          .values({
            id: stableUuid(`rule:${system.slug}:${categorySlug}:${optionSlug}`),
            systemId,
            optionValueId,
            isAllowed: true,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [psSystemOptionRules.systemId, psSystemOptionRules.optionValueId],
            set: { isAllowed: true, updatedAt: now },
          })
      }
    }
  }

  const templateVariantIds = new Map<string, string>()
  for (const variant of PS_GENERATOR_WORDPRESS_SEED.templateVariants) {
    const [row] = await db
      .insert(psTemplateVariants)
      .values({
        id: stableUuid(`template:${variant.key}`),
        systemId: requireMapValue(systemIds, variant.systemSlug),
        configVersionId: version.id,
        documentKind: variant.documentKind,
        variantKind: variant.variantKind,
        label: variant.label,
        r2ObjectKey: variant.r2ObjectKey,
        originalFilename: variant.originalFilename,
        fieldDiscovery: variant.fieldDiscovery,
        state: variant.state,
        archivedAt: variant.state === 'archived' ? archivedAt : null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: psTemplateVariants.id,
        set: {
          label: variant.label,
          r2ObjectKey: variant.r2ObjectKey,
          originalFilename: variant.originalFilename,
          fieldDiscovery: variant.fieldDiscovery,
          state: variant.state,
          archivedAt: variant.state === 'archived' ? archivedAt : null,
          updatedAt: now,
        },
      })
      .returning({ id: psTemplateVariants.id })
    templateVariantIds.set(variant.key, row.id)
  }

  for (const mapping of PS_GENERATOR_WORDPRESS_SEED.fieldMappings) {
    await db
      .insert(psFieldMappings)
      .values({
        id: stableUuid(`field:${mapping.templateKey}:${mapping.fieldName}`),
        templateVariantId: requireMapValue(templateVariantIds, mapping.templateKey),
        fieldName: mapping.fieldName,
        fieldType: mapping.fieldType,
        sourceType: mapping.sourceType,
        sourceKey: mapping.sourceKey ?? null,
        fixedValue: mapping.fixedValue ?? null,
        checkboxValue: mapping.checkboxValue ?? null,
        sortOrder: mapping.sortOrder,
        archivedAt: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [psFieldMappings.templateVariantId, psFieldMappings.fieldName],
        set: {
          fieldType: mapping.fieldType,
          sourceType: mapping.sourceType,
          sourceKey: mapping.sourceKey ?? null,
          fixedValue: mapping.fixedValue ?? null,
          checkboxValue: mapping.checkboxValue ?? null,
          sortOrder: mapping.sortOrder,
          archivedAt: null,
          updatedAt: now,
        },
      })
  }

  for (const template of PS_GENERATOR_WORDPRESS_SEED.descriptionTemplates) {
    await db
      .insert(psDescriptionTemplates)
      .values({
        id: stableUuid(`description:${template.slug}`),
        configVersionId: version.id,
        slug: template.slug,
        label: template.label,
        pattern: template.pattern,
        state: template.state,
        archivedAt: template.state === 'archived' ? archivedAt : null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [psDescriptionTemplates.slug, psDescriptionTemplates.configVersionId],
        set: {
          label: template.label,
          pattern: template.pattern,
          state: template.state,
          archivedAt: template.state === 'archived' ? archivedAt : null,
          updatedAt: now,
        },
      })
  }

  console.log(`Seeded PS Generator configuration ${PS_GENERATOR_WORDPRESS_SEED.version.versionLabel}`)
}

function stableUuid(key: string) {
  const hex = createHash('sha1').update(`rgtools:ps-generator:${key}`).digest('hex')
  const variantNibble = (8 + (Number.parseInt(hex[16], 16) % 4)).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variantNibble}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function requireMapValue(values: Map<string, string>, key: string) {
  const value = values.get(key)
  if (!value) throw new Error(`Missing PS Generator seed reference: ${key}`)
  return value
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
