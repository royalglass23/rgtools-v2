export interface PsHistoryPdfObject {
  id: string
  documentKind: 'ps1' | 'ps3'
  filename: string
  r2ObjectKey: string
  retainedUntil: Date
  deletedAt: Date | null
}

export interface PsHistoryGenerationRecord {
  id: string
  actorLabel: string
  generationMode: 'ps1_only' | 'ps3_only' | 'both'
  jobNumber: string | null
  clientName: string
  jobAddress: string
  bcNumber: string | null
  lotDescription: string | null
  selectionsSnapshot: unknown
  descriptionSnapshot: unknown
  createdAt: Date
  pdfObjects: PsHistoryPdfObject[]
}

export interface PsHistoryListItem {
  id: string
  actorLabel: string
  generationMode: 'ps1_only' | 'ps3_only' | 'both'
  jobNumber: string | null
  clientName: string
  jobAddress: string
  systemLabel: string | null
  selectedOptions: Array<{ categoryLabel: string; label: string }>
  generatedDescriptions: Array<{ documentKind: 'ps1' | 'ps3'; description: string | null }>
  createdAt: Date
  downloads: Array<{
    id: string
    documentKind: 'ps1' | 'ps3'
    filename: string
    r2ObjectKey: string
    retained: boolean
    retainedUntil: Date
  }>
}

export interface PsHistoryStorage {
  get(key: string): Promise<Buffer | null>
}

export async function getRetainedGeneratedPdfDownload(
  object: PsHistoryPdfObject,
  dependencies: { storage: PsHistoryStorage; now?: Date },
): Promise<{ ok: true; filename: string; bytes: Buffer } | { ok: false; reason: 'expired' | 'missing' }> {
  const now = dependencies.now ?? new Date()
  if (object.deletedAt || object.retainedUntil <= now) return { ok: false, reason: 'expired' }

  const bytes = await dependencies.storage.get(object.r2ObjectKey)
  if (!bytes) return { ok: false, reason: 'missing' }

  return { ok: true, filename: object.filename, bytes }
}

export function buildPsGenerationHistory(
  records: PsHistoryGenerationRecord[],
  filters: { jobNumber?: string | null; now?: Date } = {},
): PsHistoryListItem[] {
  const normalizedJobNumber = normalizeText(filters.jobNumber)?.toUpperCase()
  const now = filters.now ?? new Date()

  return records
    .filter((record) => !normalizedJobNumber || record.jobNumber?.toUpperCase() === normalizedJobNumber)
    .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((record) => ({
      id: record.id,
      actorLabel: record.actorLabel,
      generationMode: record.generationMode,
      jobNumber: record.jobNumber,
      clientName: record.clientName,
      jobAddress: record.jobAddress,
      systemLabel: readSystemLabel(record.selectionsSnapshot),
      selectedOptions: readSelectedOptions(record.selectionsSnapshot),
      generatedDescriptions: readGeneratedDescriptions(record.descriptionSnapshot),
      createdAt: record.createdAt,
      downloads: record.pdfObjects.map((object) => ({
        id: object.id,
        documentKind: object.documentKind,
        filename: object.filename,
        r2ObjectKey: object.r2ObjectKey,
        retained: !object.deletedAt && object.retainedUntil > now,
        retainedUntil: object.retainedUntil,
      })),
    }))
}

function readSystemLabel(snapshot: unknown): string | null {
  if (!isRecord(snapshot) || !isRecord(snapshot.system)) return null
  return normalizeText(snapshot.system.label)
}

function readSelectedOptions(snapshot: unknown): Array<{ categoryLabel: string; label: string }> {
  if (!isRecord(snapshot) || !isRecord(snapshot.options)) return []

  return Object.entries(snapshot.options)
    .map(([categorySlug, option]) => {
      if (!isRecord(option)) return null
      return {
        categoryLabel: normalizeText(option.categoryLabel) ?? categorySlug,
        label: normalizeText(option.label) ?? normalizeText(option.slug) ?? '',
      }
    })
    .filter((option): option is { categoryLabel: string; label: string } => Boolean(option?.label))
}

function readGeneratedDescriptions(snapshot: unknown): Array<{ documentKind: 'ps1' | 'ps3'; description: string | null }> {
  if (!isRecord(snapshot)) return []

  if (snapshot.migratedDocumentKind === 'ps1' || snapshot.migratedDocumentKind === 'ps3') {
    const filename = normalizeText(snapshot.migratedFilename)
    return [{
      documentKind: snapshot.migratedDocumentKind,
      description: filename ? `Migrated legacy PDF: ${filename}` : 'Migrated legacy PDF',
    }]
  }

  if (!Array.isArray(snapshot.templates)) return []

  return snapshot.templates
    .map((template) => {
      if (!isRecord(template) || (template.documentKind !== 'ps1' && template.documentKind !== 'ps3')) return null
      return {
        documentKind: template.documentKind,
        description: normalizeText(template.generatedDescription),
      }
    })
    .filter((template): template is { documentKind: 'ps1' | 'ps3'; description: string | null } => Boolean(template))
}

function normalizeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
