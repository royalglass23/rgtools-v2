import { randomUUID } from 'node:crypto'

import { PDFDocument } from 'pdf-lib'

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

interface GenerationContext {
  configuration: PublishedPsConfiguration
  system: PublishedPsSystem
  input: GenerateProducerStatementPackageInput
  now: Date
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
    throw new PsGenerationError('published_system_missing', `Published system "${input.selections.system}" is not available.`, {
      systemSlug: input.selections.system,
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
    if (template.fieldMappings.length === 0) {
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
      bytes: await fillTemplatePdf(templateBytes, template, context),
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

  const preferredKind = selections.gate_required === 'yes'
    ? 'gate_ps1'
    : selections.structure_type === 'pool-fence'
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
      throw new PsGenerationError('selected_option_not_allowed', `Option "${optionSlug}" is not allowed for ${system.displayName}.`, {
        categorySlug,
        optionSlug,
        systemSlug: system.slug,
      })
    }
  }
}

async function fillTemplatePdf(
  templateBytes: Buffer,
  template: PublishedPsTemplateVariant,
  context: GenerationContext,
): Promise<Buffer> {
  const pdf = await PDFDocument.load(toUint8Array(templateBytes))
  const form = pdf.getForm()

  for (const mapping of template.fieldMappings) {
    if (mapping.fieldType === 'text') {
      try {
        form.getTextField(mapping.fieldName).setText(resolveTextValue(mapping, context))
      } catch (err) {
        throw new PsGenerationError('pdf_text_field_missing', `Template "${template.label}" is missing text field "${mapping.fieldName}".`, {
          templateVariantId: template.id,
          fieldName: mapping.fieldName,
          cause: errorMessage(err),
        })
      }
      continue
    }

    if (mapping.fieldType === 'checkbox') {
      try {
        const checkbox = form.getCheckBox(mapping.fieldName)
        if (resolveCheckboxValue(mapping, context)) checkbox.check()
        else checkbox.uncheck()
      } catch (err) {
        throw new PsGenerationError('pdf_checkbox_field_missing', `Template "${template.label}" is missing checkbox field "${mapping.fieldName}".`, {
          templateVariantId: template.id,
          fieldName: mapping.fieldName,
          cause: errorMessage(err),
        })
      }
      continue
    }

    throw new PsGenerationError('unsupported_field_type', `Unsupported field type "${mapping.fieldType}" for "${mapping.fieldName}".`, {
      templateVariantId: template.id,
      fieldName: mapping.fieldName,
      fieldType: mapping.fieldType,
    })
  }

  return Buffer.from(await pdf.save())
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
      throw new PsGenerationError('unsupported_source_type', `Unsupported mapping source type "${mapping.sourceType}" for "${mapping.fieldName}".`, {
        fieldName: mapping.fieldName,
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
    throw new PsGenerationError('description_template_missing', `Description template "${slug}" is not published.`, {
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

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function toUint8Array(bytes: Buffer): Uint8Array {
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

async function loadDefaultDb(): Promise<PsGenerationDatabase> {
  const { db } = await import('@/lib/db')
  return db as unknown as PsGenerationDatabase
}
