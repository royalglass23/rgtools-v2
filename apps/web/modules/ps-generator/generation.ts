import { randomUUID } from 'node:crypto'

import { PDFCheckBox, PDFDocument, PDFTextField, type PDFForm } from 'pdf-lib'

import { getStorage } from '@/lib/storage'
import type { QuoteStorage } from '@/lib/storage/types'
import {
  psGeneratedPdfObjects,
  psGenerationEvents,
} from '@rgtools/db/schema-ps-generator'
import {
  getPublishedPsConfiguration,
  type PublishedPsConfiguration,
  type PublishedPsSystem,
  type PublishedPsTemplateVariant,
} from './configuration'
import { PS_GENERATOR_LEGACY_PS1_FIELD_MAPPINGS } from './seed-config'

export type PsGenerationMode = 'ps1_only' | 'ps3_only' | 'both'
export type PsGeneratedDocumentKind = 'ps1' | 'ps3'

export interface PsProjectDetails {
  clientName: string
  jobAddress: string
  bcNumber?: string | null
  jobNumber?: string | null
  lotDescription?: string | null
  [key: string]: string | number | boolean | null | undefined
}

export interface GenerateProducerStatementPackageInput {
  mode: PsGenerationMode
  projectDetails: PsProjectDetails
  selections: Record<string, string>
}

export interface GenerateProducerStatementPackageDependencies {
  configuration?: PublishedPsConfiguration
  getConfiguration?: () => Promise<PublishedPsConfiguration>
  storage?: QuoteStorage
  now?: Date
  operationId?: string
  persistGeneratedOutputs?: boolean
  actor?: PsGenerationActor
  database?: PsGenerationDatabase
  retentionDays?: number
  flattenGeneratedPdf?: boolean
}

export interface GeneratedProducerStatementPdf {
  documentKind: PsGeneratedDocumentKind
  templateVariantId: string
  templateLabel: string
  sourceObjectKey: string
  r2ObjectKey?: string
  filename: string
  contentType: 'application/pdf'
  bytes: Buffer
}

export interface GenerateProducerStatementPackageResult {
  operationId: string
  mode: PsGenerationMode
  versionLabel: string
  outputs: GeneratedProducerStatementPdf[]
}

export class PsGenerationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'PsGenerationError'
  }
}

const PROJECT_FIELD_LABELS: Record<string, string> = {
  clientName: 'Client name',
  jobAddress: 'Job address',
  bcNumber: 'BC Number',
  lotDescription: 'Lot Description',
}

const FIELD_NAME_LABELS: Record<string, string> = {
  client_name: 'Client name',
  job_address: 'Job address',
  bc_number: 'BC Number',
  lot_description: 'Lot Description',
  completion_date: 'Completion Date',
  pool_description: 'Pool Description',
}

const OPTION_LABELS: Record<string, string> = {
  system: 'System',
  structure_material: 'Structure material',
  structure_type: 'Structure type',
  location: 'Location',
  structure_built: 'Structure built',
  glass_type: 'Glass type',
  thickness: 'Thickness',
  gate_required: 'Gate required',
}

export function humanizePsIdentifier(value: string | null | undefined): string {
  if (!value) return ''
  return PROJECT_FIELD_LABELS[value]
    ?? FIELD_NAME_LABELS[value]
    ?? OPTION_LABELS[value]
    ?? value
      .split(/[_.-]+/g)
      .filter(Boolean)
      .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
      .join(' ')
}

export function humanizePsGenerationMessage(message: string): string {
  return message.replace(/"([a-z][a-z0-9_.-]*)"/g, (_match, identifier: string) => `"${humanizePsIdentifier(identifier)}"`)
}

interface GenerationContext {
  configuration: PublishedPsConfiguration
  system: PublishedPsSystem
  input: GenerateProducerStatementPackageInput
  now: Date
}

type PsResolvedFieldMapping = PublishedPsTemplateVariant['fieldMappings'][number] & {
  legacyDefault?: boolean
}

export interface PsGenerationActor {
  id: string
  label: string
}

interface PsGenerationDatabase {
  insert: (table: unknown) => {
    values: (values: unknown) => {
      returning?: (fields?: unknown) => Promise<Array<{ id: string }>>
    }
  }
}

export async function generateProducerStatementPackage(
  input: GenerateProducerStatementPackageInput,
  dependencies: GenerateProducerStatementPackageDependencies = {},
): Promise<GenerateProducerStatementPackageResult> {
  const configuration = dependencies.configuration
    ?? (dependencies.getConfiguration ? await dependencies.getConfiguration() : await getPublishedPsConfiguration())
  const storage = dependencies.storage ?? getStorage()
  const now = dependencies.now ?? new Date()

  if (!configuration.versionLabel) {
    throw new PsGenerationError('published_config_missing', 'No published PS Generator configuration is available.')
  }

  const system = configuration.systems.find((candidate) => candidate.slug === input.selections.system)
  if (!system) {
    throw new PsGenerationError('published_system_missing', `Published system "${humanizePsIdentifier(input.selections.system)}" is not available.`, {
      systemSlug: input.selections.system,
      systemLabel: humanizePsIdentifier(input.selections.system),
    })
  }

  validateSelectedOptions(system, input.selections)

  const context: GenerationContext = { configuration, system, input, now }
  const operationId = dependencies.operationId ?? randomUUID()
  const outputs: GeneratedProducerStatementPdf[] = []

  for (const documentKind of documentKindsForMode(input.mode)) {
    const template = selectTemplateVariant(configuration, system.slug, documentKind, input.selections)
    if (!template) {
      throw new PsGenerationError('published_template_missing', `No published ${documentKind.toUpperCase()} template is available for ${system.displayName}.`, {
        systemSlug: system.slug,
        documentKind,
      })
    }
    const fieldMappings = fieldMappingsWithLegacyDefaults(template)
    if (fieldMappings.length === 0) {
      throw new PsGenerationError('field_mappings_missing', `Published template "${template.label}" has no field mappings.`, {
        templateVariantId: template.id,
      })
    }

    const templateBytes = await storage.get(template.r2ObjectKey)
    if (!templateBytes) {
      throw new PsGenerationError('template_pdf_missing', `Template PDF "${template.r2ObjectKey}" could not be found in storage.`, {
        templateVariantId: template.id,
        r2ObjectKey: template.r2ObjectKey,
      })
    }

    const filename = buildFilename(input, documentKind)
    outputs.push({
      documentKind,
      templateVariantId: template.id,
      templateLabel: template.label,
      sourceObjectKey: template.r2ObjectKey,
      r2ObjectKey: dependencies.persistGeneratedOutputs ? buildGeneratedObjectKey(operationId, filename) : undefined,
      filename,
      contentType: 'application/pdf',
      bytes: await fillTemplatePdf(templateBytes, template, fieldMappings, context, dependencies.flattenGeneratedPdf !== false),
    })
  }

  if (dependencies.persistGeneratedOutputs) {
    await persistGeneratedPackage({
      input,
      configuration,
      system,
      outputs,
      storage,
      database: dependencies.database ?? await loadDefaultDb(),
      actor: dependencies.actor,
      now,
      retainedUntil: addDays(now, dependencies.retentionDays ?? 90),
    })
  }

  return {
    operationId,
    mode: input.mode,
    versionLabel: configuration.versionLabel,
    outputs,
  }
}

async function persistGeneratedPackage({
  input,
  configuration,
  system,
  outputs,
  storage,
  database,
  actor,
  now,
  retainedUntil,
}: {
  input: GenerateProducerStatementPackageInput
  configuration: PublishedPsConfiguration
  system: PublishedPsSystem
  outputs: GeneratedProducerStatementPdf[]
  storage: QuoteStorage
  database: PsGenerationDatabase
  actor?: PsGenerationActor
  now: Date
  retainedUntil: Date
}) {
  if (!actor) {
    throw new PsGenerationError('generation_actor_missing', 'A generation actor is required when persisting generated PDFs.')
  }

  for (const output of outputs) {
    if (!output.r2ObjectKey) {
      throw new PsGenerationError('generated_object_key_missing', `No generated object key was prepared for ${output.filename}.`)
    }
    await storage.put(output.r2ObjectKey, output.bytes, output.contentType)
  }

  const [event] = await database.insert(psGenerationEvents).values({
    actorId: actor.id,
    actorLabel: actor.label,
    configVersionId: configuration.versionId ?? null,
    generationMode: input.mode,
    jobNumber: normalizeOptionalText(input.projectDetails.jobNumber),
    clientName: input.projectDetails.clientName,
    jobAddress: input.projectDetails.jobAddress,
    bcNumber: normalizeOptionalText(input.projectDetails.bcNumber),
    lotDescription: normalizeOptionalText(input.projectDetails.lotDescription),
    selectionsSnapshot: buildSelectionsSnapshot(configuration, system, input.selections),
    descriptionSnapshot: buildDescriptionSnapshot(outputs, configuration, system, input, now),
    createdAt: now,
  }).returning?.({ id: psGenerationEvents.id }) ?? []

  if (!event?.id) {
    throw new PsGenerationError('generation_record_missing', 'Generation record could not be created.')
  }

  await database.insert(psGeneratedPdfObjects).values(outputs.map((output) => ({
    generationEventId: event.id,
    documentKind: output.documentKind,
    r2ObjectKey: output.r2ObjectKey!,
    filename: output.filename,
    retainedUntil,
    createdAt: now,
  })))
}

function documentKindsForMode(mode: PsGenerationMode): PsGeneratedDocumentKind[] {
  if (mode === 'ps1_only') return ['ps1']
  if (mode === 'ps3_only') return ['ps3']
  return ['ps1', 'ps3']
}

function buildGeneratedObjectKey(operationId: string, filename: string): string {
  return `ps-generator/generated/${operationId}/${filename}`
}

function buildSelectionsSnapshot(
  configuration: PublishedPsConfiguration,
  system: PublishedPsSystem,
  selections: Record<string, string>,
) {
  const categoriesBySlug = new Map(configuration.optionCategories.map((category) => [category.slug, category]))
  const options: Record<string, { categoryLabel: string; slug: string; label: string }> = {}

  for (const [categorySlug, selectedSlug] of Object.entries(selections)) {
    if (categorySlug === 'system') continue
    const category = categoriesBySlug.get(categorySlug)
    const label = system.optionRules[categorySlug]?.find((value) => value.slug === selectedSlug)?.label ?? selectedSlug
    options[categorySlug] = {
      categoryLabel: category?.label ?? categorySlug,
      slug: selectedSlug,
      label,
    }
  }

  return {
    configVersionId: configuration.versionId ?? null,
    configVersionLabel: configuration.versionLabel,
    system: {
      id: system.id ?? null,
      slug: system.slug,
      label: system.displayName,
    },
    options,
  }
}

function buildDescriptionSnapshot(
  outputs: GeneratedProducerStatementPdf[],
  configuration: PublishedPsConfiguration,
  system: PublishedPsSystem,
  input: GenerateProducerStatementPackageInput,
  now: Date,
) {
  const context: GenerationContext = { configuration, system, input, now }

  return {
    templates: outputs.map((output) => {
      const variant = configuration.templateVariants.find((candidate) => candidate.id === output.templateVariantId)
      return {
        documentKind: output.documentKind,
        templateVariantId: output.templateVariantId,
        templateLabel: output.templateLabel,
        sourceObjectKey: output.sourceObjectKey,
        generatedDescription: resolveTemplateDescription(variant, context),
      }
    }),
  }
}

function resolveTemplateDescription(
  template: PublishedPsTemplateVariant | undefined,
  context: GenerationContext,
): string | null {
  const mapping = template?.fieldMappings.find((candidate) => candidate.sourceType === 'description_template')
  return mapping ? resolveDescriptionTemplate(context, mapping.sourceKey) : null
}

function selectTemplateVariant(
  configuration: PublishedPsConfiguration,
  systemSlug: string,
  documentKind: PsGeneratedDocumentKind,
  selections: Record<string, string>,
): PublishedPsTemplateVariant | null {
  const candidates = configuration.templateVariants.filter((variant) => (
    variant.systemSlug === systemSlug && variant.documentKind === documentKind
  ))
  if (documentKind === 'ps3') return candidates.find((variant) => variant.variantKind === 'ps3') ?? candidates[0] ?? null

  const preferredKind = selections.structure_type === 'pool-fence'
    ? 'pool_ps1'
    : 'standard_ps1'

  return candidates.find((variant) => variant.variantKind === preferredKind)
    ?? candidates.find((variant) => variant.variantKind === 'standard_ps1')
    ?? candidates[0]
    ?? null
}

function validateSelectedOptions(system: PublishedPsSystem, selections: Record<string, string>) {
  for (const [categorySlug, optionSlug] of Object.entries(selections)) {
    const allowedValues = system.optionRules[categorySlug]
    if (!allowedValues) continue
    if (!allowedValues.some((value) => value.slug === optionSlug)) {
      throw new PsGenerationError('selected_option_not_allowed', `Option "${humanizePsIdentifier(optionSlug)}" is not allowed for ${system.displayName}.`, {
        categorySlug,
        categoryLabel: humanizePsIdentifier(categorySlug),
        optionSlug,
        optionLabel: humanizePsIdentifier(optionSlug),
        systemSlug: system.slug,
        systemLabel: system.displayName,
      })
    }
  }
}

async function fillTemplatePdf(
  templateBytes: Buffer,
  template: PublishedPsTemplateVariant,
  fieldMappings: PsResolvedFieldMapping[],
  context: GenerationContext,
  flattenGeneratedPdf: boolean,
): Promise<Buffer> {
  const pdf = await PDFDocument.load(toUint8Array(templateBytes))
  const form = pdf.getForm()

  for (const mapping of fieldMappings) {
    if (mapping.fieldType === 'text') {
      const textValue = resolveTextValue(mapping, context)
      const field = findTextField(form, mapping)
      if (!field) {
        if (isOptionalBlankProjectField(mapping, textValue)) continue
        if (mapping.legacyDefault) continue

        const fieldLabel = fieldLabelForMapping(mapping)
        throw new PsGenerationError('pdf_text_field_missing', `Template "${template.label}" is missing text field "${fieldLabel}".`, {
          templateVariantId: template.id,
          fieldName: mapping.fieldName,
          fieldLabel,
          availableFields: availableTextFields(form),
        })
      }
      field.setText(textValue)
      continue
    }

    if (mapping.fieldType === 'checkbox') {
      const checkbox = findCheckBox(form, mapping)
      if (!checkbox) {
        if (mapping.legacyDefault) continue

        const fieldLabel = fieldLabelForMapping(mapping)
        throw new PsGenerationError('pdf_checkbox_field_missing', `Template "${template.label}" is missing checkbox field "${fieldLabel}".`, {
          templateVariantId: template.id,
          fieldName: mapping.fieldName,
          fieldLabel,
          availableFields: availableCheckBoxFields(form),
        })
      }
      if (resolveCheckboxValue(mapping, context)) checkbox.check()
      else checkbox.uncheck()
      continue
    }

    throw new PsGenerationError('unsupported_field_type', `Unsupported field type "${humanizePsIdentifier(mapping.fieldType)}" for "${fieldLabelForMapping(mapping)}".`, {
      templateVariantId: template.id,
      fieldName: mapping.fieldName,
      fieldLabel: fieldLabelForMapping(mapping),
      fieldType: mapping.fieldType,
    })
  }

  if (flattenGeneratedPdf) form.flatten({ updateFieldAppearances: true })

  return Buffer.from(await pdf.save())
}

function fieldMappingsWithLegacyDefaults(
  template: PublishedPsTemplateVariant,
): PsResolvedFieldMapping[] {
  if (template.documentKind !== 'ps1') return template.fieldMappings

  const discovered = discoveredTemplateFields(template.fieldDiscovery)
  if (discovered.size === 0) return template.fieldMappings

  const existing = new Set(template.fieldMappings.map(mappingSemanticKey))
  const defaults = PS_GENERATOR_LEGACY_PS1_FIELD_MAPPINGS
    .filter((mapping) => discovered.has(mapping.fieldName))
    .filter((mapping) => !existing.has(mappingSemanticKey(mapping)))
    .map((mapping) => ({
      fieldName: mapping.fieldName,
      fieldType: mapping.fieldType,
      sourceType: mapping.sourceType,
      sourceKey: mapping.sourceKey ?? null,
      fixedValue: mapping.fixedValue ?? null,
      checkboxValue: mapping.checkboxValue ?? null,
      legacyDefault: true,
    }))

  return defaults.length > 0 ? [...template.fieldMappings, ...defaults] : template.fieldMappings
}

function discoveredTemplateFields(fieldDiscovery: unknown): Set<string> {
  if (!fieldDiscovery || typeof fieldDiscovery !== 'object') return new Set()

  const discovery = fieldDiscovery as { text?: unknown; checkbox?: unknown; fields?: unknown }
  return new Set([
    ...arrayOfStrings(discovery.text),
    ...arrayOfStrings(discovery.checkbox),
    ...arrayOfStrings(discovery.fields),
  ])
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function mappingSemanticKey(mapping: {
  fieldName: string
  fieldType: 'text' | 'checkbox'
  sourceType: 'project_value' | 'selected_option' | 'system_rule' | 'description_template' | 'date' | 'fixed_value'
  sourceKey?: string | null
  fixedValue?: string | null
  checkboxValue?: boolean | null
}) {
  return [
    mapping.fieldType,
    mapping.sourceType,
    mapping.sourceKey ?? '',
    mapping.fixedValue ?? '',
    mapping.checkboxValue === null || mapping.checkboxValue === undefined ? '' : String(mapping.checkboxValue),
  ].join(':')
}

function findTextField(
  form: PDFForm,
  mapping: PublishedPsTemplateVariant['fieldMappings'][number],
): PDFTextField | null {
  for (const fieldName of candidateFieldNames(mapping)) {
    try {
      return form.getTextField(fieldName)
    } catch {
      // Try the next known alias.
    }
  }

  return findNormalizedTextField(form, candidateFieldNames(mapping))
}

function findCheckBox(
  form: PDFForm,
  mapping: PublishedPsTemplateVariant['fieldMappings'][number],
): PDFCheckBox | null {
  for (const fieldName of candidateFieldNames(mapping)) {
    try {
      return form.getCheckBox(fieldName)
    } catch {
      // Try the next known alias.
    }
  }

  return findNormalizedCheckBox(form, candidateFieldNames(mapping))
}

function findNormalizedTextField(
  form: PDFForm,
  fieldNames: string[],
): PDFTextField | null {
  const normalizedNames = new Set(fieldNames.map(normalizeFieldName))
  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) continue
    if (normalizedNames.has(normalizeFieldName(field.getName()))) return field
  }
  return null
}

function findNormalizedCheckBox(
  form: PDFForm,
  fieldNames: string[],
): PDFCheckBox | null {
  const normalizedNames = new Set(fieldNames.map(normalizeFieldName))
  for (const field of form.getFields()) {
    if (!(field instanceof PDFCheckBox)) continue
    if (normalizedNames.has(normalizeFieldName(field.getName()))) return field
  }
  return null
}

function candidateFieldNames(mapping: PublishedPsTemplateVariant['fieldMappings'][number]): string[] {
  return uniqueStrings([
    mapping.fieldName,
    ...legacyWordPressAliases(mapping),
  ])
}

function legacyWordPressAliases(mapping: PublishedPsTemplateVariant['fieldMappings'][number]): string[] {
  const key = mapping.sourceKey ?? mapping.fieldName

  if (mapping.sourceType === 'project_value') {
    if (key === 'clientName') return ['client_name', 'clientName', 'ClientName', 'Client Name', 'Name']
    if (key === 'jobAddress') return ['job_address', 'jobAddress', 'JobAddress', 'Job Address', 'Address']
    if (key === 'bcNumber') return ['bc_number', 'bcNumber', 'BC Number', 'BCNumber']
    if (key === 'lotDescription') return ['lot_description', 'lotDescription', 'Lot Description', 'LotDescription']
  }

  if (mapping.sourceType === 'description_template') {
    return ['description', 'Description', 'pool_description', 'Pool Description']
  }

  if (mapping.sourceType === 'date') {
    return ['completion_date', 'Completion Date', 'Date0', 'Date']
  }

  if (mapping.sourceType === 'selected_option') {
    return selectedOptionAliases(key)
  }

  if (mapping.sourceType === 'system_rule') {
    if (key === 'heightRules.default.height') return ['height', 'Height']
    if (key === 'heightRules.default.heightAboveFix') return ['height_above_fix', 'HeightAboveFix', 'Height Above Fix']
  }

  return []
}

function selectedOptionAliases(sourceKey: string | null): string[] {
  switch (sourceKey) {
    case 'thickness':
      return ['thickness', 'Thickness']
    case 'structure_material.timber':
      return ['structure_material_timber', 'TimberTB']
    case 'structure_material.concrete':
      return ['structure_material_concrete', 'ConcreteTB']
    case 'structure_material.steel':
      return ['structure_material_steel', 'SteelTB']
    case 'location.internal':
      return ['location_internal', 'InternalTB']
    case 'location.external':
      return ['location_external', 'ExternalTB']
    case 'structure_built.new':
      return ['structure_built_new', 'NewTB']
    case 'structure_built.existing':
      return ['structure_built_existing', 'ExistingTB']
    case 'glass_type.toughened':
      return ['glass_type_toughened', 'ToughenedTB']
    case 'glass_type.laminated':
      return ['glass_type_laminated', 'LaminatedTB']
    default:
      return []
  }
}

function availableTextFields(form: PDFForm): string[] {
  return form.getFields()
    .filter((field) => field instanceof PDFTextField)
    .map((field) => field.getName())
    .sort((a, b) => a.localeCompare(b))
}

function availableCheckBoxFields(form: PDFForm): string[] {
  return form.getFields()
    .filter((field) => field instanceof PDFCheckBox)
    .map((field) => field.getName())
    .sort((a, b) => a.localeCompare(b))
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function normalizeFieldName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isOptionalBlankProjectField(
  mapping: PublishedPsTemplateVariant['fieldMappings'][number],
  textValue: string,
): boolean {
  return mapping.sourceType === 'project_value'
    && (mapping.sourceKey === 'bcNumber' || mapping.sourceKey === 'lotDescription')
    && textValue.trim().length === 0
}

function fieldLabelForMapping(mapping: PublishedPsTemplateVariant['fieldMappings'][number]): string {
  return humanizePsIdentifier(mapping.sourceKey) || humanizePsIdentifier(mapping.fieldName)
}

function resolveTextValue(
  mapping: PublishedPsTemplateVariant['fieldMappings'][number],
  context: GenerationContext,
): string {
  switch (mapping.sourceType) {
    case 'project_value':
      return stringify(context.input.projectDetails[mapping.sourceKey ?? ''])
    case 'selected_option':
      return selectedOptionLabel(context, mapping.sourceKey)
    case 'system_rule':
      return stringify(readSystemRule(context.system, mapping.sourceKey))
    case 'description_template':
      return resolveDescriptionTemplate(context, mapping.sourceKey)
    case 'date':
      return formatDate(context.now)
    case 'fixed_value':
      return mapping.fixedValue ?? ''
    default:
      throw new PsGenerationError('unsupported_source_type', `Unsupported mapping source type "${humanizePsIdentifier(mapping.sourceType)}" for "${fieldLabelForMapping(mapping)}".`, {
        fieldName: mapping.fieldName,
        fieldLabel: fieldLabelForMapping(mapping),
        sourceType: mapping.sourceType,
      })
  }
}

function resolveCheckboxValue(
  mapping: PublishedPsTemplateVariant['fieldMappings'][number],
  context: GenerationContext,
): boolean {
  if (mapping.sourceType === 'fixed_value') return mapping.checkboxValue ?? mapping.fixedValue === 'true'
  if (mapping.sourceType === 'selected_option') {
    const selected = selectedOptionMatches(context.input.selections, mapping.sourceKey)
    return mapping.checkboxValue === false ? !selected : selected
  }

  return resolveTextValue(mapping, context).toLowerCase() === 'true'
}

function resolveDescriptionTemplate(context: GenerationContext, slug: string | null): string {
  const template = context.configuration.descriptionTemplates.find((candidate) => candidate.slug === slug)
  if (!template) {
    throw new PsGenerationError('description_template_missing', `Description template "${humanizePsIdentifier(slug)}" is not published.`, {
      slug,
    })
  }

  return template.pattern.replace(/\{([^}]+)\}/g, (_match, token: string) => tokenValue(context, token.trim()))
}

function tokenValue(context: GenerationContext, token: string): string {
  if (token === 'system') return context.system.displayName
  if (token in context.input.projectDetails) return stringify(context.input.projectDetails[token])

  const selectedSlug = context.input.selections[token]
  if (!selectedSlug) return ''
  return context.system.optionRules[token]?.find((value) => value.slug === selectedSlug)?.label ?? selectedSlug
}

function selectedOptionLabel(context: GenerationContext, sourceKey: string | null): string {
  if (!sourceKey) return ''
  const [categorySlug, expectedSlug] = sourceKey.split('.')
  const selectedSlug = context.input.selections[categorySlug]
  const optionSlug = expectedSlug ?? selectedSlug
  return context.system.optionRules[categorySlug]?.find((value) => value.slug === optionSlug)?.label ?? optionSlug ?? ''
}

function selectedOptionMatches(selections: Record<string, string>, sourceKey: string | null): boolean {
  if (!sourceKey) return false
  const [categorySlug, expectedSlug] = sourceKey.split('.')
  return selections[categorySlug] === expectedSlug
}

function readSystemRule(system: PublishedPsSystem, sourceKey: string | null): unknown {
  if (!sourceKey) return null
  const source = { heightRules: system.heightRules, metadata: system.metadata }
  return sourceKey.split('.').reduce<unknown>((value, key) => (
    value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : null
  ), source)
}

function buildFilename(input: GenerateProducerStatementPackageInput, documentKind: PsGeneratedDocumentKind): string {
  const jobPart = input.projectDetails.jobNumber ? `${input.projectDetails.jobNumber}-` : ''
  return `${jobPart}${documentKind.toUpperCase()}-${input.projectDetails.clientName}.pdf`.replace(/[^\w.-]+/g, '-')
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function normalizeOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function toUint8Array(bytes: Buffer): Uint8Array {
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

async function loadDefaultDb(): Promise<PsGenerationDatabase> {
  const { db } = await import('@/lib/db')
  return db as unknown as PsGenerationDatabase
}
