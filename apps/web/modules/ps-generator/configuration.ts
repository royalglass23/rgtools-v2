import { asc, desc, eq, and, isNull } from 'drizzle-orm'
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
import { PS_GENERATOR_COMPATIBILITY_OPTIONS, PS_GENERATOR_OPTION_CATEGORIES } from './config'
import { PS_GENERATOR_WORDPRESS_SEED, type PsConfigState } from './seed-config'

type MaybeDate = Date | string | null

interface VersionRow {
  id: string
  versionLabel: string
  state: PsConfigState
  publishedAt?: MaybeDate
  publishedBy?: string | null
  createdBy?: string | null
  createdAt?: MaybeDate
  archivedAt?: MaybeDate
}

interface SystemRow {
  id: string
  configVersionId: string | null
  slug: string
  displayName: string
  state: PsConfigState
  sortOrder: number
  heightRules: unknown
  metadata: unknown
  createdAt?: MaybeDate
  updatedAt?: MaybeDate
  archivedAt?: MaybeDate
}

interface OptionCategoryRow {
  id: string
  slug: string
  label: string
  sortOrder: number
  isActive: boolean
}

interface OptionValueRow {
  id: string
  categoryId: string
  configVersionId: string | null
  slug: string
  label: string
  sortOrder: number
  isActive: boolean
  createdAt?: MaybeDate
  updatedAt?: MaybeDate
  archivedAt?: MaybeDate
}

interface SystemOptionRuleRow {
  id: string
  systemId: string
  optionValueId: string
  isAllowed: boolean
  createdAt?: MaybeDate
  updatedAt?: MaybeDate
}

interface TemplateVariantRow {
  id: string
  systemId: string | null
  configVersionId: string | null
  documentKind: 'ps1' | 'ps3'
  variantKind: 'standard_ps1' | 'pool_ps1' | 'gate_ps1' | 'ps3' | 'other'
  label: string
  r2ObjectKey: string
  originalFilename: string | null
  fieldDiscovery: unknown
  state: PsConfigState
  createdAt?: MaybeDate
  updatedAt?: MaybeDate
  archivedAt?: MaybeDate
}

interface FieldMappingRow {
  id: string
  templateVariantId: string
  fieldName: string
  fieldType: 'text' | 'checkbox'
  sourceType: 'project_value' | 'selected_option' | 'system_rule' | 'description_template' | 'date' | 'fixed_value'
  sourceKey: string | null
  fixedValue: string | null
  checkboxValue: boolean | null
  sortOrder: number
  createdAt?: MaybeDate
  updatedAt?: MaybeDate
  archivedAt?: MaybeDate
}

interface DescriptionTemplateRow {
  id: string
  configVersionId: string | null
  slug: string
  label: string
  pattern: string
  state: PsConfigState
  createdAt?: MaybeDate
  updatedAt?: MaybeDate
  archivedAt?: MaybeDate
}

export interface PsConfigurationRows {
  versions: VersionRow[]
  systems: SystemRow[]
  optionCategories: OptionCategoryRow[]
  optionValues: OptionValueRow[]
  systemOptionRules: SystemOptionRuleRow[]
  templateVariants: TemplateVariantRow[]
  fieldMappings: FieldMappingRow[]
  descriptionTemplates: DescriptionTemplateRow[]
  auditEntries?: Array<{
    actorId: string
    entityType: string
    entityId: string | null
    action: string
    configVersionId: string | null
    before: unknown
    after: unknown
    createdAt: Date
  }>
}

export interface PublishedPsOptionValue {
  slug: string
  label: string
}

export interface PublishedPsOptionCategory {
  slug: string
  label: string
  values: PublishedPsOptionValue[]
}

export interface PublishedPsSystem {
  id?: string
  slug: string
  displayName: string
  heightRules: unknown
  metadata: unknown
  optionRules: Record<string, PublishedPsOptionValue[]>
}

export interface PublishedPsTemplateVariant {
  id: string
  systemSlug: string | null
  documentKind: 'ps1' | 'ps3'
  variantKind: 'standard_ps1' | 'pool_ps1' | 'gate_ps1' | 'ps3' | 'other'
  label: string
  r2ObjectKey: string
  originalFilename: string | null
  fieldDiscovery: unknown
  fieldMappings: Array<{
    fieldName: string
    fieldType: 'text' | 'checkbox'
    sourceType: 'project_value' | 'selected_option' | 'system_rule' | 'description_template' | 'date' | 'fixed_value'
    sourceKey: string | null
    fixedValue: string | null
    checkboxValue: boolean | null
  }>
}

export interface PsConfigurationSystemRow {
  id?: string
  slug: string
  displayName: string
  isActive: boolean
  heightRules: PsSystemHeightRules
  standardPs1Template: {
    id: string
    label: string
    originalFilename: string | null
    r2ObjectKey: string
  } | null
  poolPs1Template: {
    id: string
    label: string
    originalFilename: string | null
    r2ObjectKey: string
  } | null
}

export interface PsSystemHeightRules {
  default: {
    height: string
    heightAboveFix: string
  }
  pool: {
    height: string
    heightAboveFix: string
  }
}

export interface PublishedPsDescriptionTemplate {
  slug: string
  label: string
  pattern: string
}

export interface PublishedPsConfiguration {
  versionId?: string
  versionLabel: string | null
  systems: PublishedPsSystem[]
  optionCategories: PublishedPsOptionCategory[]
  templateVariants: PublishedPsTemplateVariant[]
  descriptionTemplates: PublishedPsDescriptionTemplate[]
}

const EMPTY_CONFIGURATION: PublishedPsConfiguration = {
  versionLabel: null,
  systems: [],
  optionCategories: [],
  templateVariants: [],
  descriptionTemplates: [],
}

const DRAFT_LABEL_TOKEN_PATTERN = /-draft-\d{4}-\d{2}-\d{2}(?:-\d+)?/g

export function formatPsConfigurationVersionLabel(versionLabel: string | null | undefined): string {
  if (!versionLabel) return ''
  const draftTokens = versionLabel.match(DRAFT_LABEL_TOKEN_PATTERN)
  if (!draftTokens?.length) return versionLabel

  const baseLabel = versionLabel.replace(DRAFT_LABEL_TOKEN_PATTERN, '')
  return `${baseLabel}${draftTokens.at(-1)}`
}

export function nextPsConfigurationDraftLabel(
  publishedVersionLabel: string,
  now: Date,
  existingVersionLabels: string[] = [],
): string {
  const baseLabel = publishedVersionLabel.replace(DRAFT_LABEL_TOKEN_PATTERN, '')
  const draftToken = `draft-${now.toISOString().slice(0, 10)}`
  const usedLabels = new Set(existingVersionLabels)
  let candidate = `${baseLabel}-${draftToken}`
  let suffix = 2

  while (usedLabels.has(candidate)) {
    candidate = `${baseLabel}-${draftToken}-${suffix}`
    suffix += 1
  }

  return candidate
}

export function createPsGeneratorSeedRows(): PsConfigurationRows {
  const versionId = 'seed-version:wordpress-plugin-v1'
  const archivedAt = '2026-01-01T00:00:00.000Z'
  const categoryRows: OptionCategoryRow[] = PS_GENERATOR_WORDPRESS_SEED.optionCategories.map((category) => ({
    id: `seed-category:${category.slug}`,
    slug: category.slug,
    label: category.label,
    sortOrder: category.sortOrder,
    isActive: category.isActive ?? true,
  }))
  const optionValueRows: OptionValueRow[] = PS_GENERATOR_WORDPRESS_SEED.optionCategories.flatMap((category) => (
    category.values.map((value) => ({
      id: `seed-option:${category.slug}:${value.slug}`,
      categoryId: `seed-category:${category.slug}`,
      configVersionId: versionId,
      slug: value.slug,
      label: value.label,
      sortOrder: value.sortOrder,
      isActive: value.isActive ?? true,
      archivedAt: value.archived ? archivedAt : null,
    }))
  ))
  const systemRows: SystemRow[] = PS_GENERATOR_WORDPRESS_SEED.systems.map((system) => ({
    id: `seed-system:${system.slug}`,
    configVersionId: versionId,
    slug: system.slug,
    displayName: system.displayName,
    state: system.state,
    sortOrder: system.sortOrder,
    heightRules: system.heightRules,
    metadata: system.metadata,
    archivedAt: system.state === 'archived' ? archivedAt : null,
  }))
  const ruleRows: SystemOptionRuleRow[] = PS_GENERATOR_WORDPRESS_SEED.systems.flatMap((system) => (
    Object.entries(system.allowedOptions).flatMap(([categorySlug, optionSlugs]) => (
      optionSlugs.map((optionSlug) => ({
        id: `seed-rule:${system.slug}:${categorySlug}:${optionSlug}`,
        systemId: `seed-system:${system.slug}`,
        optionValueId: `seed-option:${categorySlug}:${optionSlug}`,
        isAllowed: true,
      }))
    ))
  ))
  const templateRows: TemplateVariantRow[] = PS_GENERATOR_WORDPRESS_SEED.templateVariants.map((variant) => ({
    id: `seed-template:${variant.key}`,
    systemId: `seed-system:${variant.systemSlug}`,
    configVersionId: versionId,
    documentKind: variant.documentKind,
    variantKind: variant.variantKind,
    label: variant.label,
    r2ObjectKey: variant.r2ObjectKey,
    originalFilename: variant.originalFilename,
    fieldDiscovery: variant.fieldDiscovery,
    state: variant.state,
    archivedAt: variant.state === 'archived' ? archivedAt : null,
  }))
  const fieldMappingRows: FieldMappingRow[] = PS_GENERATOR_WORDPRESS_SEED.fieldMappings.map((mapping, index) => ({
    id: `seed-field:${mapping.templateKey}:${mapping.fieldName}`,
    templateVariantId: `seed-template:${mapping.templateKey}`,
    fieldName: mapping.fieldName,
    fieldType: mapping.fieldType,
    sourceType: mapping.sourceType,
    sourceKey: mapping.sourceKey ?? null,
    fixedValue: mapping.fixedValue ?? null,
    checkboxValue: mapping.checkboxValue ?? null,
    sortOrder: mapping.sortOrder ?? index,
    archivedAt: null,
  }))
  const descriptionRows: DescriptionTemplateRow[] = PS_GENERATOR_WORDPRESS_SEED.descriptionTemplates.map((template) => ({
    id: `seed-description:${template.slug}`,
    configVersionId: versionId,
    slug: template.slug,
    label: template.label,
    pattern: template.pattern,
    state: template.state,
    archivedAt: template.state === 'archived' ? archivedAt : null,
  }))

  return {
    versions: [{
      id: versionId,
      versionLabel: PS_GENERATOR_WORDPRESS_SEED.version.versionLabel,
      state: PS_GENERATOR_WORDPRESS_SEED.version.state,
      publishedAt: '2026-06-26T00:00:00.000Z',
      archivedAt: null,
    }],
    systems: systemRows,
    optionCategories: categoryRows,
    optionValues: optionValueRows,
    systemOptionRules: ruleRows,
    templateVariants: templateRows,
    fieldMappings: fieldMappingRows,
    descriptionTemplates: descriptionRows,
  }
}

export function buildPublishedPsConfigurationReadModel(rows: PsConfigurationRows): PublishedPsConfiguration {
  const version = rows.versions.find((row) => row.state === 'published' && !row.archivedAt)
  if (!version) return EMPTY_CONFIGURATION
  return buildConfigurationReadModel(rows, version.id, 'published')
}

export function buildConfigurationReadModel(
  rows: PsConfigurationRows,
  configVersionId: string,
  state: PsConfigState,
): PublishedPsConfiguration {
  const version = rows.versions.find((row) => row.id === configVersionId && row.state === state && !row.archivedAt)
  if (!version) return EMPTY_CONFIGURATION

  const categories = rows.optionCategories
    .filter((category) => category.isActive && PS_GENERATOR_OPTION_CATEGORIES.includes(category.slug as never))
    .sort(sortByOrder)
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const values = rows.optionValues
    .filter((value) => (
      value.configVersionId === configVersionId
      && value.isActive
      && !value.archivedAt
      && categoryById.has(value.categoryId)
    ))
    .sort(sortByOrder)
  const valueById = new Map(values.map((value) => [value.id, value]))
  const systemRows = rows.systems
    .filter((system) => system.configVersionId === configVersionId && system.state === state && !system.archivedAt)
    .sort(sortByOrder)
  const systemById = new Map(systemRows.map((system) => [system.id, system]))

  const optionCategories = categories.map((category) => ({
    slug: category.slug,
    label: category.label,
    values: withCompatibilityOptions(
      category.slug,
      values
        .filter((value) => value.categoryId === category.id)
        .map((value) => ({ slug: value.slug, label: value.label })),
    ),
  }))

  const systems = systemRows.map((system) => {
    const optionRules: Record<string, PublishedPsOptionValue[]> = {}
    for (const category of categories) optionRules[category.slug] = []

    for (const rule of rows.systemOptionRules) {
      if (rule.systemId !== system.id || !rule.isAllowed) continue
      const value = valueById.get(rule.optionValueId)
      if (!value) continue
      const category = categoryById.get(value.categoryId)
      if (!category) continue
      optionRules[category.slug].push({ slug: value.slug, label: value.label })
    }

    return {
      id: system.id,
      slug: system.slug,
      displayName: system.displayName,
      heightRules: normalizePsSystemHeightRules(system.heightRules, system),
      metadata: system.metadata,
      optionRules: withCompatibilityOptionRules(optionRules),
    }
  })

  const templateRows = rows.templateVariants
    .filter((variant) => (
      variant.configVersionId === configVersionId
      && variant.state === state
      && !variant.archivedAt
      && (!variant.systemId || systemById.has(variant.systemId))
    ))
    .sort(sortTemplateVariant)
  const templateById = new Map(templateRows.map((variant) => [variant.id, variant]))

  const templateVariants = templateRows.map((variant) => ({
    id: variant.id,
    systemSlug: variant.systemId ? systemById.get(variant.systemId)?.slug ?? null : null,
    documentKind: variant.documentKind,
    variantKind: variant.variantKind,
    label: variant.label,
    r2ObjectKey: variant.r2ObjectKey,
    originalFilename: variant.originalFilename,
    fieldDiscovery: variant.fieldDiscovery,
    fieldMappings: rows.fieldMappings
      .filter((mapping) => mapping.templateVariantId === variant.id && !mapping.archivedAt && templateById.has(mapping.templateVariantId))
      .sort(sortByOrder)
      .map((mapping) => ({
        fieldName: mapping.fieldName,
        fieldType: mapping.fieldType,
        sourceType: mapping.sourceType,
        sourceKey: mapping.sourceKey,
        fixedValue: mapping.fixedValue,
        checkboxValue: mapping.checkboxValue,
      })),
  }))

  const descriptionTemplates = rows.descriptionTemplates
    .filter((template) => template.configVersionId === configVersionId && template.state === state && !template.archivedAt)
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((template) => ({
      slug: template.slug,
      label: template.label,
      pattern: template.pattern,
    }))

  return {
    versionId: version.id,
    versionLabel: version.versionLabel,
    systems,
    optionCategories,
    templateVariants,
    descriptionTemplates,
  }
}

function withCompatibilityOptions(
  categorySlug: string,
  values: PublishedPsOptionValue[],
): PublishedPsOptionValue[] {
  const additions = PS_GENERATOR_COMPATIBILITY_OPTIONS[categorySlug as keyof typeof PS_GENERATOR_COMPATIBILITY_OPTIONS] ?? []
  const baseValues = categorySlug === 'structure_type'
    ? values.filter((value) => value.slug !== 'pool-fence')
    : values
  if (additions.length === 0) return baseValues

  const bySlug = new Map(baseValues.map((value) => [value.slug, value]))
  for (const option of additions) {
    bySlug.set(option.slug, {
      slug: option.slug,
      label: option.label,
    })
  }
  return [...bySlug.values()]
}

function withCompatibilityOptionRules(
  optionRules: Record<string, PublishedPsOptionValue[]>,
): Record<string, PublishedPsOptionValue[]> {
  const next: Record<string, PublishedPsOptionValue[]> = {}
  for (const [categorySlug, values] of Object.entries(optionRules)) {
    next[categorySlug] = withCompatibilityOptions(categorySlug, values)
  }
  return next
}

export function buildPsConfigurationSystemRows(configuration: PublishedPsConfiguration): PsConfigurationSystemRow[] {
  return configuration.systems.map((system) => {
    const templates = configuration.templateVariants.filter((template) => template.systemSlug === system.slug)
    return {
      id: system.id,
      slug: system.slug,
      displayName: system.displayName,
      isActive: true,
      heightRules: normalizePsSystemHeightRules(system.heightRules, system),
      standardPs1Template: templateSummary(templates.find((template) => template.variantKind === 'standard_ps1')),
      poolPs1Template: templateSummary(templates.find((template) => template.variantKind === 'pool_ps1')),
    }
  })
}

export function normalizePsSystemHeightRules(
  value: unknown,
  system?: { slug?: string | null; displayName?: string | null },
): PsSystemHeightRules {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const fallback = defaultHeightRulesForSystem(system, source)
  const normalized = {
    default: normalizeHeightRule(source.default),
    pool: normalizeHeightRule(source.pool),
  }

  return {
    default: {
      height: normalized.default.height || fallback.default.height,
      heightAboveFix: normalized.default.heightAboveFix || fallback.default.heightAboveFix,
    },
    pool: {
      height: normalized.pool.height || fallback.pool.height,
      heightAboveFix: normalized.pool.heightAboveFix || fallback.pool.heightAboveFix,
    },
  }
}

function normalizeHeightRule(value: unknown): PsSystemHeightRules['default'] {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    height: stringifyHeightRuleValue(source.height),
    heightAboveFix: stringifyHeightRuleValue(source.heightAboveFix),
  }
}

function stringifyHeightRuleValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function defaultHeightRulesForSystem(
  system: { slug?: string | null; displayName?: string | null } | undefined,
  source: Record<string, unknown>,
): PsSystemHeightRules {
  const key = normalizeSystemKey(system?.slug ?? system?.displayName ?? '')
  const maxHeightMm = stringifyHeightRuleValue(source.maxHeightMm)

  if (key === 'doubledisc' || maxHeightMm === '1000') {
    return {
      default: { height: '1.00', heightAboveFix: '1.05' },
      pool: { height: '1.20', heightAboveFix: '1.25' },
    }
  }

  return {
    default: { height: '1.00', heightAboveFix: '1.00' },
    pool: { height: '1.20', heightAboveFix: '1.20' },
  }
}

function normalizeSystemKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export async function getPublishedPsConfiguration(database?: Awaited<ReturnType<typeof loadDefaultDb>>): Promise<PublishedPsConfiguration> {
  const db = database ?? await loadDefaultDb()
  const [version] = await db
    .select()
    .from(psConfigVersions)
    .where(and(eq(psConfigVersions.state, 'published'), isNull(psConfigVersions.archivedAt)))
    .orderBy(desc(psConfigVersions.publishedAt), desc(psConfigVersions.createdAt))
    .limit(1)

  if (!version) return EMPTY_CONFIGURATION

  const [
    systems,
    optionCategories,
    optionValues,
    systemOptionRules,
    templateVariants,
    fieldMappings,
    descriptionTemplates,
  ] = await Promise.all([
    db.select().from(psSystems).where(eq(psSystems.configVersionId, version.id)).orderBy(asc(psSystems.sortOrder)),
    db.select().from(psOptionCategories).orderBy(asc(psOptionCategories.sortOrder)),
    db.select().from(psOptionValues).where(eq(psOptionValues.configVersionId, version.id)).orderBy(asc(psOptionValues.sortOrder)),
    db.select().from(psSystemOptionRules),
    db.select().from(psTemplateVariants).where(eq(psTemplateVariants.configVersionId, version.id)),
    db.select().from(psFieldMappings).orderBy(asc(psFieldMappings.sortOrder)),
    db.select().from(psDescriptionTemplates).where(eq(psDescriptionTemplates.configVersionId, version.id)),
  ])

  return buildPublishedPsConfigurationReadModel({
    versions: [version],
    systems,
    optionCategories,
    optionValues,
    systemOptionRules,
    templateVariants,
    fieldMappings,
    descriptionTemplates,
  })
}

async function loadDefaultDb() {
  const { db } = await import('@/lib/db')
  return db
}

function sortByOrder<T extends { sortOrder: number; slug?: string; fieldName?: string }>(a: T, b: T) {
  return a.sortOrder - b.sortOrder || String(a.slug ?? a.fieldName).localeCompare(String(b.slug ?? b.fieldName))
}

function sortTemplateVariant(a: TemplateVariantRow, b: TemplateVariantRow) {
  return a.documentKind.localeCompare(b.documentKind) || a.variantKind.localeCompare(b.variantKind) || a.label.localeCompare(b.label)
}

function templateSummary(template: PublishedPsTemplateVariant | undefined): PsConfigurationSystemRow['standardPs1Template'] {
  if (!template) return null
  return {
    id: template.id,
    label: template.label,
    originalFilename: template.originalFilename,
    r2ObjectKey: template.r2ObjectKey,
  }
}
