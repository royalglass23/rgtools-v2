import { describe, expect, it } from 'vitest'
import {
  buildPublishedPsConfigurationReadModel,
  createPsGeneratorSeedRows,
} from '../configuration'
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
})
