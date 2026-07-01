import { PDFCheckBox, PDFDocument, PDFTextField } from 'pdf-lib'

export interface DiscoveredPdfFields {
  text: string[]
  checkbox: string[]
}

export async function discoverPdfFields(bytes: Buffer): Promise<DiscoveredPdfFields> {
  const pdf = await PDFDocument.load(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength))
  const fields = pdf.getForm().getFields()
  const discovered: DiscoveredPdfFields = {
    text: [],
    checkbox: [],
  }

  for (const field of fields) {
    if (field instanceof PDFTextField) discovered.text.push(field.getName())
    if (field instanceof PDFCheckBox) discovered.checkbox.push(field.getName())
  }

  discovered.text.sort((a, b) => a.localeCompare(b))
  discovered.checkbox.sort((a, b) => a.localeCompare(b))
  return discovered
}
