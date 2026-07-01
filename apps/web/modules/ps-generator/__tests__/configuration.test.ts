import { describe, expect, it } from 'vitest'
import {
  buildPublishedPsConfigurationReadModel,
  createPsGeneratorSeedRows,
} from '../configuration'
import {
  createConfigurationDraft,
  runDraftConfigurationTestGeneration,
  updateDraftFieldMapping,
  publishConfigurationDraft,
  replaceDraftTemplateVariant,
  updateDraftOptionValue,
} from '../configuration-drafts'
import { PS_GENERATOR_OPTION_CATEGORIES } from '../config'

describe('published PS Generator configuration', () => {
  it('exposes the seeded WordPress configuration through the application read model', () => {
    const configuration = buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows())

    expect(configuration.versionLabel).toBe('wordpress-plugin-v1')
    expect(configuration.systems.map((system) => system.slug)).toEqual([
      'double-disc',
      'frameless-spigot',
    ])
    expect(configuration.optionCategories.map((category) => category.slug)).toEqual([
      ...PS_GENERATOR_OPTION_CATEGORIES,
    ])
    expect(configuration.optionCategories.find((category) => category.slug === 'structure_material')?.values).toEqual([
      { slug: 'timber', label: 'Timber' },
      { slug: 'steel', label: 'Steel' },
      { slug: 'aluminium', label: 'Aluminium' },
    ])
    expect(configuration.systems.find((system) => system.slug === 'double-disc')?.optionRules).toMatchObject({
      system: [{ slug: 'double-disc', label: 'Double Disc' }],
      structure_material: [
        { slug: 'timber', label: 'Timber' },
        { slug: 'steel', label: 'Steel' },
        { slug: 'aluminium', label: 'Aluminium' },
      ],
      gate_required: [
        { slug: 'no', label: 'No' },
        { slug: 'yes', label: 'Yes' },
      ],
    })
    expect(configuration.templateVariants.map((variant) => variant.variantKind)).toEqual([
      'gate_ps1',
      'pool_ps1',
      'standard_ps1',
      'ps3',
    ])
    expect(configuration.templateVariants.find((variant) => variant.variantKind === 'standard_ps1')?.fieldMappings).toEqual([
      {
        fieldName: 'client_name',
        fieldType: 'text',
        sourceType: 'project_value',
        sourceKey: 'clientName',
        fixedValue: null,
        checkboxValue: null,
      },
      {
        fieldName: 'job_address',
        fieldType: 'text',
        sourceType: 'project_value',
        sourceKey: 'jobAddress',
        fixedValue: null,
        checkboxValue: null,
      },
      {
        fieldName: 'bc_number',
        fieldType: 'text',
        sourceType: 'project_value',
        sourceKey: 'bcNumber',
        fixedValue: null,
        checkboxValue: null,
      },
      {
        fieldName: 'description',
        fieldType: 'text',
        sourceType: 'description_template',
        sourceKey: 'standard-balustrade',
        fixedValue: null,
        checkboxValue: null,
      },
    ])
    expect(configuration.descriptionTemplates.map((template) => template.slug)).toEqual([
      'gate-balustrade',
      'standard-balustrade',
    ])
  })

  it('does not treat archived systems or disabled option values as staff-facing choices', () => {
    const configuration = buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows())

    expect(configuration.systems.map((system) => system.slug)).not.toContain('legacy-face-fixed')
    expect(configuration.optionCategories.find((category) => category.slug === 'system')?.values).not.toContainEqual({
      slug: 'legacy-face-fixed',
      label: 'Legacy Face Fixed',
    })
    expect(configuration.systems.flatMap((system) => (
      Object.values(system.optionRules).flatMap((values) => values.map((value) => value.slug))
    ))).not.toContain('legacy-face-fixed')
  })

  it('keeps draft option value edits isolated until the draft is published and audited', () => {
    const now = new Date('2026-06-30T00:00:00.000Z')
    let rows = createPsGeneratorSeedRows()

    const draft = createConfigurationDraft(rows, {
      actorId: 'admin-1',
      draftVersionLabel: 'wordpress-plugin-v2-draft',
      now,
    })
    rows = draft.rows
    rows = updateDraftOptionValue(rows, {
      actorId: 'admin-1',
      configVersionId: draft.configVersionId,
      categorySlug: 'structure_material',
      optionSlug: 'timber',
      label: 'Timber framing',
      now,
    }).rows

    expect(buildPublishedPsConfigurationReadModel(rows)
      .optionCategories.find((category) => category.slug === 'structure_material')?.values[0]).toEqual({
        slug: 'timber',
        label: 'Timber',
      })

    const published = publishConfigurationDraft(rows, {
      actorId: 'publisher-1',
      configVersionId: draft.configVersionId,
      now,
    })

    const configuration = buildPublishedPsConfigurationReadModel(published.rows)
    expect(configuration.versionLabel).toBe('wordpress-plugin-v2-draft')
    expect(configuration.optionCategories.find((category) => category.slug === 'structure_material')?.values[0]).toEqual({
      slug: 'timber',
      label: 'Timber framing',
    })
    expect(published.auditEntries.map((entry) => entry.action)).toEqual([
      'draft_saved',
      'draft_saved',
      'published',
    ])
    expect(published.auditEntries.at(-1)).toMatchObject({
      actorId: 'publisher-1',
      entityType: 'config_version',
      entityId: draft.configVersionId,
      before: { state: 'draft' },
      after: { state: 'published' },
    })
  })

  it('updates draft templates and field mappings without publishing or retaining test output', async () => {
    const now = new Date('2026-06-30T00:00:00.000Z')
    let rows = createPsGeneratorSeedRows()
    const draft = createConfigurationDraft(rows, {
      actorId: 'editor-1',
      draftVersionLabel: 'wordpress-plugin-v2-template-draft',
      now,
    })
    rows = draft.rows

    rows = replaceDraftTemplateVariant(rows, {
      actorId: 'editor-1',
      configVersionId: draft.configVersionId,
      templateVariantId: 'draft-template:wordpress-plugin-v2-template-draft:seed-template:double-disc-ps3',
      r2ObjectKey: 'drafts/ps-generator/ps3-v2.pdf',
      originalFilename: 'PS3 v2.pdf',
      fieldDiscovery: {
        text: ['completion_date', 'description', 'job_address'],
        checkbox: [],
      },
      now,
    }).rows
    rows = updateDraftFieldMapping(rows, {
      actorId: 'editor-1',
      configVersionId: draft.configVersionId,
      templateVariantId: 'draft-template:wordpress-plugin-v2-template-draft:seed-template:double-disc-ps3',
      fieldName: 'job_address',
      fieldType: 'text',
      sourceType: 'project_value',
      sourceKey: 'jobAddress',
      now,
    }).rows

    expect(buildPublishedPsConfigurationReadModel(rows).templateVariants.find((variant) => variant.variantKind === 'ps3')).toMatchObject({
      r2ObjectKey: 'templates/ps-generator/wordpress/double-disc/ps3.pdf',
    })

    const generated = await runDraftConfigurationTestGeneration(rows, {
      configVersionId: draft.configVersionId,
      actorId: 'editor-1',
      now,
      input: {
        mode: 'ps3_only',
        projectDetails: {
          clientName: 'Jane Customer',
          jobAddress: '12 Glass Lane',
        },
        selections: {
          system: 'double-disc',
          structure_material: 'timber',
          structure_type: 'deck',
          location: 'external',
          structure_built: 'new',
          glass_type: 'toughened',
          thickness: '12mm',
          gate_required: 'no',
        },
      },
      generator: async (input, dependencies) => ({
        operationId: dependencies.operationId ?? 'test-operation',
        mode: input.mode,
        versionLabel: dependencies.configuration?.versionLabel ?? '',
        outputs: [{
          documentKind: 'ps3',
          templateVariantId: 'draft-template:wordpress-plugin-v2-template-draft:seed-template:double-disc-ps3',
          templateLabel: 'Double Disc PS3',
          sourceObjectKey: 'drafts/ps-generator/ps3-v2.pdf',
          filename: 'PS3-Jane-Customer.pdf',
          contentType: 'application/pdf',
          bytes: Buffer.from('draft-test'),
        }],
      }),
    })

    expect(generated.outputs).toHaveLength(1)
    expect(generated.outputs[0].r2ObjectKey).toBeUndefined()
    expect(generated.auditEntries.at(-1)).toMatchObject({
      actorId: 'editor-1',
      entityType: 'config_version',
      action: 'test_generated',
      configVersionId: draft.configVersionId,
    })
  })
})
