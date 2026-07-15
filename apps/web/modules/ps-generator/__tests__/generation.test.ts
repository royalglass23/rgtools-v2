import { describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'

import {
  buildPublishedPsConfigurationReadModel,
  createPsGeneratorSeedRows,
  type PublishedPsConfiguration,
} from '../configuration'
import { generateProducerStatementPackage } from '../generation'
import { legacyPs1FieldMappingsForDiscovery } from '../seed-config'
import type { QuoteStorage } from '@/lib/storage/types'

class MemoryStorage implements QuoteStorage {
  readonly puts: Array<{ key: string; bytes: Buffer; contentType?: string }> = []

  constructor(private readonly objects: Record<string, Buffer>) {}

  async put(key: string, bytes: Buffer, contentType?: string): Promise<void> {
    this.puts.push({ key, bytes, contentType })
    this.objects[key] = bytes
  }

  async head(key: string): Promise<boolean> {
    return key in this.objects
  }

  async get(key: string): Promise<Buffer | null> {
    return this.objects[key] ?? null
  }

  async delete(key: string): Promise<void> {
    delete this.objects[key]
  }
}

describe('Producer Statement generation', () => {
  it('generates separate PS1 and PS3 PDFs from published configuration', async () => {
    const configuration = buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows())
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf': await createFixturePdf(legacyPs1FixtureFields()),
      'templates/ps-generator/wordpress/double-disc/ps3.pdf': await createFixturePdf([
        { name: 'completion_date', type: 'text' },
        { name: 'description', type: 'text' },
      ]),
    }

    const result = await generateProducerStatementPackage({
      mode: 'both',
      projectDetails: {
        clientName: 'Jane Customer',
        jobAddress: '12 Glass Lane',
        bcNumber: 'BC-123',
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
    }, {
      configuration,
      storage: new MemoryStorage(objects),
      now: new Date('2026-06-26T00:00:00.000Z'),
      flattenGeneratedPdf: false,
    })

    expect(result.versionLabel).toBe('wordpress-plugin-v1')
    expect(result.outputs.map((output) => output.documentKind)).toEqual(['ps1', 'ps3'])

    const ps1Form = await readForm(result.outputs.find((output) => output.documentKind === 'ps1')!.bytes)
    expect(ps1Form.getTextField('Name').getText()).toBe('Jane Customer')
    expect(ps1Form.getTextField('Address').getText()).toBe('12 Glass Lane')
    expect(ps1Form.getTextField('Description').getText()).toBe(
      'Double Disc glass balustrade to Deck, External, fixed to Timber; Toughened glass at 12mm.',
    )
    expect(ps1Form.getTextField('Date0').getText()).toBe('26/06/2026')
    expect(ps1Form.getTextField('Thickness').getText()).toBe('12mm')
    expect(ps1Form.getTextField('Height').getText()).toBe('1.00')
    expect(ps1Form.getTextField('HeightAboveFix').getText()).toBe('1.05')
    expect(ps1Form.getCheckBox('TimberTB').isChecked()).toBe(true)
    expect(ps1Form.getCheckBox('ConcreteTB').isChecked()).toBe(false)
    expect(ps1Form.getCheckBox('SteelTB').isChecked()).toBe(false)
    expect(ps1Form.getCheckBox('ExternalTB').isChecked()).toBe(true)
    expect(ps1Form.getCheckBox('InternalTB').isChecked()).toBe(false)
    expect(ps1Form.getCheckBox('NewTB').isChecked()).toBe(true)
    expect(ps1Form.getCheckBox('ExistingTB').isChecked()).toBe(false)
    expect(ps1Form.getCheckBox('ToughenedTB').isChecked()).toBe(true)
    expect(ps1Form.getCheckBox('LaminatedTB').isChecked()).toBe(false)
    expect(ps1Form.getCheckBox('Direct').isChecked()).toBe(true)
    expect(ps1Form.getCheckBox('Cont').isChecked()).toBe(true)

    const ps3Form = await readForm(result.outputs.find((output) => output.documentKind === 'ps3')!.bytes)
    expect(ps3Form.getTextField('completion_date').getText()).toBe('26/06/2026')
    expect(ps3Form.getTextField('description').getText()).toBe(
      'Double Disc glass balustrade to Deck, External, fixed to Timber; Toughened glass at 12mm.',
    )
  })

  it('uses the standard PS1 template when gate is required', async () => {
    const configuration = buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows())
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf': await createFixturePdf(legacyPs1FixtureFields()),
    }

    const result = await generateProducerStatementPackage({
      mode: 'ps1_only',
      projectDetails: {
        clientName: 'Gate Customer',
        jobAddress: '42 Pool Road',
      },
      selections: {
        system: 'double-disc',
        structure_material: 'steel',
        structure_type: 'pool',
        location: 'external',
        structure_built: 'existing',
        glass_type: 'laminated',
        thickness: '15mm',
        gate_required: 'yes',
      },
    }, {
      configuration,
      storage: new MemoryStorage(objects),
      flattenGeneratedPdf: false,
    })

    expect(result.outputs).toHaveLength(1)
    expect(result.outputs[0]).toMatchObject({
      documentKind: 'ps1',
      templateLabel: 'Double Disc PS1',
      sourceObjectKey: 'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf',
    })

    const form = await readForm(result.outputs[0].bytes)
    expect(form.getTextField('Description').getText()).toBe(
      'Double Disc glass balustrade to Pool Area, External, fixed to Steel; Laminated glass at 15mm.',
    )
    expect(form.getCheckBox('SteelTB').isChecked()).toBe(true)
    expect(form.getCheckBox('LaminatedTB').isChecked()).toBe(true)
    expect(form.getCheckBox('ExistingTB').isChecked()).toBe(true)
  })

  it('fills both location checkboxes when location is internal and external', async () => {
    const configuration = buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows())
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf': await createFixturePdf(legacyPs1FixtureFields()),
    }

    const result = await generateProducerStatementPackage({
      ...defaultInput('ps1_only'),
      selections: {
        ...defaultInput('ps1_only').selections,
        location: 'both',
      },
    }, {
      configuration,
      storage: new MemoryStorage(objects),
      now: new Date('2026-06-26T00:00:00.000Z'),
      flattenGeneratedPdf: false,
    })

    const form = await readForm(result.outputs[0].bytes)
    expect(form.getCheckBox('ExternalTB').isChecked()).toBe(true)
    expect(form.getCheckBox('InternalTB').isChecked()).toBe(true)
    expect(form.getTextField('Description').getText()).toBe(
      'Double Disc glass balustrade to Deck, External and Internal, fixed to Timber; Toughened glass at 12mm.',
    )
  })

  it('flattens generated PDFs by default so filled fields render as page content', async () => {
    const configuration = buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows())
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf': await createFixturePdf(legacyPs1FixtureFields()),
    }

    const result = await generateProducerStatementPackage(defaultInput('ps1_only'), {
      configuration,
      storage: new MemoryStorage(objects),
      now: new Date('2026-06-26T00:00:00.000Z'),
    })

    const form = await readForm(result.outputs[0].bytes)
    expect(form.getFields()).toEqual([])
  })

  it('uses the pool PS1 template for pool area selections when one is published', async () => {
    const configuration = withPoolPs1Mappings(buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows()), [
      { fieldName: 'client_name', fieldType: 'text', sourceType: 'project_value', sourceKey: 'clientName', fixedValue: null, checkboxValue: null },
      { fieldName: 'pool_description', fieldType: 'text', sourceType: 'description_template', sourceKey: 'standard-balustrade', fixedValue: null, checkboxValue: null },
    ])
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/frameless-spigot/ps1-pool.pdf': await createFixturePdf([
        { name: 'client_name', type: 'text' },
        { name: 'pool_description', type: 'text' },
      ]),
    }

    const result = await generateProducerStatementPackage({
      mode: 'ps1_only',
      projectDetails: {
        clientName: 'Pool Customer',
        jobAddress: '9 Fence Road',
      },
      selections: {
        system: 'frameless-spigot',
        structure_material: 'timber',
        structure_type: 'pool',
        location: 'external',
        structure_built: 'new',
        glass_type: 'toughened',
        thickness: '15mm',
        gate_required: 'yes',
      },
    }, {
      configuration,
      storage: new MemoryStorage(objects),
    })

    expect(result.outputs[0]).toMatchObject({
      documentKind: 'ps1',
      templateLabel: 'Frameless Spigot Pool PS1',
      sourceObjectKey: 'templates/ps-generator/wordpress/frameless-spigot/ps1-pool.pdf',
    })
  })

  it('uses pool height rules and pool template for pool area selections', async () => {
    const configuration = withPoolPs1Mappings(buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows()), [
      { fieldName: 'height', fieldType: 'text', sourceType: 'system_rule', sourceKey: 'heightRules.default.height', fixedValue: null, checkboxValue: null },
      { fieldName: 'height_above_fix', fieldType: 'text', sourceType: 'system_rule', sourceKey: 'heightRules.default.heightAboveFix', fixedValue: null, checkboxValue: null },
    ])
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/frameless-spigot/ps1-pool.pdf': await createFixturePdf([
        { name: 'height', type: 'text' },
        { name: 'height_above_fix', type: 'text' },
      ]),
    }

    const result = await generateProducerStatementPackage({
      ...defaultInput('ps1_only'),
      selections: {
        ...defaultInput('ps1_only').selections,
        system: 'frameless-spigot',
        structure_type: 'pool',
      },
    }, {
      configuration,
      storage: new MemoryStorage(objects),
      flattenGeneratedPdf: false,
    })

    expect(result.outputs[0]).toMatchObject({
      documentKind: 'ps1',
      templateLabel: 'Frameless Spigot Pool PS1',
    })
    const form = await readForm(result.outputs[0].bytes)
    expect(form.getTextField('height').getText()).toBe('1.20')
    expect(form.getTextField('height_above_fix').getText()).toBe('1.20')
  })

  it('generates PS3 only without fetching a PS1 template', async () => {
    const configuration = buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows())
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps3.pdf': await createFixturePdf([
        { name: 'completion_date', type: 'text' },
        { name: 'description', type: 'text' },
      ]),
    }

    const result = await generateProducerStatementPackage(defaultInput('ps3_only'), {
      configuration,
      storage: new MemoryStorage(objects),
      now: new Date('2026-06-26T00:00:00.000Z'),
    })

    expect(result.outputs.map((output) => output.documentKind)).toEqual(['ps3'])
    expect(result.outputs[0].templateLabel).toBe('Double Disc PS3')
  })

  it('fills legacy WordPress PS3 AcroForm fields from discovered template names', async () => {
    const configuration = withPs3Template(
      buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows()),
      [],
      {
        text: legacyPs3FixtureFields().filter((field) => field.type === 'text').map((field) => field.name),
        checkbox: legacyPs3FixtureFields().filter((field) => field.type === 'checkbox').map((field) => field.name),
      },
    )
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps3.pdf': await createFixturePdf(legacyPs3FixtureFields()),
    }
    const input = defaultInput('ps3_only')

    const result = await generateProducerStatementPackage({
      ...input,
      projectDetails: {
        ...input.projectDetails,
        lotDescription: 'Lot 4 DP 12345',
      },
    }, {
      configuration,
      storage: new MemoryStorage(objects),
      now: new Date('2026-06-26T00:00:00.000Z'),
      flattenGeneratedPdf: false,
    })

    const form = await readForm(result.outputs[0].bytes)
    expect(form.getTextField('BC').getText()).toBe('BC-123')
    expect(form.getTextField('Address02').getText()).toBe('12 Glass Lane')
    expect(form.getTextField('Description3').getText()).toBe('Deck')
    expect(form.getTextField('Description2').getText()).toBe(
      'Double Disc glass balustrade to Deck, External, fixed to Timber; Toughened glass at 12mm.',
    )
    expect(form.getTextField('Date03').getText()).toBe('26/06/2026')
    expect(form.getTextField('Legal').getText()).toBe('Lot 4 DP 12345')
    expect(form.getCheckBox('B1TB').isChecked()).toBe(true)
    expect(form.getCheckBox('B2TB').isChecked()).toBe(false)
    expect(form.getCheckBox('F4TB').isChecked()).toBe(true)
    expect(form.getCheckBox('GlassTB').isChecked()).toBe(true)
    expect(form.getCheckBox('PS1TB').isChecked()).toBe(true)
  })

  it('enables multiline wrapping for PS1 descriptions and PS3 legal descriptions', async () => {
    const configuration = withPs3Template(
      buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows()),
      [],
      {
        text: legacyPs3FixtureFields().filter((field) => field.type === 'text').map((field) => field.name),
        checkbox: legacyPs3FixtureFields().filter((field) => field.type === 'checkbox').map((field) => field.name),
      },
    )
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf': await createFixturePdf(legacyPs1FixtureFields()),
      'templates/ps-generator/wordpress/double-disc/ps3.pdf': await createFixturePdf(legacyPs3FixtureFields()),
    }

    const result = await generateProducerStatementPackage({
      ...defaultInput('both'),
      projectDetails: {
        ...defaultInput('both').projectDetails,
        lotDescription: 'SECTION 4 BLOCK II OMARA SD 1599440M2, SECTION 5 BLOCK I OMARA SD 3235500M2, SBDY',
      },
    }, {
      configuration,
      storage: new MemoryStorage(objects),
      now: new Date('2026-06-26T00:00:00.000Z'),
      flattenGeneratedPdf: false,
    })

    const ps1Form = await readForm(result.outputs.find((output) => output.documentKind === 'ps1')!.bytes)
    expect(ps1Form.getTextField('Name').isMultiline()).toBe(false)
    expect(ps1Form.getTextField('Description').isMultiline()).toBe(true)

    const ps3Form = await readForm(result.outputs.find((output) => output.documentKind === 'ps3')!.bytes)
    expect(ps3Form.getTextField('BC').isMultiline()).toBe(false)
    expect(ps3Form.getTextField('Description2').isMultiline()).toBe(true)
    expect(ps3Form.getTextField('Legal').isMultiline()).toBe(true)
  })

  it('uses the shared PS3 template for systems without their own PS3 template', async () => {
    const rows = createPsGeneratorSeedRows()
    rows.systems.push({
      id: 'seed-system:jh-clamp',
      configVersionId: rows.versions[0].id,
      slug: 'jh-clamp',
      displayName: 'Jh Clamp',
      state: 'published',
      sortOrder: 30,
      heightRules: {},
      metadata: {},
      archivedAt: null,
    })
    const configuration = buildPublishedPsConfigurationReadModel(rows)
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps3.pdf': await createFixturePdf([
        { name: 'completion_date', type: 'text' },
        { name: 'description', type: 'text' },
      ]),
    }

    const result = await generateProducerStatementPackage({
      ...defaultInput('ps3_only'),
      selections: {
        ...defaultInput('ps3_only').selections,
        system: 'jh-clamp',
      },
    }, {
      configuration,
      storage: new MemoryStorage(objects),
      now: new Date('2026-06-26T00:00:00.000Z'),
    })

    expect(result.outputs.map((output) => output.documentKind)).toEqual(['ps3'])
    expect(result.outputs[0]).toMatchObject({
      templateLabel: 'Double Disc PS3',
      sourceObjectKey: 'templates/ps-generator/wordpress/double-disc/ps3.pdf',
    })
  })

  it('ignores draft template variants when generating from the published read model', async () => {
    const rows = createPsGeneratorSeedRows()
    rows.templateVariants.unshift({
      id: 'draft-template:double-disc-ps3',
      systemId: 'seed-system:double-disc',
      configVersionId: 'seed-version:wordpress-plugin-v1',
      documentKind: 'ps3',
      variantKind: 'ps3',
      label: 'Draft Double Disc PS3',
      r2ObjectKey: 'templates/draft/ps3.pdf',
      originalFilename: 'Draft PS3.pdf',
      fieldDiscovery: {},
      state: 'draft',
      archivedAt: null,
    })
    const configuration = buildPublishedPsConfigurationReadModel(rows)
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps3.pdf': await createFixturePdf([
        { name: 'completion_date', type: 'text' },
        { name: 'description', type: 'text' },
      ]),
    }

    const result = await generateProducerStatementPackage(defaultInput('ps3_only'), {
      configuration,
      storage: new MemoryStorage(objects),
      now: new Date('2026-06-26T00:00:00.000Z'),
    })

    expect(result.outputs[0]).toMatchObject({
      templateLabel: 'Double Disc PS3',
      sourceObjectKey: 'templates/ps-generator/wordpress/double-disc/ps3.pdf',
    })
  })

  it('resolves project, selected option, system rule, and fixed field mappings', async () => {
    const configuration = withStandardPs1Mappings(buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows()), [
      { fieldName: 'client_name', fieldType: 'text', sourceType: 'project_value', sourceKey: 'clientName', fixedValue: null, checkboxValue: null },
      { fieldName: 'selected_glass', fieldType: 'text', sourceType: 'selected_option', sourceKey: 'glass_type', fixedValue: null, checkboxValue: null },
      { fieldName: 'height', fieldType: 'text', sourceType: 'system_rule', sourceKey: 'heightRules.default.height', fixedValue: null, checkboxValue: null },
      { fieldName: 'fixed_note', fieldType: 'text', sourceType: 'fixed_value', sourceKey: null, fixedValue: 'Producer Statement package', checkboxValue: null },
    ])
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf': await createFixturePdf([
        { name: 'client_name', type: 'text' },
        { name: 'selected_glass', type: 'text' },
        { name: 'height', type: 'text' },
        { name: 'fixed_note', type: 'text' },
      ]),
    }

    const result = await generateProducerStatementPackage(defaultInput('ps1_only'), {
      configuration,
      storage: new MemoryStorage(objects),
      flattenGeneratedPdf: false,
    })

    const form = await readForm(result.outputs[0].bytes)
    expect(form.getTextField('client_name').getText()).toBe('Jane Customer')
    expect(form.getTextField('selected_glass').getText()).toBe('Toughened')
    expect(form.getTextField('height').getText()).toBe('1.00')
    expect(form.getTextField('fixed_note').getText()).toBe('Producer Statement package')
  })

  it('fills legacy WordPress PS1 fields when mappings use canonical names', async () => {
    const configuration = withStandardPs1Mappings(buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows()), [
      { fieldName: 'client_name', fieldType: 'text', sourceType: 'project_value', sourceKey: 'clientName', fixedValue: null, checkboxValue: null },
      { fieldName: 'job_address', fieldType: 'text', sourceType: 'project_value', sourceKey: 'jobAddress', fixedValue: null, checkboxValue: null },
      { fieldName: 'description', fieldType: 'text', sourceType: 'description_template', sourceKey: 'standard-balustrade', fixedValue: null, checkboxValue: null },
      { fieldName: 'completion_date', fieldType: 'text', sourceType: 'date', sourceKey: 'today', fixedValue: null, checkboxValue: null },
      { fieldName: 'thickness', fieldType: 'text', sourceType: 'selected_option', sourceKey: 'thickness', fixedValue: null, checkboxValue: null },
      { fieldName: 'height', fieldType: 'text', sourceType: 'system_rule', sourceKey: 'heightRules.default.height', fixedValue: null, checkboxValue: null },
      { fieldName: 'height_above_fix', fieldType: 'text', sourceType: 'system_rule', sourceKey: 'heightRules.default.heightAboveFix', fixedValue: null, checkboxValue: null },
      { fieldName: 'structure_material_timber', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'structure_material.timber', fixedValue: null, checkboxValue: null },
      { fieldName: 'location_external', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'location.external', fixedValue: null, checkboxValue: null },
      { fieldName: 'structure_built_new', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'structure_built.new', fixedValue: null, checkboxValue: null },
      { fieldName: 'glass_type_toughened', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'glass_type.toughened', fixedValue: null, checkboxValue: null },
    ])
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf': await createFixturePdf(legacyPs1FixtureFields()),
    }

    const result = await generateProducerStatementPackage(defaultInput('ps1_only'), {
      configuration,
      storage: new MemoryStorage(objects),
      now: new Date('2026-06-26T00:00:00.000Z'),
      flattenGeneratedPdf: false,
    })

    const form = await readForm(result.outputs[0].bytes)
    expect(form.getTextField('Name').getText()).toBe('Jane Customer')
    expect(form.getTextField('Address').getText()).toBe('12 Glass Lane')
    expect(form.getTextField('Description').getText()).toBe(
      'Double Disc glass balustrade to Deck, External, fixed to Timber; Toughened glass at 12mm.',
    )
    expect(form.getTextField('Date0').getText()).toBe('26/06/2026')
    expect(form.getTextField('Thickness').getText()).toBe('12mm')
    expect(form.getTextField('Height').getText()).toBe('1.00')
    expect(form.getTextField('HeightAboveFix').getText()).toBe('1.05')
    expect(form.getCheckBox('TimberTB').isChecked()).toBe(true)
    expect(form.getCheckBox('ExternalTB').isChecked()).toBe(true)
    expect(form.getCheckBox('NewTB').isChecked()).toBe(true)
    expect(form.getCheckBox('ToughenedTB').isChecked()).toBe(true)
  })

  it('fills legacy PS1 default fields when an older published config is missing those mappings', async () => {
    const configuration = withStandardPs1Mappings(buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows()), [
      { fieldName: 'client_name', fieldType: 'text', sourceType: 'project_value', sourceKey: 'clientName', fixedValue: null, checkboxValue: null },
      { fieldName: 'job_address', fieldType: 'text', sourceType: 'project_value', sourceKey: 'jobAddress', fixedValue: null, checkboxValue: null },
      { fieldName: 'bc_number', fieldType: 'text', sourceType: 'project_value', sourceKey: 'bcNumber', fixedValue: null, checkboxValue: null },
      { fieldName: 'description', fieldType: 'text', sourceType: 'description_template', sourceKey: 'standard-balustrade', fixedValue: null, checkboxValue: null },
    ])
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf': await createFixturePdf(legacyPs1FixtureFields()),
    }

    const input = defaultInput('ps1_only')
    const result = await generateProducerStatementPackage({
      ...input,
      projectDetails: {
        ...input.projectDetails,
        bcNumber: '',
      },
    }, {
      configuration,
      storage: new MemoryStorage(objects),
      now: new Date('2026-06-26T00:00:00.000Z'),
      flattenGeneratedPdf: false,
    })

    const form = await readForm(result.outputs[0].bytes)
    expect(form.getTextField('Thickness').getText()).toBe('12mm')
    expect(form.getTextField('Height').getText()).toBe('1.00')
    expect(form.getTextField('HeightAboveFix').getText()).toBe('1.05')
    expect(form.getCheckBox('TimberTB').isChecked()).toBe(true)
    expect(form.getCheckBox('ExternalTB').isChecked()).toBe(true)
    expect(form.getCheckBox('NewTB').isChecked()).toBe(true)
    expect(form.getCheckBox('ToughenedTB').isChecked()).toBe(true)
    expect(form.getCheckBox('Direct').isChecked()).toBe(true)
    expect(form.getCheckBox('Cont').isChecked()).toBe(true)
  })

  it('fills numbered AcroForm field aliases from uploaded templates', async () => {
    const aliasedFields: Array<{ name: string; type: 'text' | 'checkbox' }> = [
      { name: 'Name-2', type: 'text' },
      { name: 'Address02', type: 'text' },
      { name: 'Date01', type: 'text' },
      { name: 'Description02', type: 'text' },
      { name: 'LotDescription02', type: 'text' },
      { name: 'Structure02', type: 'text' },
      { name: 'HeightAbove', type: 'text' },
    ]
    const configuration = withStandardPs1Mappings(
      buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows()),
      legacyPs1FieldMappingsForDiscovery({ text: aliasedFields.map((field) => field.name), checkbox: [] }).map((mapping) => ({
        fieldName: mapping.fieldName,
        fieldType: mapping.fieldType,
        sourceType: mapping.sourceType,
        sourceKey: mapping.sourceKey ?? null,
        fixedValue: mapping.fixedValue ?? null,
        checkboxValue: mapping.checkboxValue ?? null,
      })),
    )
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf': await createFixturePdf(aliasedFields),
    }

    const input = defaultInput('ps1_only')
    const result = await generateProducerStatementPackage({
      ...input,
      projectDetails: {
        ...input.projectDetails,
        lotDescription: 'Lot 4 DP 12345',
      },
    }, {
      configuration,
      storage: new MemoryStorage(objects),
      now: new Date('2026-06-26T00:00:00.000Z'),
      flattenGeneratedPdf: false,
    })

    const form = await readForm(result.outputs[0].bytes)
    expect(form.getTextField('Name-2').getText()).toBe('Jane Customer')
    expect(form.getTextField('Address02').getText()).toBe('12 Glass Lane')
    expect(form.getTextField('Date01').getText()).toBe('26/06/2026')
    expect(form.getTextField('Description02').getText()).toBe(
      'Double Disc glass balustrade to Deck, External, fixed to Timber; Toughened glass at 12mm.',
    )
    expect(form.getTextField('LotDescription02').getText()).toBe('Lot 4 DP 12345')
    expect(form.getTextField('Structure02').getText()).toBe('Deck')
    expect(form.getTextField('HeightAbove').getText()).toBe('1.05')
  })

  it('fills every repeated AcroForm alias used by the PS1 cover sheet', async () => {
    const configuration = withStandardPs1Mappings(buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows()), [
      { fieldName: 'Name', fieldType: 'text', sourceType: 'project_value', sourceKey: 'clientName', fixedValue: null, checkboxValue: null },
      { fieldName: 'Address', fieldType: 'text', sourceType: 'project_value', sourceKey: 'jobAddress', fixedValue: null, checkboxValue: null },
      { fieldName: 'Description', fieldType: 'text', sourceType: 'description_template', sourceKey: 'standard-balustrade', fixedValue: null, checkboxValue: null },
      { fieldName: 'Date0', fieldType: 'text', sourceType: 'date', sourceKey: 'today', fixedValue: null, checkboxValue: null },
      { fieldName: 'LotDescription', fieldType: 'text', sourceType: 'project_value', sourceKey: 'lotDescription', fixedValue: null, checkboxValue: null },
      { fieldName: 'Structure', fieldType: 'text', sourceType: 'selected_option', sourceKey: 'structure_type', fixedValue: null, checkboxValue: null },
    ])
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf': await createFixturePdf([
        { name: 'Name', type: 'text' },
        { name: 'Address', type: 'text' },
        { name: 'Description', type: 'text' },
        { name: 'Date0', type: 'text' },
        { name: 'LotDescription', type: 'text' },
        { name: 'Structure', type: 'text' },
        { name: 'Name-2', type: 'text' },
        { name: 'Address-2', type: 'text' },
        { name: 'Description02', type: 'text' },
        { name: 'Date01', type: 'text' },
        { name: 'LotDescription02', type: 'text' },
        { name: 'Structure02', type: 'text' },
      ]),
    }

    const input = defaultInput('ps1_only')
    const result = await generateProducerStatementPackage({
      ...input,
      projectDetails: {
        ...input.projectDetails,
        lotDescription: 'Lot 4 DP 12345',
      },
    }, {
      configuration,
      storage: new MemoryStorage(objects),
      now: new Date('2026-06-26T00:00:00.000Z'),
      flattenGeneratedPdf: false,
    })

    const form = await readForm(result.outputs[0].bytes)
    expect(form.getTextField('Name').getText()).toBe('Jane Customer')
    expect(form.getTextField('Name-2').getText()).toBe('Jane Customer')
    expect(form.getTextField('Address').getText()).toBe('12 Glass Lane')
    expect(form.getTextField('Address-2').getText()).toBe('12 Glass Lane')
    expect(form.getTextField('Description').getText()).toBe(
      'Double Disc glass balustrade to Deck, External, fixed to Timber; Toughened glass at 12mm.',
    )
    expect(form.getTextField('Description02').getText()).toBe(
      'Double Disc glass balustrade to Deck, External, fixed to Timber; Toughened glass at 12mm.',
    )
    expect(form.getTextField('Date0').getText()).toBe('26/06/2026')
    expect(form.getTextField('Date01').getText()).toBe('26/06/2026')
    expect(form.getTextField('LotDescription').getText()).toBe('Lot 4 DP 12345')
    expect(form.getTextField('LotDescription02').getText()).toBe('Lot 4 DP 12345')
    expect(form.getTextField('Structure').getText()).toBe('Deck')
    expect(form.getTextField('Structure02').getText()).toBe('Deck')
  })

  it('does not require optional BC number or lot description fields when those values are blank', async () => {
    const configuration = withStandardPs1Mappings(buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows()), [
      { fieldName: 'client_name', fieldType: 'text', sourceType: 'project_value', sourceKey: 'clientName', fixedValue: null, checkboxValue: null },
      { fieldName: 'bc_number', fieldType: 'text', sourceType: 'project_value', sourceKey: 'bcNumber', fixedValue: null, checkboxValue: null },
      { fieldName: 'lot_description', fieldType: 'text', sourceType: 'project_value', sourceKey: 'lotDescription', fixedValue: null, checkboxValue: null },
    ])
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf': await createFixturePdf([
        { name: 'client_name', type: 'text' },
      ]),
    }

    await expect(generateProducerStatementPackage({
      ...defaultInput('ps1_only'),
      projectDetails: {
        clientName: 'Jane Customer',
        jobAddress: '12 Glass Lane',
        bcNumber: '',
        lotDescription: '',
      },
    }, {
      configuration,
      storage: new MemoryStorage(objects),
    })).resolves.toMatchObject({
      outputs: [expect.objectContaining({ documentKind: 'ps1' })],
    })
  })

  it('does not require optional BC number fields on PS1 templates when a value was entered', async () => {
    const configuration = withStandardPs1Mappings(buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows()), [
      { fieldName: 'client_name', fieldType: 'text', sourceType: 'project_value', sourceKey: 'clientName', fixedValue: null, checkboxValue: null },
      { fieldName: 'bc_number', fieldType: 'text', sourceType: 'project_value', sourceKey: 'bcNumber', fixedValue: null, checkboxValue: null },
    ])
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf': await createFixturePdf([
        { name: 'client_name', type: 'text' },
      ]),
    }

    const result = await generateProducerStatementPackage({
      ...defaultInput('ps1_only'),
      projectDetails: {
        clientName: 'Jane Customer',
        jobAddress: '12 Glass Lane',
        bcNumber: 'BC-123',
      },
    }, {
      configuration,
      storage: new MemoryStorage(objects),
      flattenGeneratedPdf: false,
    })

    expect(result.outputs).toEqual([expect.objectContaining({ documentKind: 'ps1' })])
    const form = await readForm(result.outputs[0].bytes)
    expect(form.getTextField('client_name').getText()).toBe('Jane Customer')
  })

  it('returns a clear generation error when the published template PDF is missing', async () => {
    await expect(generateProducerStatementPackage(defaultInput('ps3_only'), {
      configuration: buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows()),
      storage: new MemoryStorage({}),
    })).rejects.toMatchObject({
      name: 'PsGenerationError',
      code: 'template_pdf_missing',
    })
  })

  it('persists generated outputs and one generation record with readable snapshots', async () => {
    const configuration = buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows())
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf': await createFixturePdf(legacyPs1FixtureFields()),
      'templates/ps-generator/wordpress/double-disc/ps3.pdf': await createFixturePdf([
        { name: 'completion_date', type: 'text' },
        { name: 'description', type: 'text' },
      ]),
    }
    const storage = new MemoryStorage(objects)
    const database = {
      insert: vi.fn(),
    }
    const insertedEvents: unknown[] = []
    const insertedObjects: unknown[] = []
    database.insert.mockImplementation(() => ({
      values: vi.fn((values) => {
        if (insertedEvents.length === 0) {
          insertedEvents.push(values)
          return { returning: vi.fn(async () => [{ id: 'generation-event-1' }]) }
        }
        insertedObjects.push(values)
        return { returning: vi.fn(async () => []) }
      }),
    }))

    const result = await generateProducerStatementPackage(defaultInput('both'), {
      configuration,
      storage,
      now: new Date('2026-06-26T00:00:00.000Z'),
      operationId: 'operation-1',
      persistGeneratedOutputs: true,
      actor: { id: 'user-1', label: 'Jane Staff' },
      database,
    })

    expect(result.outputs.map((output) => output.r2ObjectKey)).toEqual([
      'ps-generator/generated/operation-1/PS1-Jane-Customer.pdf',
      'ps-generator/generated/operation-1/PS3-Jane-Customer.pdf',
    ])
    expect(storage.puts.map((put) => ({ key: put.key, contentType: put.contentType }))).toEqual([
      { key: 'ps-generator/generated/operation-1/PS1-Jane-Customer.pdf', contentType: 'application/pdf' },
      { key: 'ps-generator/generated/operation-1/PS3-Jane-Customer.pdf', contentType: 'application/pdf' },
    ])
    expect(insertedEvents).toHaveLength(1)
    expect(insertedEvents[0]).toMatchObject({
      actorId: 'user-1',
      actorLabel: 'Jane Staff',
      generationMode: 'both',
      jobNumber: null,
      clientName: 'Jane Customer',
      jobAddress: '12 Glass Lane',
      selectionsSnapshot: {
        system: { slug: 'double-disc', label: 'Double Disc' },
        options: expect.objectContaining({
          structure_material: expect.objectContaining({ slug: 'timber', label: 'Timber' }),
          thickness: expect.objectContaining({ slug: '12mm', label: '12mm' }),
        }),
      },
      descriptionSnapshot: {
        templates: expect.arrayContaining([
          expect.objectContaining({ documentKind: 'ps1', templateLabel: 'Double Disc PS1' }),
          expect.objectContaining({ documentKind: 'ps3', templateLabel: 'Double Disc PS3' }),
        ]),
      },
    })
    expect(insertedObjects).toEqual([[
      expect.objectContaining({
        generationEventId: 'generation-event-1',
        documentKind: 'ps1',
        r2ObjectKey: 'ps-generator/generated/operation-1/PS1-Jane-Customer.pdf',
        retainedUntil: new Date('2026-09-24T00:00:00.000Z'),
      }),
      expect.objectContaining({
        generationEventId: 'generation-event-1',
        documentKind: 'ps3',
        r2ObjectKey: 'ps-generator/generated/operation-1/PS3-Jane-Customer.pdf',
        retainedUntil: new Date('2026-09-24T00:00:00.000Z'),
      }),
    ]])
  })
})

async function createFixturePdf(fields: Array<{ name: string; type: 'text' | 'checkbox' }>): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const form = pdf.getForm()

  fields.forEach((field, index) => {
    const y = 780 - index * 36
    if (field.type === 'checkbox') {
      form.createCheckBox(field.name).addToPage(page, { x: 48, y, width: 16, height: 16 })
      return
    }

    form.createTextField(field.name).addToPage(page, { x: 48, y, width: 240, height: 24 })
  })

  return Buffer.from(await pdf.save())
}

async function readForm(bytes: Buffer) {
  return (await PDFDocument.load(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength))).getForm()
}

function defaultInput(mode: 'ps1_only' | 'ps3_only' | 'both') {
  return {
    mode,
    projectDetails: {
      clientName: 'Jane Customer',
      jobAddress: '12 Glass Lane',
      bcNumber: 'BC-123',
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
  }
}

function legacyPs1FixtureFields(): Array<{ name: string; type: 'text' | 'checkbox' }> {
  return [
    { name: 'Name', type: 'text' },
    { name: 'Address', type: 'text' },
    { name: 'Description', type: 'text' },
    { name: 'Height', type: 'text' },
    { name: 'Thickness', type: 'text' },
    { name: 'HeightAboveFix', type: 'text' },
    { name: 'Date0', type: 'text' },
    { name: 'TimberTB', type: 'checkbox' },
    { name: 'ConcreteTB', type: 'checkbox' },
    { name: 'SteelTB', type: 'checkbox' },
    { name: 'InternalTB', type: 'checkbox' },
    { name: 'ExternalTB', type: 'checkbox' },
    { name: 'NewTB', type: 'checkbox' },
    { name: 'ExistingTB', type: 'checkbox' },
    { name: 'ToughenedTB', type: 'checkbox' },
    { name: 'LaminatedTB', type: 'checkbox' },
    { name: 'Direct', type: 'checkbox' },
    { name: 'Cont', type: 'checkbox' },
  ]
}

function legacyPs3FixtureFields(): Array<{ name: string; type: 'text' | 'checkbox' }> {
  return [
    { name: 'BC', type: 'text' },
    { name: 'Address02', type: 'text' },
    { name: 'Description3', type: 'text' },
    { name: 'Description2', type: 'text' },
    { name: 'Date03', type: 'text' },
    { name: 'Legal', type: 'text' },
    { name: 'B1TB', type: 'checkbox' },
    { name: 'B2TB', type: 'checkbox' },
    { name: 'F4TB', type: 'checkbox' },
    { name: 'GlassTB', type: 'checkbox' },
    { name: 'PS1TB', type: 'checkbox' },
  ]
}

function withStandardPs1Mappings(
  configuration: PublishedPsConfiguration,
  fieldMappings: PublishedPsConfiguration['templateVariants'][number]['fieldMappings'],
): PublishedPsConfiguration {
  return {
    ...configuration,
    templateVariants: configuration.templateVariants.map((variant) => (
      variant.systemSlug === 'double-disc' && variant.variantKind === 'standard_ps1'
        ? { ...variant, fieldMappings }
        : variant
    )),
  }
}

function withPoolPs1Mappings(
  configuration: PublishedPsConfiguration,
  fieldMappings: PublishedPsConfiguration['templateVariants'][number]['fieldMappings'],
): PublishedPsConfiguration {
  return {
    ...configuration,
    templateVariants: configuration.templateVariants.map((variant) => (
      variant.systemSlug === 'frameless-spigot' && variant.variantKind === 'pool_ps1'
        ? { ...variant, fieldMappings }
        : variant
    )),
  }
}

function withPs3Template(
  configuration: PublishedPsConfiguration,
  fieldMappings: PublishedPsConfiguration['templateVariants'][number]['fieldMappings'],
  fieldDiscovery: Record<string, unknown>,
): PublishedPsConfiguration {
  return {
    ...configuration,
    templateVariants: configuration.templateVariants.map((variant) => (
      variant.documentKind === 'ps3'
        ? { ...variant, fieldMappings, fieldDiscovery }
        : variant
    )),
  }
}
