import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  createServiceM8RequestFromEnv,
  downloadAttachmentFile,
  type ServiceM8AttachmentRecord,
  type ServiceM8FetchRequest,
} from '@/lib/servicem8/client'
import { fetchAiGuidanceOpenAi, isAiGuidanceTimeoutError } from '@/modules/quote-tracker/ai-timeout'
import { servicem8InterpretedFiles } from '@rgtools/db/schema'

export type FileInterpretationStatus = 'interpreted' | 'unsupported' | 'failed'

export type ServiceM8JobAttachment = {
  servicem8AttachmentUuid: string
  servicem8JobUuid: string
  name: string | null
  fileType: string | null
  attachmentSource: string | null
  editDate: string
}

export type InterpretedServiceM8File = ServiceM8JobAttachment & {
  status: FileInterpretationStatus
  summary: string | null
  model: string | null
  interpretedAt: Date | null
  errorMessage: string | null
  errorMetadata: Record<string, unknown>
}

export type ServiceM8FileContext = {
  servicem8JobUuid: string
  files: InterpretedServiceM8File[]
  sourceStatus: {
    status: 'complete' | 'partial'
    total: number
    interpreted: number
    unsupported: number
    failed: number
  }
}

export type ServiceM8FileContextDeps = {
  listJobAttachments: (servicem8JobUuid: string) => Promise<ServiceM8JobAttachment[]>
  findCachedFile: (servicem8AttachmentUuid: string, editDate: string) => Promise<InterpretedServiceM8File | null>
  downloadAttachment: (servicem8AttachmentUuid: string) => Promise<ArrayBuffer>
  interpretFile: (input: { attachment: ServiceM8JobAttachment; bytes: ArrayBuffer }) => Promise<{
    summary: string
    model: string
  }>
  saveFile: (record: InterpretedServiceM8File) => Promise<InterpretedServiceM8File>
  waitBeforeRetry?: (ms: number) => Promise<void>
  retryDelaysMs?: number[]
  now: () => Date
}

type FileSupport =
  | { supported: true; kind: 'image' | 'file'; mimeType: string; detail?: 'low' | 'high' }
  | { supported: false; reason: string; errorType: 'unsupported_cad' | 'unsupported_file_type' }

export async function buildServiceM8FileContext(
  input: { servicem8JobUuid: string },
  deps: ServiceM8FileContextDeps = realServiceM8FileContextDeps,
): Promise<ServiceM8FileContext> {
  const attachments = await deps.listJobAttachments(input.servicem8JobUuid)
  const files: InterpretedServiceM8File[] = []

  for (const attachment of attachments) {
    const cached = await deps.findCachedFile(attachment.servicem8AttachmentUuid, attachment.editDate)
    if (cached && shouldReuseCachedFile(cached, attachment)) {
      files.push(cached)
      continue
    }

    files.push(await interpretAndCacheAttachment(attachment, deps))
  }

  return {
    servicem8JobUuid: input.servicem8JobUuid,
    files,
    sourceStatus: summarizeFiles(files),
  }
}

async function interpretAndCacheAttachment(
  attachment: ServiceM8JobAttachment,
  deps: ServiceM8FileContextDeps,
): Promise<InterpretedServiceM8File> {
  const support = classifyServiceM8Attachment(attachment)
  if (!support.supported) {
    return deps.saveFile({
      ...baseFileRecord(attachment),
      status: 'unsupported',
      summary: null,
      model: null,
      interpretedAt: null,
      errorMessage: support.reason,
      errorMetadata: { errorType: support.errorType },
    })
  }

  try {
    const bytes = await deps.downloadAttachment(attachment.servicem8AttachmentUuid)
    const interpretation = await interpretFileWithRetry({ attachment, bytes }, deps)
    return deps.saveFile({
      ...baseFileRecord(attachment),
      status: 'interpreted',
      summary: interpretation.summary,
      model: interpretation.model,
      interpretedAt: deps.now(),
      errorMessage: null,
      errorMetadata: {},
    })
  } catch (error) {
    return deps.saveFile({
      ...baseFileRecord(attachment),
      status: 'failed',
      summary: null,
      model: null,
      interpretedAt: deps.now(),
      errorMessage: `File interpretation failed for ${attachment.name ?? attachment.servicem8AttachmentUuid}: ${safeErrorMessage(error)}`,
      errorMetadata: { errorType: classifyInterpretationError(error) },
    })
  }
}

function baseFileRecord(attachment: ServiceM8JobAttachment): ServiceM8JobAttachment {
  return {
    servicem8AttachmentUuid: attachment.servicem8AttachmentUuid,
    servicem8JobUuid: attachment.servicem8JobUuid,
    name: attachment.name,
    fileType: attachment.fileType,
    attachmentSource: attachment.attachmentSource,
    editDate: attachment.editDate,
  }
}

export function classifyServiceM8Attachment(attachment: Pick<ServiceM8JobAttachment, 'name' | 'fileType'>): FileSupport {
  const fileType = attachment.fileType?.toLowerCase() ?? ''
  const extension = fileExtension(attachment.name)

  if (fileType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) {
    return { supported: true, kind: 'image', mimeType: mimeTypeForImageAttachment(attachment) }
  }
  if (fileType.includes('pdf') || extension === 'pdf') {
    return { supported: true, kind: 'file', mimeType: 'application/pdf', detail: 'low' }
  }
  const commonFileMimeType = mimeTypeForCommonFile(extension, fileType)
  if (commonFileMimeType) {
    return { supported: true, kind: 'file', mimeType: commonFileMimeType }
  }
  if (isCadExtension(extension) || fileType.includes('acad') || fileType.includes('dwg') || fileType.includes('dxf')) {
    return {
      supported: false,
      reason: 'CAD files are detected but not interpreted in v1.',
      errorType: 'unsupported_cad',
    }
  }

  return {
    supported: false,
    reason: 'Unsupported ServiceM8 attachment type for AI Guidance v1.',
    errorType: 'unsupported_file_type',
  }
}

function summarizeFiles(files: InterpretedServiceM8File[]): ServiceM8FileContext['sourceStatus'] {
  const interpreted = files.filter((file) => file.status === 'interpreted').length
  const unsupported = files.filter((file) => file.status === 'unsupported').length
  const failed = files.filter((file) => file.status === 'failed').length

  return {
    status: unsupported > 0 || failed > 0 ? 'partial' : 'complete',
    total: files.length,
    interpreted,
    unsupported,
    failed,
  }
}

function shouldReuseCachedFile(cached: InterpretedServiceM8File, attachment: ServiceM8JobAttachment): boolean {
  if (cached.status === 'interpreted') return true
  const support = classifyServiceM8Attachment(attachment)
  if (!support.supported) return true
  return false
}

export const realServiceM8FileContextDeps: ServiceM8FileContextDeps = {
  listJobAttachments: (servicem8JobUuid) => listServiceM8JobAttachments(servicem8JobUuid),
  findCachedFile: (servicem8AttachmentUuid, editDate) => findCachedInterpretedFile(servicem8AttachmentUuid, editDate),
  downloadAttachment: (servicem8AttachmentUuid) => downloadAttachmentFile(servicem8AttachmentUuid),
  interpretFile: (input) => interpretServiceM8FileWithOpenAI(input),
  saveFile: (record) => saveInterpretedFile(record),
  waitBeforeRetry: sleep,
  retryDelaysMs: [1_000, 2_500],
  now: () => new Date(),
}

export async function listServiceM8JobAttachments(
  servicem8JobUuid: string,
  request: ServiceM8FetchRequest = createServiceM8RequestFromEnv(),
): Promise<ServiceM8JobAttachment[]> {
  const response = await request(`/attachment.json${odataFilter(`related_object_uuid eq '${escapeOdataString(servicem8JobUuid)}'`)}`)
  if (!response.ok) throw new Error(`ServiceM8 attachment list failed with HTTP ${response.status}`)
  const rows = await response.json()
  if (!Array.isArray(rows)) throw new Error('ServiceM8 attachment list returned an unexpected response.')

  return (rows as ServiceM8AttachmentRecord[])
    .filter((row) => row.uuid && String(row.active ?? '1') !== '0')
    .map((row) => ({
      servicem8AttachmentUuid: row.uuid!,
      servicem8JobUuid: row.related_object_uuid ?? row.object_uuid ?? servicem8JobUuid,
      name: row.attachment_name ?? null,
      fileType: row.file_type ?? null,
      attachmentSource: row.attachment_source ?? null,
      editDate: row.edit_date ?? '',
    }))
    .filter((row) => row.editDate.length > 0)
}

export async function findCachedInterpretedFile(
  servicem8AttachmentUuid: string,
  editDate: string,
): Promise<InterpretedServiceM8File | null> {
  const [record] = await db
    .select()
    .from(servicem8InterpretedFiles)
    .where(and(
      eq(servicem8InterpretedFiles.servicem8AttachmentUuid, servicem8AttachmentUuid),
      eq(servicem8InterpretedFiles.editDate, editDate),
    ))
    .limit(1)

  return record ? toInterpretedServiceM8File(record) : null
}

export async function saveInterpretedFile(record: InterpretedServiceM8File): Promise<InterpretedServiceM8File> {
  const [saved] = await db
    .insert(servicem8InterpretedFiles)
    .values(record)
    .onConflictDoUpdate({
      target: [servicem8InterpretedFiles.servicem8AttachmentUuid, servicem8InterpretedFiles.editDate],
      set: {
        servicem8JobUuid: record.servicem8JobUuid,
        name: record.name,
        fileType: record.fileType,
        attachmentSource: record.attachmentSource,
        status: record.status,
        summary: record.summary,
        model: record.model,
        interpretedAt: record.interpretedAt,
        errorMessage: record.errorMessage,
        errorMetadata: record.errorMetadata,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!saved) throw new Error('ServiceM8 interpreted file cache row was not saved')
  return toInterpretedServiceM8File(saved)
}

export async function interpretServiceM8FileWithOpenAI(input: {
  attachment: ServiceM8JobAttachment
  bytes: ArrayBuffer
}): Promise<{ summary: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

  const model = process.env.OPENAI_FILE_CONTEXT_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
  const fileInput = buildOpenAIFileInput(input.attachment, input.bytes)
  const response = await fetchAiGuidanceOpenAi('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'user',
          content: [
            fileInput,
            {
              type: 'input_text',
              text: [
                'Summarise this ServiceM8 job attachment for Royal Glass staff.',
                'Focus on site conditions, glass/balustrade/shower/pool-fence scope, measurements, customer requirements, risks, blockers, and follow-up questions.',
                'Do not invent details. If the file is low signal, say what can and cannot be determined.',
                'Return a concise plain-text summary only.',
              ].join(' '),
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`OpenAI returned HTTP ${response.status}${body ? `: ${body}` : ''}`)
  }

  const payload = await response.json()
  const summary = extractOpenAIResponseText(payload)
  if (!summary) throw new Error('OpenAI file interpretation response did not include text')
  return { summary, model }
}

function buildOpenAIFileInput(attachment: ServiceM8JobAttachment, bytes: ArrayBuffer) {
  const support = classifyServiceM8Attachment(attachment)
  if (!support.supported) throw new Error('Unsupported ServiceM8 attachment type for AI Guidance v1.')

  const base64 = Buffer.from(bytes).toString('base64')
  if (support.kind === 'image') {
    return {
      type: 'input_image',
      image_url: `data:${support.mimeType};base64,${base64}`,
    }
  }

  const fileInput: Record<string, string> = {
    type: 'input_file',
    filename: attachment.name ?? 'servicem8-attachment',
    file_data: `data:${support.mimeType};base64,${base64}`,
  }
  if (support.detail) fileInput.detail = support.detail
  return fileInput
}

function mimeTypeForImageAttachment(attachment: Pick<ServiceM8JobAttachment, 'name' | 'fileType'>): string {
  const fileType = attachment.fileType?.toLowerCase()
  if (fileType?.startsWith('image/')) return fileType
  const extension = fileExtension(attachment.name)
  if (extension === 'png') return 'image/png'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'gif') return 'image/gif'
  return 'image/jpeg'
}

function mimeTypeForCommonFile(extension: string, fileType: string): string | null {
  if (fileType && !fileType.startsWith('application/octet-stream')) {
    if (isCommonFileMimeType(fileType)) return fileType
  }

  const byExtension: Record<string, string> = {
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    tsv: 'text/tab-separated-values',
    json: 'application/json',
    html: 'text/html',
    htm: 'text/html',
    xml: 'application/xml',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    rtf: 'application/rtf',
    odt: 'application/vnd.oasis.opendocument.text',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    iif: 'text/plain',
  }

  return byExtension[extension] ?? null
}

function isCommonFileMimeType(fileType: string): boolean {
  return fileType.startsWith('text/')
    || fileType.includes('json')
    || fileType.includes('xml')
    || fileType.includes('word')
    || fileType.includes('presentation')
    || fileType.includes('powerpoint')
    || fileType.includes('spreadsheet')
    || fileType.includes('excel')
    || fileType.includes('opendocument')
    || fileType.includes('rtf')
}

function extractOpenAIResponseText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>
  if (typeof record.output_text === 'string' && record.output_text.trim()) return record.output_text.trim()

  const output = record.output
  if (!Array.isArray(output)) return null

  const chunks: string[] = []
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const content = (item as Record<string, unknown>).content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const text = (part as Record<string, unknown>).text
      if (typeof text === 'string' && text.trim()) chunks.push(text.trim())
    }
  }

  return chunks.length > 0 ? chunks.join('\n\n') : null
}

function toInterpretedServiceM8File(record: typeof servicem8InterpretedFiles.$inferSelect): InterpretedServiceM8File {
  return {
    servicem8AttachmentUuid: record.servicem8AttachmentUuid,
    servicem8JobUuid: record.servicem8JobUuid,
    name: record.name,
    fileType: record.fileType,
    attachmentSource: record.attachmentSource,
    editDate: record.editDate,
    status: toFileInterpretationStatus(record.status),
    summary: record.summary,
    model: record.model,
    interpretedAt: record.interpretedAt,
    errorMessage: record.errorMessage,
    errorMetadata: isRecord(record.errorMetadata) ? record.errorMetadata : {},
  }
}

function toFileInterpretationStatus(value: string): FileInterpretationStatus {
  if (value === 'interpreted' || value === 'unsupported' || value === 'failed') return value
  return 'failed'
}

function safeErrorMessage(error: unknown): string {
  if (isAiGuidanceTimeoutError(error)) return 'AI Guidance file interpretation timed out.'
  if (error instanceof Error && error.message) {
    const httpMatch = error.message.match(/OpenAI returned HTTP\s+(\d{3})/)
    if (httpMatch) return `OpenAI returned HTTP ${httpMatch[1]}.`
    return `${error.message.slice(0, 240).replace(/\s+/g, ' ').trim()}.`
  }
  return 'File interpretation failed.'
}

function classifyInterpretationError(error: unknown): string {
  if (isAiGuidanceTimeoutError(error)) return 'timeout'
  if (!(error instanceof Error)) return 'interpretation_error'
  if (error.message.includes('OPENAI_API_KEY')) return 'configuration_error'
  if (error.message.includes('HTTP')) return 'ai_response_error'
  if (error.message.includes('response did not include text')) return 'malformed_response'
  return 'interpretation_error'
}

async function interpretFileWithRetry(
  input: { attachment: ServiceM8JobAttachment; bytes: ArrayBuffer },
  deps: Pick<ServiceM8FileContextDeps, 'interpretFile' | 'retryDelaysMs' | 'waitBeforeRetry'>,
): Promise<{ summary: string; model: string }> {
  const retryDelaysMs = deps.retryDelaysMs ?? []
  let attempt = 0

  while (true) {
    try {
      return await deps.interpretFile(input)
    } catch (error) {
      const retryDelayMs = retryDelaysMs[attempt]
      if (retryDelayMs == null || !isTransientInterpretationError(error)) throw error
      await (deps.waitBeforeRetry ?? sleep)(retryDelayMs)
      attempt += 1
    }
  }
}

function isTransientInterpretationError(error: unknown): boolean {
  if (isAiGuidanceTimeoutError(error)) return true
  if (!(error instanceof Error)) return false
  const httpMatch = error.message.match(/HTTP\s+(\d{3})/)
  if (!httpMatch) return false
  const status = Number(httpMatch[1])
  return status === 429 || status >= 500
}

function fileExtension(name: string | null | undefined): string {
  const trimmed = name?.trim().toLowerCase()
  if (!trimmed || !trimmed.includes('.')) return ''
  return trimmed.split('.').pop() ?? ''
}

function isCadExtension(extension: string): boolean {
  return ['dwg', 'dxf', 'dgn', 'ifc', 'rvt'].includes(extension)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function odataFilter(expr: string): string {
  return `?%24filter=${encodeURIComponent(expr)}`
}

function escapeOdataString(value: string): string {
  return value.replace(/'/g, "''")
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
