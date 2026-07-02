import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { discoverPdfFields } from '../template-fields'

describe('PS template field discovery', () => {
  it('discovers text and checkbox AcroForm fields from uploaded template bytes', async () => {
    const pdf = await PDFDocument.create()
    const page = pdf.addPage([595, 842])
    const form = pdf.getForm()
    form.createTextField('client_name').addToPage(page, { x: 48, y: 760, width: 200, height: 24 })
    form.createTextField('job_address').addToPage(page, { x: 48, y: 720, width: 200, height: 24 })
    form.createCheckBox('gate_required').addToPage(page, { x: 48, y: 680, width: 16, height: 16 })

    await expect(discoverPdfFields(Buffer.from(await pdf.save()))).resolves.toEqual({
      text: ['client_name', 'job_address'],
      checkbox: ['gate_required'],
    })
  })
})
