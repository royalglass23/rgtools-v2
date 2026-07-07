import { describe, expect, it } from 'vitest'
import { buildClientIdentityUpsert } from '../client-identity'

const now = new Date('2026-07-07T10:00:00.000Z')

describe('buildClientIdentityUpsert', () => {
  it('separates canonical display fields from ServiceM8 source metadata on import', () => {
    const update = buildClientIdentityUpsert({
      existing: null,
      source: {
        servicem8CompanyUuid: 'company-1',
        clientName: 'Top View Construction',
        companyName: 'Top View Construction Ltd',
        phone: '021 000 000',
        phoneNormalized: '+6421000000',
        email: 'vivi@example.test',
        sourceSnapshot: { uuid: 'company-1', name: 'Top View Construction' },
        syncedAt: now,
      },
      now,
    })

    expect(update).toMatchObject({
      servicem8CompanyUuid: 'company-1',
      name: 'Top View Construction',
      companyName: 'Top View Construction Ltd',
      phone: '021 000 000',
      phoneNormalized: '+6421000000',
      email: 'vivi@example.test',
      canonicalSource: 'import',
      reviewStatus: 'pending_review',
      servicem8Name: 'Top View Construction',
      servicem8CompanyName: 'Top View Construction Ltd',
      servicem8Phone: '021 000 000',
      servicem8PhoneNormalized: '+6421000000',
      servicem8Email: 'vivi@example.test',
      servicem8SourceSnapshot: { uuid: 'company-1', name: 'Top View Construction' },
      servicem8LastSyncedAt: now,
    })
  })

  it('refreshes ServiceM8 source metadata without overwriting reviewed canonical fields', () => {
    const update = buildClientIdentityUpsert({
      existing: {
        name: 'Top View RG Name',
        companyName: 'Top View RG Ltd',
        phone: '09 111 1111',
        phoneNormalized: '+6491111111',
        email: 'office@topview.test',
        reviewStatus: 'reviewed',
        canonicalSource: 'import',
        canonicalUpdatedAt: new Date('2026-07-01T10:00:00.000Z'),
      },
      source: {
        servicem8CompanyUuid: 'company-1',
        clientName: 'Top View ServiceM8',
        companyName: 'Top View SM8 Ltd',
        phone: '021 222 2222',
        phoneNormalized: '+64212222222',
        email: 'sm8@topview.test',
        sourceSnapshot: { uuid: 'company-1', name: 'Top View ServiceM8' },
        syncedAt: now,
      },
      now,
    })

    expect(update).toMatchObject({
      name: 'Top View RG Name',
      companyName: 'Top View RG Ltd',
      phone: '09 111 1111',
      phoneNormalized: '+6491111111',
      email: 'office@topview.test',
      canonicalUpdatedAt: new Date('2026-07-01T10:00:00.000Z'),
      servicem8Name: 'Top View ServiceM8',
      servicem8CompanyName: 'Top View SM8 Ltd',
      servicem8Phone: '021 222 2222',
      servicem8PhoneNormalized: '+64212222222',
      servicem8Email: 'sm8@topview.test',
      servicem8SourceSnapshot: { uuid: 'company-1', name: 'Top View ServiceM8' },
      servicem8LastSyncedAt: now,
    })
  })

  it('preserves manually edited canonical fields even before review', () => {
    const update = buildClientIdentityUpsert({
      existing: {
        name: 'Manual Client Name',
        companyName: null,
        phone: null,
        phoneNormalized: null,
        email: 'manual@example.test',
        reviewStatus: 'pending_review',
        canonicalSource: 'manual',
      },
      source: {
        servicem8CompanyUuid: 'company-1',
        clientName: 'ServiceM8 Client Name',
        companyName: 'ServiceM8 Ltd',
        email: 'source@example.test',
      },
      now,
    })

    expect(update.name).toBe('Manual Client Name')
    expect(update.companyName).toBeNull()
    expect(update.email).toBe('manual@example.test')
    expect(update.servicem8Name).toBe('ServiceM8 Client Name')
    expect(update.servicem8Email).toBe('source@example.test')
  })
})
