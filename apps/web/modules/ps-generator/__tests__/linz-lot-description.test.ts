import { describe, expect, it, vi } from 'vitest'

import {
  resolveLinzLotDescription,
  type LinzFeatureClient,
  type LinzFeature,
} from '../linz-lot-description'

describe('resolveLinzLotDescription', () => {
  it('reconstructs a high-confidence shared-lot description from the property title parcels', async () => {
    const client = fakeLinzClient({
      'layer-123113': [feature({
        address_id: 1176742,
        full_address: '18 Lucia Glade, Meadowbank, Auckland',
      })],
      'table-115638': [feature({
        unit_of_property_id: 'c72de916-5ad2-46f9-ae83-523678b67b91',
        address_id: 1176742,
      })],
      'table-114085': [],
      'table-113970': [feature({
        unit_of_property_id: 'c72de916-5ad2-46f9-ae83-523678b67b91',
        title_no: 'NA122A/817',
      })],
      'table-52008': [
        feature({ ttl_title_no: 'NA122A/817', par_id: 4937594 }),
        feature({ ttl_title_no: 'NA122A/817', par_id: 5066305 }),
      ],
      'layer-50772': [
        feature({ id: 4937594, appellation: 'Lot 18 DP 192386', survey_area: 756, titles: 'NA122A/817' }),
        feature({ id: 5066305, appellation: 'Lot 27 DP 192386', survey_area: 236, titles: 'NA122A/817, NA122A/818, NA122A/819, NA122A/820' }),
      ],
    })

    await expect(resolveLinzLotDescription('18 Lucia Glade Meadowbank, Auckland 1072', client)).resolves.toMatchObject({
      found: true,
      confidence: 'high',
      lotDescription: 'LOT 18 DP 192386 756M2, LOT 27 DP 192386 236M2',
      address: {
        addressId: 1176742,
        fullAddress: '18 Lucia Glade, Meadowbank, Auckland',
      },
      unitOfPropertyId: 'c72de916-5ad2-46f9-ae83-523678b67b91',
    })
  })

  it('marks multi-title reconstructed descriptions as needing confirmation', async () => {
    const client = fakeLinzClient({
      'layer-123113': [feature({
        address_id: 1169776,
        full_address: '217 Kupe Street, Orakei, Auckland',
      })],
      'table-115638': [feature({
        unit_of_property_id: '8aff47c9-67e1-4412-9932-2b45e596b672',
        address_id: 1169776,
      })],
      'table-114085': [],
      'table-113970': [
        feature({ unit_of_property_id: '8aff47c9-67e1-4412-9932-2b45e596b672', title_no: '51399' }),
        feature({ unit_of_property_id: '8aff47c9-67e1-4412-9932-2b45e596b672', title_no: 'NA99C/193' }),
        feature({ unit_of_property_id: '8aff47c9-67e1-4412-9932-2b45e596b672', title_no: 'NA99C/194' }),
        feature({ unit_of_property_id: '8aff47c9-67e1-4412-9932-2b45e596b672', title_no: 'NA99C/195' }),
        feature({ unit_of_property_id: '8aff47c9-67e1-4412-9932-2b45e596b672', title_no: '557119' }),
      ],
      'table-52008': [
        feature({ ttl_title_no: '51399', par_id: 5201840 }),
        feature({ ttl_title_no: '51399', par_id: 5072971 }),
        feature({ ttl_title_no: '51399', par_id: 4810375 }),
        feature({ ttl_title_no: '51399', par_id: 5060505 }),
        feature({ ttl_title_no: '557119', par_id: 4815836 }),
      ],
      'layer-50772': [
        feature({ id: 5201840, appellation: 'Lot 1 DP 92924', survey_area: 5641, titles: '51399, NA99C/193' }),
        feature({ id: 5072971, appellation: 'Lot 2 DP 92924', survey_area: 7473, titles: '51399, NA99C/194' }),
        feature({ id: 4810375, appellation: 'Lot 3 DP 92925', survey_area: 3460, titles: '51399, NA99C/195' }),
        feature({ id: 5060505, appellation: 'Lot 264 DP 37687', survey_area: 913, titles: '51399, NA22C/1052' }),
        feature({ id: 4815836, appellation: 'Section 3 SO 63269', survey_area: 5895, titles: '441696, 557119' }),
      ],
    })

    const result = await resolveLinzLotDescription('217 Kupe Street, Orakei, Auckland 1071', client)

    expect(result).toMatchObject({
      found: true,
      confidence: 'needs_confirmation',
      lotDescription: 'LOT 1 DP 92924 5641M2, LOT 2 DP 92924 7473M2, LOT 3 DP 92925 3460M2, LOT 264 DP 37687 913M2, SECTION 3 SO 63269 5895M2',
      warning: 'LINZ linked this property to multiple titles/parcels. Review before generating.',
    })
  })

  it('uses public DVR legal descriptions when LINZ provides one', async () => {
    const client = fakeLinzClient({
      'layer-123113': [feature({ address_id: 1, full_address: '1 Test Road, Testville' })],
      'table-115638': [feature({ unit_of_property_id: 'uop-1', address_id: 1 })],
      'table-114085': [feature({
        unit_of_property_id: 'uop-1',
        legal_description: 'LOT 4 DP 12345 500M2',
      })],
    })

    await expect(resolveLinzLotDescription('1 Test Road', client)).resolves.toMatchObject({
      found: true,
      confidence: 'high',
      source: 'linz-dvr',
      lotDescription: 'LOT 4 DP 12345 500M2',
    })
  })
})

function fakeLinzClient(featuresByTypeName: Record<string, LinzFeature[]>): LinzFeatureClient {
  return {
    getFeatures: vi.fn(async (typeName: string) => featuresByTypeName[typeName] ?? []),
  }
}

function feature(properties: Record<string, unknown>): LinzFeature {
  return { properties }
}
