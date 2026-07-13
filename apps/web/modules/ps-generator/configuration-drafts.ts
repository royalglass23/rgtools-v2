import type { PsConfigurationRows } from './configuration'
import {
  buildConfigurationReadModel,
  type PublishedPsConfiguration,
} from './configuration'
import {
  generateProducerStatementPackage,
  type GenerateProducerStatementPackageInput,
  type GenerateProducerStatementPackageDependencies,
  type GenerateProducerStatementPackageResult,
} from './generation'

type ConfigVersionRow = PsConfigurationRows['versions'][number]
type SystemRow = PsConfigurationRows['systems'][number]
type OptionValueRow = PsConfigurationRows['optionValues'][number]
type SystemOptionRuleRow = PsConfigurationRows['systemOptionRules'][number]
type TemplateVariantRow = PsConfigurationRows['templateVariants'][number]
type FieldMappingRow = PsConfigurationRows['fieldMappings'][number]
type DescriptionTemplateRow = PsConfigurationRows['descriptionTemplates'][number]
type AuditEntry = NonNullable<PsConfigurationRows['auditEntries']>[number]
type DraftTemplateInput = {
  r2ObjectKey: string
  originalFilename: string
  fieldDiscovery: unknown
}

interface DraftActorInput {
  actorId: string
  now: Date
}

export function createConfigurationDraft(
  rows: PsConfigurationRows,
  input: DraftActorInput & { draftVersionLabel: string },
): { rows: PsConfigurationRows; configVersionId: string; auditEntries: AuditEntry[] } {
  const published = latestPublishedVersion(rows)
  if (!published) throw new Error('A published PS configuration is required before creating a draft.')

  const draftVersionId = `draft-version:${input.draftVersionLabel}`
  const idMaps = {
    systems: new Map<string, string>(),
    optionValues: new Map<string, string>(),
    templateVariants: new Map<string, string>(),
    descriptionTemplates: new Map<string, string>(),
  }

  const draftVersion: ConfigVersionRow = {
    ...published,
    id: draftVersionId,
    versionLabel: input.draftVersionLabel,
    state: 'draft',
    publishedAt: null,
    publishedBy: null,
    createdBy: input.actorId,
    createdAt: input.now,
    archivedAt: null,
  }

  const systems = rows.systems
    .filter((system) => system.configVersionId === published.id && !system.archivedAt)
    .map((system): SystemRow => {
      const id = `draft-system:${input.draftVersionLabel}:${system.slug}`
      idMaps.systems.set(system.id, id)
      return { ...system, id, configVersionId: draftVersionId, state: 'draft', createdAt: input.now, updatedAt: input.now, archivedAt: null }
    })

  const optionValues = rows.optionValues
    .filter((value) => value.configVersionId === published.id && !value.archivedAt)
    .map((value): OptionValueRow => {
      const id = `draft-option:${input.draftVersionLabel}:${value.categoryId}:${value.slug}`
      idMaps.optionValues.set(value.id, id)
      return { ...value, id, configVersionId: draftVersionId, createdAt: input.now, updatedAt: input.now, archivedAt: null }
    })

  const systemOptionRules = rows.systemOptionRules
    .filter((rule) => idMaps.systems.has(rule.systemId) && idMaps.optionValues.has(rule.optionValueId))
    .map((rule): SystemOptionRuleRow => ({
      ...rule,
      id: `draft-rule:${input.draftVersionLabel}:${rule.id}`,
      systemId: idMaps.systems.get(rule.systemId)!,
      optionValueId: idMaps.optionValues.get(rule.optionValueId)!,
      createdAt: input.now,
      updatedAt: input.now,
    }))

  const templateVariants = rows.templateVariants
    .filter((variant) => variant.configVersionId === published.id && !variant.archivedAt)
    .map((variant): TemplateVariantRow => {
      const id = `draft-template:${input.draftVersionLabel}:${variant.id}`
      idMaps.templateVariants.set(variant.id, id)
      return {
        ...variant,
        id,
        systemId: variant.systemId ? idMaps.systems.get(variant.systemId) ?? null : null,
        configVersionId: draftVersionId,
        state: 'draft',
        createdAt: input.now,
        updatedAt: input.now,
        archivedAt: null,
      }
    })

  const fieldMappings = rows.fieldMappings
    .filter((mapping) => idMaps.templateVariants.has(mapping.templateVariantId) && !mapping.archivedAt)
    .map((mapping): FieldMappingRow => ({
      ...mapping,
      id: `draft-field:${input.draftVersionLabel}:${mapping.id}`,
      templateVariantId: idMaps.templateVariants.get(mapping.templateVariantId)!,
      createdAt: input.now,
      updatedAt: input.now,
      archivedAt: null,
    }))

  const descriptionTemplates = rows.descriptionTemplates
    .filter((template) => template.configVersionId === published.id && !template.archivedAt)
    .map((template): DescriptionTemplateRow => {
      const id = `draft-description:${input.draftVersionLabel}:${template.slug}`
      idMaps.descriptionTemplates.set(template.id, id)
      return { ...template, id, configVersionId: draftVersionId, state: 'draft', createdAt: input.now, updatedAt: input.now, archivedAt: null }
    })

  const audit = auditEntry(input, {
    entityType: 'config_version',
    entityId: draftVersionId,
    action: 'draft_saved',
    configVersionId: draftVersionId,
    before: null,
    after: { state: 'draft', versionLabel: input.draftVersionLabel },
  })

  const nextRows = withAudit({
    ...rows,
    versions: [...rows.versions, draftVersion],
    systems: [...rows.systems, ...systems],
    optionValues: [...rows.optionValues, ...optionValues],
    systemOptionRules: [...rows.systemOptionRules, ...systemOptionRules],
    templateVariants: [...rows.templateVariants, ...templateVariants],
    fieldMappings: [...rows.fieldMappings, ...fieldMappings],
    descriptionTemplates: [...rows.descriptionTemplates, ...descriptionTemplates],
  }, audit)

  return { rows: nextRows, configVersionId: draftVersionId, auditEntries: nextRows.auditEntries ?? [] }
}

export function updateDraftOptionValue(
  rows: PsConfigurationRows,
  input: DraftActorInput & { configVersionId: string; categorySlug: string; optionSlug: string; label: string; isActive?: boolean; archived?: boolean; sortOrder?: number },
): { rows: PsConfigurationRows; auditEntries: AuditEntry[] } {
  const category = rows.optionCategories.find((candidate) => candidate.slug === input.categorySlug)
  if (!category) throw new Error(`Unknown PS option category "${input.categorySlug}".`)

  const before = rows.optionValues.find((value) => (
    value.configVersionId === input.configVersionId
    && value.categoryId === category.id
    && value.slug === input.optionSlug
  ))
  if (!before) throw new Error(`Unknown draft option value "${input.categorySlug}.${input.optionSlug}".`)

  const after: OptionValueRow = {
    ...before,
    label: input.label,
    isActive: input.isActive ?? before.isActive,
    sortOrder: input.sortOrder ?? before.sortOrder,
    archivedAt: input.archived ? input.now : before.archivedAt,
    updatedAt: input.now,
  }

  const audit = auditEntry(input, {
    entityType: 'option_value',
    entityId: before.id,
    action: input.archived ? 'archived' : 'draft_saved',
    configVersionId: input.configVersionId,
    before,
    after,
  })

  return finishRows(withAudit({
    ...rows,
    optionValues: rows.optionValues.map((value) => value.id === before.id ? after : value),
  }, audit))
}

export function upsertDraftSystem(
  rows: PsConfigurationRows,
  input: DraftActorInput & {
    configVersionId: string
    slug: string
    displayName: string
    sortOrder?: number
    heightRules?: unknown
    metadata?: unknown
    archived?: boolean
  },
): { rows: PsConfigurationRows; auditEntries: AuditEntry[] } {
  requireDraftVersion(rows, input.configVersionId)

  const before = rows.systems.find((system) => (
    system.configVersionId === input.configVersionId
    && system.slug === input.slug
  ))
  const after: SystemRow = {
    id: before?.id ?? `draft-system:${input.configVersionId}:${input.slug}`,
    configVersionId: input.configVersionId,
    slug: input.slug,
    displayName: input.displayName,
    state: 'draft',
    sortOrder: input.sortOrder ?? before?.sortOrder ?? rows.systems.length,
    heightRules: input.heightRules ?? before?.heightRules ?? {},
    metadata: input.metadata ?? before?.metadata ?? {},
    createdAt: before?.createdAt ?? input.now,
    updatedAt: input.now,
    archivedAt: input.archived ? input.now : before?.archivedAt ?? null,
  }

  const audit = auditEntry(input, {
    entityType: 'system',
    entityId: after.id,
    action: input.archived ? 'archived' : 'draft_saved',
    configVersionId: input.configVersionId,
    before: before ?? null,
    after,
  })

  return finishRows(withAudit({
    ...rows,
    systems: before
      ? rows.systems.map((system) => system.id === before.id ? after : system)
      : [...rows.systems, after],
  }, audit))
}

export function createDraftSystemRow(
  rows: PsConfigurationRows,
  input: DraftActorInput & {
    configVersionId: string
    displayName: string
    isActive?: boolean
    heightRules?: unknown
    standardPs1Template: DraftTemplateInput
    poolPs1Template?: DraftTemplateInput | null
  },
): { rows: PsConfigurationRows; auditEntries: AuditEntry[] } {
  requireDraftVersion(rows, input.configVersionId)

  const displayName = titleCase(input.displayName)
  const slug = slugify(displayName)
  if (!displayName || !slug) throw new Error('System name is required.')
  if (rows.systems.some((system) => system.configVersionId === input.configVersionId && system.slug === slug)) {
    throw new Error(`Draft system "${slug}" already exists.`)
  }

  const systemCategory = rows.optionCategories.find((category) => category.slug === 'system' && category.isActive)
  if (!systemCategory) throw new Error('System category is not available in this draft.')

  const isActive = input.isActive ?? true
  const archivedAt = isActive ? null : input.now
  const sortOrder = nextSortOrder(rows.systems.filter((system) => system.configVersionId === input.configVersionId))
  const system: SystemRow = {
    id: `draft-system:${input.configVersionId}:${slug}`,
    configVersionId: input.configVersionId,
    slug,
    displayName,
    state: 'draft',
    sortOrder,
    heightRules: input.heightRules ?? {},
    metadata: {},
    createdAt: input.now,
    updatedAt: input.now,
    archivedAt,
  }
  const option: OptionValueRow = {
    id: `draft-option:${input.configVersionId}:${systemCategory.id}:${slug}`,
    configVersionId: input.configVersionId,
    categoryId: systemCategory.id,
    slug,
    label: displayName,
    sortOrder,
    isActive,
    createdAt: input.now,
    updatedAt: input.now,
    archivedAt,
  }
  const rule: SystemOptionRuleRow = {
    id: `draft-rule:${input.configVersionId}:${slug}:system:${slug}`,
    systemId: system.id,
    optionValueId: option.id,
    isAllowed: true,
    createdAt: input.now,
    updatedAt: input.now,
  }
  const templates = [
    draftTemplateVariant(input, system, displayName, 'standard_ps1', input.standardPs1Template),
    ...(input.poolPs1Template ? [draftTemplateVariant(input, system, displayName, 'pool_ps1', input.poolPs1Template)] : []),
  ]

  const nextRows = {
    ...rows,
    systems: [...rows.systems, system],
    optionValues: [...rows.optionValues, option],
    systemOptionRules: [...rows.systemOptionRules, rule],
    templateVariants: [...rows.templateVariants, ...templates],
  }

  return finishRows(withAuditEntries(nextRows, [
    auditEntry(input, {
      entityType: 'system',
      entityId: system.id,
      action: 'draft_saved',
      configVersionId: input.configVersionId,
      before: null,
      after: system,
    }),
    auditEntry(input, {
      entityType: 'option_value',
      entityId: option.id,
      action: 'draft_saved',
      configVersionId: input.configVersionId,
      before: null,
      after: option,
    }),
    auditEntry(input, {
      entityType: 'system_option_rule',
      entityId: rule.id,
      action: 'draft_saved',
      configVersionId: input.configVersionId,
      before: null,
      after: rule,
    }),
    ...templates.map((template) => auditEntry(input, {
      entityType: 'template_variant',
      entityId: template.id,
      action: 'draft_saved',
      configVersionId: input.configVersionId,
      before: null,
      after: template,
    })),
  ]))
}

export function updateDraftSystemRow(
  rows: PsConfigurationRows,
  input: DraftActorInput & {
    configVersionId: string
    systemSlug: string
    displayName: string
    isActive?: boolean
    heightRules?: unknown
    standardPs1Template?: DraftTemplateInput | null
    poolPs1Template?: DraftTemplateInput | null
  },
): { rows: PsConfigurationRows; auditEntries: AuditEntry[] } {
  requireDraftVersion(rows, input.configVersionId)

  const before = rows.systems.find((system) => (
    system.configVersionId === input.configVersionId
    && system.slug === input.systemSlug
    && system.state === 'draft'
  ))
  if (!before) throw new Error(`Unknown draft system "${input.systemSlug}".`)

  const displayName = titleCase(input.displayName)
  if (!displayName) throw new Error('System display name is required.')
  const isActive = input.isActive ?? !before.archivedAt
  const after: SystemRow = {
    ...before,
    displayName,
    heightRules: input.heightRules ?? before.heightRules,
    archivedAt: isActive ? null : input.now,
    updatedAt: input.now,
  }
  let nextRows: PsConfigurationRows = {
    ...rows,
    systems: rows.systems.map((system) => system.id === before.id ? after : system),
  }
  const audits: AuditEntry[] = [auditEntry(input, {
    entityType: 'system',
    entityId: before.id,
    action: after.archivedAt !== before.archivedAt ? 'archived' : 'draft_saved',
    configVersionId: input.configVersionId,
    before,
    after,
  })]

  const systemCategory = rows.optionCategories.find((category) => category.slug === 'system')
  const option = systemCategory ? nextRows.optionValues.find((value) => (
    value.configVersionId === input.configVersionId
    && value.categoryId === systemCategory.id
    && value.slug === before.slug
  )) : null
  if (option) {
    const updatedOption: OptionValueRow = {
      ...option,
      label: displayName,
      isActive,
      archivedAt: isActive ? null : input.now,
      updatedAt: input.now,
    }
    nextRows = {
      ...nextRows,
      optionValues: nextRows.optionValues.map((value) => value.id === option.id ? updatedOption : value),
    }
    audits.push(auditEntry(input, {
      entityType: 'option_value',
      entityId: option.id,
      action: updatedOption.archivedAt !== option.archivedAt ? 'archived' : 'draft_saved',
      configVersionId: input.configVersionId,
      before: option,
      after: updatedOption,
    }))
  }

  for (const [variantKind, template] of [
    ['standard_ps1', input.standardPs1Template],
    ['pool_ps1', input.poolPs1Template],
  ] as const) {
    if (!template) continue
    const result = upsertDraftTemplateForSystem(nextRows, input, after, displayName, variantKind, template)
    nextRows = result.rows
    audits.push(result.audit)
  }

  return finishRows(withAuditEntries(nextRows, audits))
}

export function updateDraftSystemOptionRule(
  rows: PsConfigurationRows,
  input: DraftActorInput & {
    configVersionId: string
    systemSlug: string
    categorySlug: string
    optionSlug: string
    isAllowed: boolean
  },
): { rows: PsConfigurationRows; auditEntries: AuditEntry[] } {
  requireDraftVersion(rows, input.configVersionId)

  const system = rows.systems.find((candidate) => (
    candidate.configVersionId === input.configVersionId
    && candidate.slug === input.systemSlug
    && candidate.state === 'draft'
  ))
  if (!system) throw new Error(`Unknown draft system "${input.systemSlug}".`)

  const category = rows.optionCategories.find((candidate) => candidate.slug === input.categorySlug)
  if (!category) throw new Error(`Unknown PS option category "${input.categorySlug}".`)

  const option = rows.optionValues.find((candidate) => (
    candidate.configVersionId === input.configVersionId
    && candidate.categoryId === category.id
    && candidate.slug === input.optionSlug
  ))
  if (!option) throw new Error(`Unknown draft option value "${input.categorySlug}.${input.optionSlug}".`)

  const before = rows.systemOptionRules.find((rule) => (
    rule.systemId === system.id
    && rule.optionValueId === option.id
  ))
  if (!before && !input.isAllowed) return finishRows(rows)

  const after: SystemOptionRuleRow = {
    id: before?.id ?? `draft-rule:${input.configVersionId}:${system.slug}:${category.slug}:${option.slug}`,
    systemId: system.id,
    optionValueId: option.id,
    isAllowed: input.isAllowed,
    createdAt: before?.createdAt ?? input.now,
    updatedAt: input.now,
  }
  const audit = auditEntry(input, {
    entityType: 'system_option_rule',
    entityId: after.id,
    action: 'draft_saved',
    configVersionId: input.configVersionId,
    before: before ?? null,
    after,
  })

  return finishRows(withAudit({
    ...rows,
    systemOptionRules: before
      ? rows.systemOptionRules.map((rule) => rule.id === before.id ? after : rule)
      : [...rows.systemOptionRules, after],
  }, audit))
}

export function upsertDraftDescriptionTemplate(
  rows: PsConfigurationRows,
  input: DraftActorInput & {
    configVersionId: string
    slug: string
    label: string
    pattern: string
    archived?: boolean
  },
): { rows: PsConfigurationRows; auditEntries: AuditEntry[] } {
  requireDraftVersion(rows, input.configVersionId)

  const before = rows.descriptionTemplates.find((template) => (
    template.configVersionId === input.configVersionId
    && template.slug === input.slug
  ))
  const after: DescriptionTemplateRow = {
    id: before?.id ?? `draft-description:${input.configVersionId}:${input.slug}`,
    configVersionId: input.configVersionId,
    slug: input.slug,
    label: input.label,
    pattern: input.pattern,
    state: 'draft',
    createdAt: before?.createdAt ?? input.now,
    updatedAt: input.now,
    archivedAt: input.archived ? input.now : before?.archivedAt ?? null,
  }
  const audit = auditEntry(input, {
    entityType: 'description_template',
    entityId: after.id,
    action: input.archived ? 'archived' : 'draft_saved',
    configVersionId: input.configVersionId,
    before: before ?? null,
    after,
  })

  return finishRows(withAudit({
    ...rows,
    descriptionTemplates: before
      ? rows.descriptionTemplates.map((template) => template.id === before.id ? after : template)
      : [...rows.descriptionTemplates, after],
  }, audit))
}

export function replaceDraftTemplateVariant(
  rows: PsConfigurationRows,
  input: DraftActorInput & {
    configVersionId: string
    templateVariantId: string
    r2ObjectKey: string
    originalFilename: string
    fieldDiscovery: unknown
  },
): { rows: PsConfigurationRows; auditEntries: AuditEntry[] } {
  const before = rows.templateVariants.find((variant) => (
    variant.id === input.templateVariantId
    && variant.configVersionId === input.configVersionId
    && variant.state === 'draft'
  ))
  if (!before) throw new Error('Draft template variant was not found.')

  const after: TemplateVariantRow = {
    ...before,
    r2ObjectKey: input.r2ObjectKey,
    originalFilename: input.originalFilename,
    fieldDiscovery: input.fieldDiscovery,
    updatedAt: input.now,
  }

  const audit = auditEntry(input, {
    entityType: 'template_variant',
    entityId: before.id,
    action: 'draft_saved',
    configVersionId: input.configVersionId,
    before,
    after,
  })

  return finishRows(withAudit({
    ...rows,
    templateVariants: rows.templateVariants.map((variant) => variant.id === before.id ? after : variant),
  }, audit))
}

export function updateDraftFieldMapping(
  rows: PsConfigurationRows,
  input: DraftActorInput & {
    configVersionId: string
    templateVariantId: string
    fieldName: string
    fieldType: FieldMappingRow['fieldType']
    sourceType: FieldMappingRow['sourceType']
    sourceKey?: string | null
    fixedValue?: string | null
    checkboxValue?: boolean | null
    sortOrder?: number
    archived?: boolean
  },
): { rows: PsConfigurationRows; auditEntries: AuditEntry[] } {
  const template = rows.templateVariants.find((variant) => (
    variant.id === input.templateVariantId
    && variant.configVersionId === input.configVersionId
    && variant.state === 'draft'
  ))
  if (!template) throw new Error('Draft template variant was not found.')

  const before = rows.fieldMappings.find((mapping) => (
    mapping.templateVariantId === input.templateVariantId
    && mapping.fieldName === input.fieldName
  ))
  const after: FieldMappingRow = {
    id: before?.id ?? `draft-field:${input.configVersionId}:${input.templateVariantId}:${input.fieldName}`,
    templateVariantId: input.templateVariantId,
    fieldName: input.fieldName,
    fieldType: input.fieldType,
    sourceType: input.sourceType,
    sourceKey: input.sourceKey ?? null,
    fixedValue: input.fixedValue ?? null,
    checkboxValue: input.checkboxValue ?? null,
    sortOrder: input.sortOrder ?? before?.sortOrder ?? rows.fieldMappings.length,
    createdAt: before?.createdAt ?? input.now,
    updatedAt: input.now,
    archivedAt: input.archived ? input.now : null,
  }

  const audit = auditEntry(input, {
    entityType: 'field_mapping',
    entityId: after.id,
    action: input.archived ? 'archived' : 'draft_saved',
    configVersionId: input.configVersionId,
    before: before ?? null,
    after,
  })

  return finishRows(withAudit({
    ...rows,
    fieldMappings: before
      ? rows.fieldMappings.map((mapping) => mapping.id === before.id ? after : mapping)
      : [...rows.fieldMappings, after],
  }, audit))
}

export async function runDraftConfigurationTestGeneration(
  rows: PsConfigurationRows,
  input: DraftActorInput & {
    configVersionId: string
    input: GenerateProducerStatementPackageInput
    generator?: (
      input: GenerateProducerStatementPackageInput,
      dependencies: GenerateProducerStatementPackageDependencies & { configuration: PublishedPsConfiguration },
    ) => Promise<GenerateProducerStatementPackageResult>
  },
): Promise<GenerateProducerStatementPackageResult & { auditEntries: AuditEntry[] }> {
  const configuration = buildConfigurationReadModel(rows, input.configVersionId, 'draft')
  if (!configuration.versionLabel) throw new Error('Draft PS configuration was not found.')

  const generator = input.generator ?? generateProducerStatementPackage
  const result = await generator(input.input, {
    configuration,
    persistGeneratedOutputs: false,
    now: input.now,
    operationId: `draft-test:${input.configVersionId}`,
  })
  const audit = auditEntry(input, {
    entityType: 'config_version',
    entityId: input.configVersionId,
    action: 'test_generated',
    configVersionId: input.configVersionId,
    before: null,
    after: {
      mode: input.input.mode,
      outputCount: result.outputs.length,
    },
  })

  rows.auditEntries = [...(rows.auditEntries ?? []), audit]
  return { ...result, auditEntries: rows.auditEntries }
}

export function publishConfigurationDraft(
  rows: PsConfigurationRows,
  input: DraftActorInput & { configVersionId: string },
): { rows: PsConfigurationRows; auditEntries: AuditEntry[] } {
  const draft = rows.versions.find((version) => version.id === input.configVersionId && version.state === 'draft')
  if (!draft) throw new Error('Draft PS configuration was not found.')

  const archivedAt = input.now
  const before = { state: draft.state }
  const audit = auditEntry(input, {
    entityType: 'config_version',
    entityId: draft.id,
    action: 'published',
    configVersionId: draft.id,
    before,
    after: { state: 'published' },
  })

  return finishRows(withAudit({
    ...rows,
    versions: rows.versions.map((version) => {
      if (version.id === draft.id) {
        return { ...version, state: 'published', publishedAt: input.now, publishedBy: input.actorId, archivedAt: null }
      }
      if (version.state === 'published' && !version.archivedAt) {
        return { ...version, state: 'archived', archivedAt }
      }
      return version
    }),
    systems: publishVersionedRows(rows.systems, draft.id, archivedAt),
    templateVariants: publishVersionedRows(rows.templateVariants, draft.id, archivedAt),
    descriptionTemplates: publishVersionedRows(rows.descriptionTemplates, draft.id, archivedAt),
  }, audit))
}

function publishVersionedRows<T extends { configVersionId: string | null; state: string; archivedAt?: unknown; updatedAt?: unknown }>(
  rows: T[],
  draftVersionId: string,
  archivedAt: Date,
): T[] {
  return rows.map((row) => {
    if (row.configVersionId === draftVersionId && row.archivedAt) return { ...row, state: 'archived', updatedAt: archivedAt }
    if (row.configVersionId === draftVersionId) return { ...row, state: 'published', archivedAt: null, updatedAt: archivedAt }
    if (row.state === 'published' && !row.archivedAt) return { ...row, state: 'archived', archivedAt, updatedAt: archivedAt }
    return row
  })
}

function requireDraftVersion(rows: PsConfigurationRows, configVersionId: string): ConfigVersionRow {
  const version = rows.versions.find((candidate) => (
    candidate.id === configVersionId
    && candidate.state === 'draft'
    && !candidate.archivedAt
  ))
  if (!version) throw new Error('Draft PS configuration was not found.')
  return version
}

function latestPublishedVersion(rows: PsConfigurationRows): ConfigVersionRow | null {
  return rows.versions.find((version) => version.state === 'published' && !version.archivedAt) ?? null
}

function auditEntry(
  input: DraftActorInput,
  values: Omit<AuditEntry, 'actorId' | 'createdAt'>,
): AuditEntry {
  return {
    ...values,
    actorId: input.actorId,
    createdAt: input.now,
  }
}

function withAudit(rows: PsConfigurationRows, entry: AuditEntry): PsConfigurationRows {
  return {
    ...rows,
    auditEntries: [...(rows.auditEntries ?? []), entry],
  }
}

function withAuditEntries(rows: PsConfigurationRows, entries: AuditEntry[]): PsConfigurationRows {
  return {
    ...rows,
    auditEntries: [...(rows.auditEntries ?? []), ...entries],
  }
}

function finishRows(rows: PsConfigurationRows) {
  return { rows, auditEntries: rows.auditEntries ?? [] }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function titleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b[a-z0-9]/g, (letter) => letter.toUpperCase())
}

function nextSortOrder(rows: Array<{ sortOrder: number }>) {
  return rows.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 10
}

function draftTemplateVariant(
  input: DraftActorInput & { configVersionId: string },
  system: SystemRow,
  displayName: string,
  variantKind: 'standard_ps1' | 'pool_ps1',
  template: DraftTemplateInput,
): TemplateVariantRow {
  return {
    id: `draft-template:${input.configVersionId}:${system.slug}:${variantKind}`,
    systemId: system.id,
    configVersionId: input.configVersionId,
    documentKind: 'ps1',
    variantKind,
    label: variantKind === 'pool_ps1' ? `${displayName} Pool PS1` : `${displayName} PS1`,
    r2ObjectKey: template.r2ObjectKey,
    originalFilename: template.originalFilename,
    fieldDiscovery: template.fieldDiscovery,
    state: 'draft',
    createdAt: input.now,
    updatedAt: input.now,
    archivedAt: null,
  }
}

function upsertDraftTemplateForSystem(
  rows: PsConfigurationRows,
  input: DraftActorInput & { configVersionId: string },
  system: SystemRow,
  displayName: string,
  variantKind: 'standard_ps1' | 'pool_ps1',
  template: DraftTemplateInput,
): { rows: PsConfigurationRows; audit: AuditEntry } {
  const before = rows.templateVariants.find((candidate) => (
    candidate.configVersionId === input.configVersionId
    && candidate.systemId === system.id
    && candidate.variantKind === variantKind
    && candidate.state === 'draft'
  ))
  const after = before
    ? {
      ...before,
      label: variantKind === 'pool_ps1' ? `${displayName} Pool PS1` : `${displayName} PS1`,
      r2ObjectKey: template.r2ObjectKey,
      originalFilename: template.originalFilename,
      fieldDiscovery: template.fieldDiscovery,
      updatedAt: input.now,
      archivedAt: null,
    }
    : draftTemplateVariant(input, system, displayName, variantKind, template)

  return {
    rows: {
      ...rows,
      templateVariants: before
        ? rows.templateVariants.map((candidate) => candidate.id === before.id ? after : candidate)
        : [...rows.templateVariants, after],
    },
    audit: auditEntry(input, {
      entityType: 'template_variant',
      entityId: after.id,
      action: 'draft_saved',
      configVersionId: input.configVersionId,
      before: before ?? null,
      after,
    }),
  }
}
