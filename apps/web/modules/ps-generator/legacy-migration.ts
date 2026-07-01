export interface LegacyPsGenerationRecord {
  sourceSystem: string
  sourceRecordId: string
  clientName: string
  jobAddress: string
  bcNumber?: string | null
  lotDescription?: string | null
  jobNumber?: string | null
  systemLabel?: string | null
  systemSlug?: string | null
  selectedOptions?: Record<string, { label?: string | null; slug?: string | null } | string>
  documentKind: 'ps1' | 'ps3'
  filename: string
  createdAt: Date
  actorId?: string | null
  actorLabel?: string | null
}

export interface PreparedLegacyPsMigration {
  sourceSystem: string
  sourceRecordId: string
  generationEvent: {
    actorId: string | null
    actorLabel: string
    generationMode: 'ps1_only' | 'ps3_only'
    jobNumber: string | null
    clientName: string
    jobAddress: string
    bcNumber: string | null
    lotDescription: string | null
    selectionsSnapshot: {
      system: { slug: string | null; label: string | null }
      options: Record<string, { slug: string; label: string }>
    }
    descriptionSnapshot: {
      migratedFilename: string
      migratedDocumentKind: 'ps1' | 'ps3'
    }
    createdAt: Date
  }
  migrationRecord: {
    sourceSystem: string
    sourceRecordId: string
    actorLabel: string
    snapshot: LegacyPsGenerationRecord
  }
}

export function prepareLegacyPsGenerationMigration(
  record: LegacyPsGenerationRecord,
): PreparedLegacyPsMigration {
  const actorLabel = normalizeText(record.actorLabel) ?? 'migrated'
  const selectedOptions = normalizeSelectedOptions(record.selectedOptions ?? {})

  return {
    sourceSystem: record.sourceSystem,
    sourceRecordId: record.sourceRecordId,
    generationEvent: {
      actorId: normalizeText(record.actorId),
      actorLabel,
      generationMode: record.documentKind === 'ps1' ? 'ps1_only' : 'ps3_only',
      jobNumber: normalizeText(record.jobNumber),
      clientName: record.clientName,
      jobAddress: record.jobAddress,
      bcNumber: normalizeText(record.bcNumber),
      lotDescription: normalizeText(record.lotDescription),
      selectionsSnapshot: {
        system: {
          slug: normalizeText(record.systemSlug),
          label: normalizeText(record.systemLabel),
        },
        options: selectedOptions,
      },
      descriptionSnapshot: {
        migratedFilename: record.filename,
        migratedDocumentKind: record.documentKind,
      },
      createdAt: record.createdAt,
    },
    migrationRecord: {
      sourceSystem: record.sourceSystem,
      sourceRecordId: record.sourceRecordId,
      actorLabel,
      snapshot: record,
    },
  }
}

export function filterUnimportedLegacyRecords(
  legacyRecords: LegacyPsGenerationRecord[],
  importedSources: Array<{ sourceSystem: string; sourceRecordId: string }>,
): LegacyPsGenerationRecord[] {
  const imported = new Set(importedSources.map((source) => `${source.sourceSystem}:${source.sourceRecordId}`))
  return legacyRecords.filter((record) => !imported.has(`${record.sourceSystem}:${record.sourceRecordId}`))
}

function normalizeSelectedOptions(
  options: NonNullable<LegacyPsGenerationRecord['selectedOptions']>,
): Record<string, { slug: string; label: string }> {
  return Object.fromEntries(Object.entries(options).map(([category, value]) => {
    if (typeof value === 'string') return [category, { slug: value, label: value }]
    const slug = normalizeText(value.slug) ?? normalizeText(value.label) ?? ''
    return [category, { slug, label: normalizeText(value.label) ?? slug }]
  }))
}

function normalizeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
