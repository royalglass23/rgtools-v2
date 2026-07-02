import { describe, expect, it } from 'vitest'

import {
  filterUnimportedLegacyRecords,
  prepareLegacyPsGenerationMigration,
  type LegacyPsGenerationRecord,
} from '../legacy-migration'

describe('legacy PS generation migration', () => {
  it('preserves available legacy values and falls back to migrated actor label', () => {
    const prepared = prepareLegacyPsGenerationMigration({
      sourceSystem: 'wordpress-ps-plugin',
      sourceRecordId: 'legacy-100',
      clientName: 'Jane Customer',
      jobAddress: '12 Glass Lane',
      bcNumber: 'BC-123',
      lotDescription: 'Lot 4 DP 12345',
      jobNumber: 'R260210',
      systemLabel: 'Double Disc',
      systemSlug: 'double-disc',
      selectedOptions: {
        glass_type: { slug: 'toughened', label: 'Toughened' },
        thickness: '12mm',
      },
      documentKind: 'ps1',
      filename: 'legacy-ps1.pdf',
      createdAt: new Date('2025-12-01T03:00:00.000Z'),
    })

    expect(prepared.generationEvent).toMatchObject({
      actorId: null,
      actorLabel: 'migrated',
      generationMode: 'ps1_only',
      jobNumber: 'R260210',
      clientName: 'Jane Customer',
      jobAddress: '12 Glass Lane',
      selectionsSnapshot: {
        system: { slug: 'double-disc', label: 'Double Disc' },
        options: {
          glass_type: { slug: 'toughened', label: 'Toughened' },
          thickness: { slug: '12mm', label: '12mm' },
        },
      },
      descriptionSnapshot: {
        migratedFilename: 'legacy-ps1.pdf',
        migratedDocumentKind: 'ps1',
      },
    })
    expect(prepared.migrationRecord).toMatchObject({
      sourceSystem: 'wordpress-ps-plugin',
      sourceRecordId: 'legacy-100',
      actorLabel: 'migrated',
    })
  })

  it('filters already imported legacy records by source system and source id', () => {
    const records: LegacyPsGenerationRecord[] = [
      legacyRecord('legacy-100'),
      legacyRecord('legacy-101'),
    ]

    expect(filterUnimportedLegacyRecords(records, [
      { sourceSystem: 'wordpress-ps-plugin', sourceRecordId: 'legacy-100' },
    ]).map((record) => record.sourceRecordId)).toEqual(['legacy-101'])
  })
})

function legacyRecord(sourceRecordId: string): LegacyPsGenerationRecord {
  return {
    sourceSystem: 'wordpress-ps-plugin',
    sourceRecordId,
    clientName: 'Jane Customer',
    jobAddress: '12 Glass Lane',
    documentKind: 'ps3',
    filename: `${sourceRecordId}.pdf`,
    createdAt: new Date('2025-12-01T03:00:00.000Z'),
  }
}
