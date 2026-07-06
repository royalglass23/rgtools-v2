import { describe, expect, it } from 'vitest'
import { filterClientListRows, shapeClientDetail, shapeClientListRows } from '../queries'

describe('client query shaping', () => {
  it('lists each company once with contact count, project count, and last activity', () => {
    const rows = shapeClientListRows([
      {
        id: 'client-1',
        name: 'Top View Construction',
        companyName: 'Top View Construction Ltd',
        email: 'office@topview.test',
        phone: '09 111 1111',
        servicem8CompanyUuid: 'company-1',
        canonicalSource: 'import',
        reviewStatus: 'pending_review',
        identityType: 'company',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
        aliases: [{ alias: 'Topview Builders' }],
        contacts: [
          { id: 'contact-1', updatedAt: new Date('2026-01-03T00:00:00Z') },
          { id: 'contact-2', updatedAt: new Date('2026-01-04T00:00:00Z') },
        ],
        leads: [
          { id: 'lead-1', updatedAt: new Date('2026-01-05T00:00:00Z') },
          { id: 'lead-2', updatedAt: new Date('2026-01-06T00:00:00Z') },
        ],
        quotes: [
          { id: 'quote-1', updatedAt: new Date('2026-01-07T00:00:00Z') },
        ],
      },
    ])

    expect(rows).toEqual([
      {
        id: 'client-1',
        companyName: 'Top View Construction Ltd',
        servicem8CompanyUuid: 'company-1',
        reviewStatus: 'pending_review',
        aliasNames: ['Topview Builders'],
        cleanupFlags: {
          imported: true,
          needsReview: true,
          reviewed: false,
          possibleDuplicate: false,
          noContactDetails: false,
          noClientType: false,
          servicem8Linked: true,
        },
        contactCount: 2,
        projectCount: 3,
        lastActivityAt: new Date('2026-01-07T00:00:00Z'),
      },
    ])
  })

  it('shapes detail data with contacts, leads, quotes, and project addresses', () => {
    const detail = shapeClientDetail({
      id: 'client-1',
      name: 'Top View Construction',
      companyName: null,
      email: 'office@topview.test',
      phone: '09 111 1111',
      servicem8CompanyUuid: null,
      canonicalSource: 'manual',
      reviewStatus: 'reviewed',
      identityType: 'individual_homeowner',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
      aliases: [],
      contacts: [
        {
          id: 'contact-1',
          name: 'Vivi Zhang',
          email: 'vivi@example.test',
          phone: '021 000 000',
          phoneNormalized: '+6421000000',
          updatedAt: new Date('2026-01-03T00:00:00Z'),
        },
      ],
      leads: [
        {
          id: 'lead-1',
          projectType: 'Shower',
          location: '12 Glass St',
          servicem8JobNumber: 'R260001',
          tier: 'A',
          updatedAt: new Date('2026-01-04T00:00:00Z'),
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ],
      quotes: [
        {
          id: 'quote-1',
          shortCode: 'ABC123',
          jobDescription: 'Shopfront replacement',
          jobAddress: '34 Quote Rd',
          quoteValue: '1234.50',
          statusTag: 'hot',
          updatedAt: new Date('2026-01-05T00:00:00Z'),
          createdAt: new Date('2026-01-02T00:00:00Z'),
        },
      ],
    })

    expect(detail?.projects).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'lead', id: 'lead-1', address: '12 Glass St' }),
      expect.objectContaining({ kind: 'quote', id: 'quote-1', address: '34 Quote Rd' }),
    ]))
    expect(detail?.contacts).toHaveLength(1)
    expect(detail?.leads).toHaveLength(1)
    expect(detail?.quotes).toHaveLength(1)
  })

  it('finds clients by canonical company name or aliases', () => {
    const rows = shapeClientListRows([
      clientFixture({
        id: 'client-1',
        name: 'Top View Construction',
        companyName: 'Top View Construction Ltd',
        aliases: [{ alias: 'Topview Builders' }, { alias: 'TV Construction' }],
      }),
      clientFixture({
        id: 'client-2',
        name: 'Clearline Glass',
        companyName: null,
        aliases: [],
      }),
    ])

    expect(filterClientListRows(rows, { search: 'topview builders' }).map((row) => row.id)).toEqual(['client-1'])
    expect(filterClientListRows(rows, { search: 'clearline' }).map((row) => row.id)).toEqual(['client-2'])
  })

  it('filters imported cleanup states including review, duplicate, missing data, and ServiceM8 link states', () => {
    const rows = shapeClientListRows([
      clientFixture({
        id: 'imported-needs-review',
        name: 'Imported Needs Review',
        email: null,
        phone: null,
        servicem8CompanyUuid: 'company-1',
        canonicalSource: 'import',
        reviewStatus: 'pending_review',
        identityType: null,
        contacts: [],
      }),
      clientFixture({
        id: 'reviewed',
        name: 'Reviewed Client',
        email: 'reviewed@example.test',
        canonicalSource: 'manual',
        reviewStatus: 'reviewed',
        identityType: 'company',
        contacts: [],
      }),
      clientFixture({
        id: 'duplicate-a',
        name: 'Duplicate Client',
        canonicalSource: 'manual',
        reviewStatus: 'reviewed',
      }),
      clientFixture({
        id: 'duplicate-b',
        name: 'Duplicate Client',
        canonicalSource: 'manual',
        reviewStatus: 'reviewed',
      }),
    ])

    expect(filterClientListRows(rows, { cleanupFilter: 'imported' }).map((row) => row.id)).toEqual(['imported-needs-review'])
    expect(filterClientListRows(rows, { cleanupFilter: 'needs_review' }).map((row) => row.id)).toEqual(['imported-needs-review'])
    expect(filterClientListRows(rows, { cleanupFilter: 'reviewed' }).map((row) => row.id)).toEqual(['reviewed', 'duplicate-a', 'duplicate-b'])
    expect(filterClientListRows(rows, { cleanupFilter: 'possible_duplicates' }).map((row) => row.id)).toEqual(['duplicate-a', 'duplicate-b'])
    expect(filterClientListRows(rows, { cleanupFilter: 'no_contact_details' }).map((row) => row.id)).toEqual(['imported-needs-review'])
    expect(filterClientListRows(rows, { cleanupFilter: 'no_client_type' }).map((row) => row.id)).toEqual(['imported-needs-review', 'duplicate-a', 'duplicate-b'])
    expect(filterClientListRows(rows, { cleanupFilter: 'servicem8_linked' }).map((row) => row.id)).toEqual(['imported-needs-review'])
  })
})

function clientFixture(overrides: Partial<Parameters<typeof shapeClientListRows>[0][number]> & { id: string; name: string }) {
  return {
    companyName: null,
    email: null,
    phone: null,
    servicem8CompanyUuid: null,
    canonicalSource: 'manual',
    reviewStatus: 'reviewed',
    identityType: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    aliases: [],
    contacts: [{ id: `${overrides.id}-contact`, updatedAt: new Date('2026-01-03T00:00:00Z') }],
    leads: [],
    quotes: [],
    ...overrides,
  }
}
