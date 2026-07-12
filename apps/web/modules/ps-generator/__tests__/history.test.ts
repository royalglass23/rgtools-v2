import { describe, expect, it } from 'vitest'

import { buildPsGenerationHistory, getRetainedGeneratedPdfDownload, type PsHistoryGenerationRecord } from '../history'

describe('PS generation history', () => {
  it('renders snapshot values and retained download state for generated and migrated records', () => {
    const history = buildPsGenerationHistory([
      {
        id: 'event-new',
        actorLabel: 'Jane Staff',
        generationMode: 'both',
        jobNumber: 'R260210',
        clientName: 'Jane Customer',
        jobAddress: '12 Glass Lane',
        bcNumber: 'BC-123',
        lotDescription: null,
        selectionsSnapshot: {
          system: { slug: 'double-disc', label: 'Double Disc' },
          options: {
            structure_material: { categoryLabel: 'Structure material', slug: 'timber', label: 'Timber' },
          },
        },
        descriptionSnapshot: {
          templates: [
            { documentKind: 'ps1', generatedDescription: 'PS1 description from snapshot.' },
            { documentKind: 'ps3', generatedDescription: 'PS3 description from snapshot.' },
          ],
        },
        createdAt: new Date('2026-06-26T00:00:00.000Z'),
        pdfObjects: [
          {
            id: 'pdf-ps1',
            documentKind: 'ps1',
            filename: 'PS1-Jane-Customer.pdf',
            r2ObjectKey: 'ps-generator/generated/event-new/PS1-Jane-Customer.pdf',
            retainedUntil: new Date('2026-09-24T00:00:00.000Z'),
            deletedAt: null,
          },
          {
            id: 'pdf-ps3',
            documentKind: 'ps3',
            filename: 'PS3-Jane-Customer.pdf',
            r2ObjectKey: 'ps-generator/generated/event-new/PS3-Jane-Customer.pdf',
            retainedUntil: new Date('2026-06-01T00:00:00.000Z'),
            deletedAt: new Date('2026-07-01T00:00:00.000Z'),
          },
        ],
      },
      {
        id: 'event-migrated',
        actorLabel: 'migrated',
        generationMode: 'ps1_only',
        jobNumber: 'R250001',
        clientName: 'Legacy Customer',
        jobAddress: '5 Old Road',
        bcNumber: null,
        lotDescription: null,
        selectionsSnapshot: {
          system: { slug: 'legacy-system', label: 'Legacy System' },
          options: {},
        },
        descriptionSnapshot: {},
        createdAt: new Date('2025-12-01T00:00:00.000Z'),
        pdfObjects: [],
      },
    ], {
      jobNumber: ' r260210 ',
      now: new Date('2026-07-01T00:00:00.000Z'),
    })

    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      id: 'event-new',
      actorLabel: 'Jane Staff',
      generationMode: 'both',
      jobNumber: 'R260210',
      systemLabel: 'Double Disc',
      selectedOptions: [{ categoryLabel: 'Structure material', label: 'Timber' }],
      generatedDescriptions: [
        { documentKind: 'ps1', description: 'PS1 description from snapshot.' },
        { documentKind: 'ps3', description: 'PS3 description from snapshot.' },
      ],
      downloads: [
        {
          documentKind: 'ps1',
          filename: 'PS1-Jane-Customer.pdf',
          retained: true,
        },
        {
          documentKind: 'ps3',
          filename: 'PS3-Jane-Customer.pdf',
          retained: false,
        },
      ],
    })
  })

  it('returns retained PDF bytes and blocks expired objects', async () => {
    const now = new Date('2026-07-01T00:00:00.000Z')
    const retained = {
      id: 'pdf-ps1',
      documentKind: 'ps1' as const,
      filename: 'PS1-Jane-Customer.pdf',
      r2ObjectKey: 'ps-generator/generated/event-new/PS1-Jane-Customer.pdf',
      retainedUntil: new Date('2026-09-24T00:00:00.000Z'),
      deletedAt: null,
    }
    const expired = {
      ...retained,
      documentKind: 'ps3' as const,
      filename: 'PS3-Jane-Customer.pdf',
      retainedUntil: new Date('2026-06-01T00:00:00.000Z'),
    }

    await expect(getRetainedGeneratedPdfDownload(retained, {
      now,
      storage: { get: async () => Buffer.from('pdf') },
    })).resolves.toEqual({
      ok: true,
      filename: 'PS1-Jane-Customer.pdf',
      bytes: Buffer.from('pdf'),
    })
    await expect(getRetainedGeneratedPdfDownload(expired, {
      now,
      storage: { get: async () => Buffer.from('pdf') },
    })).resolves.toEqual({ ok: false, reason: 'expired' })
  })

  it('searches history by job number, client name, or job address', () => {
    const records = [
      historyRecord({
        id: 'event-job',
        jobNumber: 'R260210',
        clientName: 'Jane Customer',
        jobAddress: '12 Glass Lane',
      }),
      historyRecord({
        id: 'event-client',
        jobNumber: 'R260211',
        clientName: 'Rosedale Holdings',
        jobAddress: '5 Other Road',
      }),
      historyRecord({
        id: 'event-address',
        jobNumber: 'R260212',
        clientName: 'Address Customer',
        jobAddress: '13 Paul Matthews Road',
      }),
    ]

    expect(buildPsGenerationHistory(records, { search: '260210' }).map((record) => record.id)).toEqual(['event-job'])
    expect(buildPsGenerationHistory(records, { search: 'rosedale' }).map((record) => record.id)).toEqual(['event-client'])
    expect(buildPsGenerationHistory(records, { search: 'paul matthews' }).map((record) => record.id)).toEqual(['event-address'])
  })

  it('renders migrated legacy PDF snapshots as human-readable descriptions', () => {
    const history = buildPsGenerationHistory([{
      id: 'event-migrated',
      actorLabel: 'migrated',
      generationMode: 'ps3_only',
      jobNumber: 'R250001',
      clientName: 'Legacy Customer',
      jobAddress: '5 Old Road',
      bcNumber: null,
      lotDescription: null,
      selectionsSnapshot: {
        system: { slug: 'legacy-system', label: 'Legacy System' },
        options: {
          glass_type: { slug: 'laminated', label: 'Laminated' },
        },
      },
      descriptionSnapshot: {
        migratedFilename: 'legacy-ps3.pdf',
        migratedDocumentKind: 'ps3',
      },
      createdAt: new Date('2025-12-01T00:00:00.000Z'),
      pdfObjects: [],
    }])

    expect(history[0].generatedDescriptions).toEqual([{
      documentKind: 'ps3',
      description: 'Migrated legacy PDF: legacy-ps3.pdf',
    }])
  })
})

function historyRecord(overrides: Partial<PsHistoryGenerationRecord>): PsHistoryGenerationRecord {
  return {
    id: 'event',
    actorLabel: 'Jane Staff',
    generationMode: 'ps1_only',
    jobNumber: null,
    clientName: 'Jane Customer',
    jobAddress: '12 Glass Lane',
    bcNumber: null,
    lotDescription: null,
    selectionsSnapshot: {},
    descriptionSnapshot: {},
    createdAt: new Date('2026-06-26T00:00:00.000Z'),
    pdfObjects: [],
    ...overrides,
  }
}
