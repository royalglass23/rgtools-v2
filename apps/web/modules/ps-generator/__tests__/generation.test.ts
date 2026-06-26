import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'

import {
  buildPublishedPsConfigurationReadModel,
  createPsGeneratorSeedRows,
  type PublishedPsConfiguration,
} from '../configuration'
import { generateProducerStatementPackage } from '../generation'
import type { QuoteStorage } from '@/lib/storage/types'

class MemoryStorage implements QuoteStorage {
  constructor(private readonly objects: Record<string, Buffer>) {}

  async put(key: string, bytes: Buffer): Promise<void> {
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
      'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf': await createFixturePdf([
        { name: 'client_name', type: 'text' },
        { name: 'job_address', type: 'text' },
        { name: 'bc_number', type: 'text' },
        { name: 'description', type: 'text' },
      ]),
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
    })

    expect(result.versionLabel).toBe('wordpress-plugin-v1')
    expect(result.outputs.map((output) => output.documentKind)).toEqual(['ps1', 'ps3'])

    const ps1Form = await readForm(result.outputs.find((output) => output.documentKind === 'ps1')!.bytes)
    expect(ps1Form.getTextField('client_name').getText()).toBe('Jane Customer')
    expect(ps1Form.getTextField('job_address').getText()).toBe('12 Glass Lane')
    expect(ps1Form.getTextField('bc_number').getText()).toBe('BC-123')
    expect(ps1Form.getTextField('description').getText()).toBe(
      'Double Disc glass balustrade to Deck, External, fixed to Timber; Toughened glass at 12mm.',
    )

    const ps3Form = await readForm(result.outputs.find((output) => output.documentKind === 'ps3')!.bytes)
    expect(ps3Form.getTextField('completion_date').getText()).toBe('26/06/2026')
    expect(ps3Form.getTextField('description').getText()).toBe(
      'Double Disc glass balustrade to Deck, External, fixed to Timber; Toughened glass at 12mm.',
    )
  })

  it('generates PS1 only and fills checkbox mappings from selected options', async () => {
    const configuration = buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows())
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps1-gate.pdf': await createFixturePdf([
        { name: 'gate_required', type: 'checkbox' },
        { name: 'description', type: 'text' },
      ]),
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
        structure_type: 'pool-fence',
        location: 'external',
        structure_built: 'existing',
        glass_type: 'laminated',
        thickness: '15mm',
        gate_required: 'yes',
      },
    }, {
      configuration,
      storage: new MemoryStorage(objects),
    })

    expect(result.outputs).toHaveLength(1)
    expect(result.outputs[0]).toMatchObject({
      documentKind: 'ps1',
      templateLabel: 'Double Disc PS1 - Gate',
    })

    const form = await readForm(result.outputs[0].bytes)
    expect(form.getCheckBox('gate_required').isChecked()).toBe(true)
    expect(form.getTextField('description').getText()).toBe(
      'Double Disc glass balustrade with gate to Pool fence, External, fixed to Steel; Laminated glass at 15mm.',
    )
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
      { fieldName: 'max_height', fieldType: 'text', sourceType: 'system_rule', sourceKey: 'heightRules.maxHeightMm', fixedValue: null, checkboxValue: null },
      { fieldName: 'fixed_note', fieldType: 'text', sourceType: 'fixed_value', sourceKey: null, fixedValue: 'Producer Statement package', checkboxValue: null },
    ])
    const objects: Record<string, Buffer> = {
      'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf': await createFixturePdf([
        { name: 'client_name', type: 'text' },
        { name: 'selected_glass', type: 'text' },
        { name: 'max_height', type: 'text' },
        { name: 'fixed_note', type: 'text' },
      ]),
    }

    const result = await generateProducerStatementPackage(defaultInput('ps1_only'), {
      configuration,
      storage: new MemoryStorage(objects),
    })

    const form = await readForm(result.outputs[0].bytes)
    expect(form.getTextField('client_name').getText()).toBe('Jane Customer')
    expect(form.getTextField('selected_glass').getText()).toBe('Toughened')
    expect(form.getTextField('max_height').getText()).toBe('1000')
    expect(form.getTextField('fixed_note').getText()).toBe('Producer Statement package')
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
