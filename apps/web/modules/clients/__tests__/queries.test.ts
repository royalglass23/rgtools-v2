import { describe, expect, it } from 'vitest'
import { shapeClientListRows, shapeClientDetail } from '../queries'

describe('client query shaping', () => {
  it('lists each company once with contact count, project count, and last activity', () => {
    const rows = shapeClientListRows([
      {
        id: 'client-1',
        name: 'Top View Construction',
        companyName: 'Top View Construction Ltd',
        servicem8CompanyUuid: 'company-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
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
      servicem8CompanyUuid: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
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
})
