import { describe, expect, it } from 'vitest'
import {
  buildConfigurationReadModel,
  buildPublishedPsConfigurationReadModel,
  buildPsConfigurationSystemRows,
  createPsGeneratorSeedRows,
} from '../configuration'
import { legacyPs1FieldMappingsForDiscovery } from '../seed-config'
import {
  createConfigurationDraft,
  createDraftSystemRow,
  upsertDraftDescriptionTemplate,
  upsertDraftSystem,
  runDraftConfigurationTestGeneration,
  updateDraftSystemOptionRule,
  updateDraftSystemRow,
  updateDraftFieldMapping,
  publishConfigurationDraft,
  replaceDraftTemplateVariant,
  updateDraftOptionValue,
} from '../configuration-drafts'
import { PS_GENERATOR_OPTION_CATEGORIES } from '../config'

describe('published PS Generator configuration', () => {
  it('maps legacy WordPress PS1 PDF fields from discovery output', () => {
    expect(legacyPs1FieldMappingsForDiscovery({
      text: ['Name', 'Address', 'Description', 'Date0', 'Height'],
      checkbox: ['TimberTB', 'Direct'],
    })).toEqual([
      expect.objectContaining({ fieldName: 'Name', sourceType: 'project_value', sourceKey: 'clientName', sortOrder: 10 }),
      expect.objectContaining({ fieldName: 'Address', sourceType: 'project_value', sourceKey: 'jobAddress', sortOrder: 20 }),
      expect.objectContaining({ fieldName: 'Description', sourceType: 'description_template', sourceKey: 'standard-balustrade', sortOrder: 30 }),
      expect.objectContaining({ fieldName: 'Date0', sourceType: 'date', sourceKey: 'today', sortOrder: 40 }),
      expect.objectContaining({ fieldName: 'Height', sourceType: 'system_rule', sourceKey: 'heightRules.default.height', sortOrder: 50 }),
      expect.objectContaining({ fieldName: 'TimberTB', sourceType: 'selected_option', sourceKey: 'structure_material.timber', sortOrder: 60 }),
      expect.objectContaining({ fieldName: 'Direct', sourceType: 'fixed_value', fixedValue: 'true', checkboxValue: true, sortOrder: 70 }),
    ])
  })

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
      { slug: 'concrete', label: 'Concrete' },
      { slug: 'steel', label: 'Steel' },
    ])
    expect(configuration.systems.find((system) => system.slug === 'double-disc')?.optionRules).toMatchObject({
      system: [{ slug: 'double-disc', label: 'Double Disc' }],
      structure_material: [
        { slug: 'timber', label: 'Timber' },
        { slug: 'concrete', label: 'Concrete' },
        { slug: 'steel', label: 'Steel' },
      ],
      gate_required: [
        { slug: 'no', label: 'No' },
        { slug: 'yes', label: 'Yes' },
      ],
    })
    expect(configuration.templateVariants.map((variant) => variant.variantKind)).toEqual([
      'pool_ps1',
      'standard_ps1',
      'ps3',
    ])
    expect(configuration.templateVariants.find((variant) => variant.variantKind === 'standard_ps1')?.fieldMappings).toEqual([
      {
        fieldName: 'Name',
        fieldType: 'text',
        sourceType: 'project_value',
        sourceKey: 'clientName',
        fixedValue: null,
        checkboxValue: null,
      },
      {
        fieldName: 'Address',
        fieldType: 'text',
        sourceType: 'project_value',
        sourceKey: 'jobAddress',
        fixedValue: null,
        checkboxValue: null,
      },
      {
        fieldName: 'Description',
        fieldType: 'text',
        sourceType: 'description_template',
        sourceKey: 'standard-balustrade',
        fixedValue: null,
        checkboxValue: null,
      },
      expect.objectContaining({ fieldName: 'Date0', fieldType: 'text', sourceType: 'date' }),
      expect.objectContaining({ fieldName: 'Thickness', fieldType: 'text', sourceType: 'selected_option', sourceKey: 'thickness' }),
      expect.objectContaining({ fieldName: 'Height', fieldType: 'text', sourceType: 'system_rule', sourceKey: 'heightRules.default.height' }),
      expect.objectContaining({ fieldName: 'HeightAboveFix', fieldType: 'text', sourceType: 'system_rule', sourceKey: 'heightRules.default.heightAboveFix' }),
      expect.objectContaining({ fieldName: 'TimberTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'structure_material.timber' }),
      expect.objectContaining({ fieldName: 'ConcreteTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'structure_material.concrete' }),
      expect.objectContaining({ fieldName: 'SteelTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'structure_material.steel' }),
      expect.objectContaining({ fieldName: 'InternalTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'location.internal' }),
      expect.objectContaining({ fieldName: 'ExternalTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'location.external' }),
      expect.objectContaining({ fieldName: 'NewTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'structure_built.new' }),
      expect.objectContaining({ fieldName: 'ExistingTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'structure_built.existing' }),
      expect.objectContaining({ fieldName: 'ToughenedTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'glass_type.toughened' }),
      expect.objectContaining({ fieldName: 'LaminatedTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'glass_type.laminated' }),
      expect.objectContaining({ fieldName: 'Direct', fieldType: 'checkbox', sourceType: 'fixed_value', fixedValue: 'true', checkboxValue: true }),
      expect.objectContaining({ fieldName: 'Cont', fieldType: 'checkbox', sourceType: 'fixed_value', fixedValue: 'true', checkboxValue: true }),
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

  it('summarises system rows with standard and pool template status for configuration editors', () => {
    const configuration = buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows())

    expect(buildPsConfigurationSystemRows(configuration)).toEqual([
      {
        id: 'seed-system:double-disc',
        slug: 'double-disc',
        displayName: 'Double Disc',
        isActive: true,
        heightRules: {
          default: { height: '1.00', heightAboveFix: '1.05' },
          pool: { height: '1.20', heightAboveFix: '1.25' },
        },
        standardPs1Template: {
          id: 'seed-template:double-disc-standard-ps1',
          label: 'Double Disc PS1',
          originalFilename: 'Double Disc PS1.pdf',
          r2ObjectKey: 'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf',
        },
        poolPs1Template: null,
      },
      {
        id: 'seed-system:frameless-spigot',
        slug: 'frameless-spigot',
        displayName: 'Frameless Spigot',
        isActive: true,
        heightRules: {
          default: { height: '1.00', heightAboveFix: '1.00' },
          pool: { height: '1.20', heightAboveFix: '1.20' },
        },
        standardPs1Template: null,
        poolPs1Template: {
          id: 'seed-template:frameless-spigot-pool-ps1',
          label: 'Frameless Spigot Pool PS1',
          originalFilename: 'Frameless Spigot Pool PS1.pdf',
          r2ObjectKey: 'templates/ps-generator/wordpress/frameless-spigot/ps1-pool.pdf',
        },
      },
    ])
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

  it('manages draft systems, option rules, and versioned descriptions before publish', () => {
    const now = new Date('2026-06-30T00:00:00.000Z')
    let rows = createPsGeneratorSeedRows()

    const draft = createConfigurationDraft(rows, {
      actorId: 'config-editor-1',
      draftVersionLabel: 'wordpress-plugin-v2-system-draft',
      now,
    })
    rows = draft.rows
    rows = upsertDraftSystem(rows, {
      actorId: 'config-editor-1',
      configVersionId: draft.configVersionId,
      slug: 'frameless-spigot',
      displayName: 'Frameless Spigot MK2',
      sortOrder: 2,
      now,
    }).rows
    rows = upsertDraftSystem(rows, {
      actorId: 'config-editor-1',
      configVersionId: draft.configVersionId,
      slug: 'face-fixed',
      displayName: 'Face Fixed',
      sortOrder: 3,
      now,
    }).rows
    rows = updateDraftSystemOptionRule(rows, {
      actorId: 'config-editor-1',
      configVersionId: draft.configVersionId,
      systemSlug: 'double-disc',
      categorySlug: 'gate_required',
      optionSlug: 'yes',
      isAllowed: false,
      now,
    }).rows
    rows = upsertDraftDescriptionTemplate(rows, {
      actorId: 'config-editor-1',
      configVersionId: draft.configVersionId,
      slug: 'standard-balustrade',
      label: 'Standard Balustrade v2',
      pattern: 'V2 {system} at {jobAddress}',
      now,
    }).rows
    rows = upsertDraftDescriptionTemplate(rows, {
      actorId: 'config-editor-1',
      configVersionId: draft.configVersionId,
      slug: 'gate-balustrade',
      label: 'Gate Balustrade',
      pattern: 'Archived gate template',
      archived: true,
      now,
    }).rows

    const beforePublish = buildPublishedPsConfigurationReadModel(rows)
    expect(beforePublish.systems.find((system) => system.slug === 'frameless-spigot')?.displayName).toBe('Frameless Spigot')
    expect(beforePublish.systems.map((system) => system.slug)).not.toContain('face-fixed')
    expect(beforePublish.systems.find((system) => system.slug === 'double-disc')?.optionRules.gate_required).toContainEqual({
      slug: 'yes',
      label: 'Yes',
    })
    expect(beforePublish.descriptionTemplates.find((template) => template.slug === 'standard-balustrade')?.pattern).toBe(
      '{system} glass balustrade to {structure_type}, {location}, fixed to {structure_material}; {glass_type} glass at {thickness}.',
    )

    const published = publishConfigurationDraft(rows, {
      actorId: 'config-publisher-1',
      configVersionId: draft.configVersionId,
      now,
    })
    const afterPublish = buildPublishedPsConfigurationReadModel(published.rows)

    expect(afterPublish.systems.find((system) => system.slug === 'frameless-spigot')?.displayName).toBe('Frameless Spigot MK2')
    expect(afterPublish.systems.map((system) => system.slug)).toContain('face-fixed')
    expect(afterPublish.systems.find((system) => system.slug === 'double-disc')?.optionRules.gate_required).toEqual([
      { slug: 'no', label: 'No' },
    ])
    expect(afterPublish.descriptionTemplates.find((template) => template.slug === 'standard-balustrade')).toMatchObject({
      label: 'Standard Balustrade v2',
      pattern: 'V2 {system} at {jobAddress}',
    })
    expect(afterPublish.descriptionTemplates.map((template) => template.slug)).not.toContain('gate-balustrade')
    expect(published.auditEntries.map((entry) => entry.entityType)).toEqual([
      'config_version',
      'system',
      'system',
      'system_option_rule',
      'description_template',
      'description_template',
      'config_version',
    ])
    expect(published.auditEntries.at(-1)).toMatchObject({
      actorId: 'config-publisher-1',
      action: 'published',
      before: { state: 'draft' },
      after: { state: 'published' },
    })
  })

  it('creates a draft system row with the matching option, self-rule, and PS1 templates', () => {
    const now = new Date('2026-06-30T00:00:00.000Z')
    let rows = createPsGeneratorSeedRows()
    const draft = createConfigurationDraft(rows, {
      actorId: 'config-editor-1',
      draftVersionLabel: 'wordpress-plugin-v2-add-system',
      now,
    })
    rows = draft.rows

    const created = createDraftSystemRow(rows, {
      actorId: 'config-editor-1',
      configVersionId: draft.configVersionId,
      displayName: '  face fixed ',
      standardPs1Template: {
        r2ObjectKey: 'drafts/face-fixed/standard.pdf',
        originalFilename: 'Face Fixed.pdf',
        fieldDiscovery: { fields: ['client_name'] },
      },
      heightRules: {
        default: { height: '1.10', heightAboveFix: '1.15' },
      },
      poolPs1Template: {
        r2ObjectKey: 'drafts/face-fixed/pool.pdf',
        originalFilename: 'Face Fixed Pool.pdf',
        fieldDiscovery: { fields: ['pool_description'] },
      },
      now,
    })
    rows = created.rows

    const draftConfiguration = buildConfigurationReadModel(rows, draft.configVersionId, 'draft')
    const system = draftConfiguration.systems.find((candidate) => candidate.slug === 'face-fixed')
    expect(system).toMatchObject({
      slug: 'face-fixed',
      displayName: 'Face Fixed',
      heightRules: {
        default: { height: '1.10', heightAboveFix: '1.15' },
      },
      optionRules: expect.objectContaining({
        system: [{ slug: 'face-fixed', label: 'Face Fixed' }],
        structure_material: [],
      }),
    })
    expect(draftConfiguration.optionCategories.find((category) => category.slug === 'system')?.values).toContainEqual({
      slug: 'face-fixed',
      label: 'Face Fixed',
    })
    expect(draftConfiguration.templateVariants.filter((variant) => variant.systemSlug === 'face-fixed')).toEqual([
      expect.objectContaining({
        variantKind: 'pool_ps1',
        label: 'Face Fixed Pool PS1',
        originalFilename: 'Face Fixed Pool.pdf',
      }),
      expect.objectContaining({
        variantKind: 'standard_ps1',
        label: 'Face Fixed PS1',
        originalFilename: 'Face Fixed.pdf',
      }),
    ])
    expect(buildPublishedPsConfigurationReadModel(rows).systems.map((systemRow) => systemRow.slug)).not.toContain('face-fixed')
    expect(created.auditEntries.map((entry) => entry.entityType).slice(-5)).toEqual([
      'system',
      'option_value',
      'system_option_rule',
      'template_variant',
      'template_variant',
    ])
  })

  it('edits an existing draft system row without changing its slug', () => {
    const now = new Date('2026-06-30T00:00:00.000Z')
    let rows = createPsGeneratorSeedRows()
    const draft = createConfigurationDraft(rows, {
      actorId: 'config-editor-1',
      draftVersionLabel: 'wordpress-plugin-v2-edit-system',
      now,
    })
    rows = draft.rows

    const edited = updateDraftSystemRow(rows, {
      actorId: 'config-editor-1',
      configVersionId: draft.configVersionId,
      systemSlug: 'frameless-spigot',
      displayName: 'frameless spigot mk2',
      standardPs1Template: {
        r2ObjectKey: 'drafts/frameless-spigot/standard.pdf',
        originalFilename: 'Frameless Spigot Standard.pdf',
        fieldDiscovery: { fields: ['client_name'] },
      },
      now,
    })
    rows = edited.rows

    const draftConfiguration = buildConfigurationReadModel(rows, draft.configVersionId, 'draft')
    const system = draftConfiguration.systems.find((candidate) => candidate.slug === 'frameless-spigot')
    expect(system?.displayName).toBe('Frameless Spigot Mk2')
    expect(draftConfiguration.optionCategories.find((category) => category.slug === 'system')?.values).toContainEqual({
      slug: 'frameless-spigot',
      label: 'Frameless Spigot Mk2',
    })
    expect(draftConfiguration.systems.map((candidate) => candidate.slug)).not.toContain('frameless-spigot-mk2')
    expect(draftConfiguration.templateVariants.find((variant) => (
      variant.systemSlug === 'frameless-spigot' && variant.variantKind === 'standard_ps1'
    ))).toMatchObject({
      label: 'Frameless Spigot Mk2 PS1',
      originalFilename: 'Frameless Spigot Standard.pdf',
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
