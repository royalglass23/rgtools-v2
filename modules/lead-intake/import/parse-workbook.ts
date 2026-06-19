import ExcelJS from 'exceljs'
import { Readable } from 'node:stream'
import type { RawImportRow } from './types'

export const TEMPLATE_HEADERS = [
  'Job Number *',
  'Client Name *',
  'Company',
  'Phone',
  'Email',
  'Job Address *',
  'Client Type *',
  'Budget Band *',
  'Complexity *',
  'Price Sensitivity *',
  'Decision Makers',
  'Resource Consent',
  'Building Consent',
  'Building Stage',
  'Notes',
] as const

const REQUIRED_HEADERS = new Set<string>(TEMPLATE_HEADERS)

export async function parseLeadImportWorkbook(
  bytes: ArrayBuffer | Uint8Array,
  fileName = 'upload.xlsx',
): Promise<RawImportRow[]> {
  const lowerName = fileName.toLowerCase()
  if (lowerName.endsWith('.xls') && !lowerName.endsWith('.xlsx')) {
    throw new Error('Save the file as .xlsx before uploading. Legacy .xls files are not supported.')
  }

  const buffer = Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
  const workbook = new ExcelJS.Workbook()

  if (lowerName.endsWith('.csv')) {
    await workbook.csv.read(Readable.from(buffer))
  } else {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])
  }

  const worksheet = workbook.getWorksheet('Leads') ?? workbook.worksheets[0]
  if (!worksheet) throw new Error('No worksheet found. Save the file as .xlsx and try again.')

  const headerRow = worksheet.getRow(1)
  const headers = rowValues(headerRow).map((value) => cellToString(value))
  const missingHeaders = Array.from(REQUIRED_HEADERS).filter((header) => !headers.includes(header))
  if (missingHeaders.length > 0) {
    throw new Error(`Save the file as .xlsx using the lead import template. Missing headers: ${missingHeaders.join(', ')}`)
  }

  const rows: RawImportRow[] = []
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const values = rowValues(row)
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      if (!header) return
      record[header] = cellToString(values[index])
    })
    if (Object.values(record).some(Boolean) && !isDescriptionRow(record)) {
      rows.push({ rowNumber, values: record })
    }
  })

  return rows
}

function isDescriptionRow(record: Record<string, string>): boolean {
  return Object.values(record).some((value) => value.includes('e.g.'))
}

function rowValues(row: ExcelJS.Row): unknown[] {
  const values = row.values
  return Array.isArray(values) ? values.slice(1) : []
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text.trim()
    if ('result' in value) return cellToString(value.result)
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part: { text?: string }) => part.text ?? '').join('').trim()
    }
  }
  return String(value).trim()
}
