import { describe, expect, it } from 'vitest'
import { planClientMerges, type ClientMergePlanRow } from '../merge-planner'

function row(overrides: Partial<ClientMergePlanRow> & Pick<ClientMergePlanRow, 'id' | 'name'>): ClientMergePlanRow {
  return {
    id: overrides.id,
    name: overrides.name,
    companyName: overrides.companyName ?? null,
    email: overrides.email ?? null,
    phoneNormalized: overrides.phoneNormalized ?? null,
    servicem8CompanyUuid: overrides.servicem8CompanyUuid ?? null,
    resolvedServiceM8CompanyUuid: overrides.resolvedServiceM8CompanyUuid ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
  }
}

describe('planClientMerges', () => {
  it('auto-merges rows with the same resolved ServiceM8 company UUID and prefers a linked survivor', () => {
    const plan = planClientMerges([
      row({
        id: 'older-unlinked',
        name: 'Top View Construction',
        resolvedServiceM8CompanyUuid: 'company-top-view',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      }),
      row({
        id: 'linked-survivor',
        name: 'Top View Construction Ltd',
        servicem8CompanyUuid: 'company-top-view',
        resolvedServiceM8CompanyUuid: 'company-top-view',
        createdAt: new Date('2025-02-01T00:00:00.000Z'),
      }),
    ])

    expect(plan.autoMergeGroups).toEqual([
      {
        key: 'servicem8:company-top-view',
        reason: 'same_servicem8_company_uuid',
        survivorId: 'linked-survivor',
        loserIds: ['older-unlinked'],
        rows: expect.arrayContaining([
          expect.objectContaining({ id: 'older-unlinked' }),
          expect.objectContaining({ id: 'linked-survivor' }),
        ]),
      },
    ])
    expect(plan.reviewGroups).toEqual([])
  })

  it('uses the oldest row as survivor when no row is already linked', () => {
    const plan = planClientMerges([
      row({
        id: 'oldest',
        name: 'Visionary Homes',
        resolvedServiceM8CompanyUuid: 'company-visionary',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      }),
      row({
        id: 'newest',
        name: 'Visionary Homes',
        resolvedServiceM8CompanyUuid: 'company-visionary',
        createdAt: new Date('2024-02-01T00:00:00.000Z'),
      }),
    ])

    expect(plan.autoMergeGroups[0]).toMatchObject({
      survivorId: 'oldest',
      loserIds: ['newest'],
    })
  })

  it('routes name-only duplicates with absent or differing UUIDs to review', () => {
    const plan = planClientMerges([
      row({ id: 'greatland', name: 'Greatland' }),
      row({ id: 'great-land', name: 'Greatland', resolvedServiceM8CompanyUuid: 'company-great-land' }),
      row({ id: 'harikat-one', name: 'Harikat', resolvedServiceM8CompanyUuid: 'company-harikat-a' }),
      row({ id: 'harikat-two', name: 'Harikat', resolvedServiceM8CompanyUuid: 'company-harikat-b' }),
    ])

    expect(plan.autoMergeGroups).toEqual([])
    expect(plan.reviewGroups).toEqual([
      {
        key: 'name:greatland',
        reason: 'same_name',
        rows: expect.arrayContaining([
          expect.objectContaining({ id: 'greatland' }),
          expect.objectContaining({ id: 'great-land' }),
        ]),
      },
      {
        key: 'name:harikat',
        reason: 'same_name',
        rows: expect.arrayContaining([
          expect.objectContaining({ id: 'harikat-one' }),
          expect.objectContaining({ id: 'harikat-two' }),
        ]),
      },
    ])
  })

  it('routes shared contact provisional rows to review', () => {
    const plan = planClientMerges([
      row({ id: 'rapid-one', name: 'Rapid Solutions', phoneNormalized: '+64210000001' }),
      row({ id: 'rapid-two', name: 'Rapid Solutions NZ', phoneNormalized: '+64210000001' }),
    ])

    expect(plan.autoMergeGroups).toEqual([])
    expect(plan.reviewGroups).toEqual([
      {
        key: 'contact:+64210000001',
        reason: 'same_contact',
        rows: expect.arrayContaining([
          expect.objectContaining({ id: 'rapid-one' }),
          expect.objectContaining({ id: 'rapid-two' }),
        ]),
      },
    ])
  })

  it('omits dismissed review suggestions while preserving other duplicate candidates', () => {
    const plan = planClientMerges([
      row({ id: 'rapid-one', name: 'Rapid Solutions', phoneNormalized: '+64210000001' }),
      row({ id: 'rapid-two', name: 'Rapid Solutions NZ', phoneNormalized: '+64210000001' }),
      row({ id: 'glass-a', name: 'Glass House' }),
      row({ id: 'glass-b', name: 'Glass House' }),
    ], {
      dismissedSuggestionKeys: new Set(['contact:+64210000001']),
    })

    expect(plan.reviewGroups).toEqual([
      {
        key: 'name:glass house',
        reason: 'same_name',
        rows: expect.arrayContaining([
          expect.objectContaining({ id: 'glass-a' }),
          expect.objectContaining({ id: 'glass-b' }),
        ]),
      },
    ])
  })
})
