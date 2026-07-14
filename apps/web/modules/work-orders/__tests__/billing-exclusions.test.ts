import { describe, expect, it } from 'vitest'

import { DEFAULT_WORK_ORDER_BILLING_EXCLUSIONS, normalizeWorkOrderBillingExclusions, parseWorkOrderBillingExclusionText } from '../billing-exclusions'

describe('normalizeWorkOrderBillingExclusions', () => {
  it('uses safe defaults for invalid settings and normalizes configured terms', () => {
    expect(normalizeWorkOrderBillingExclusions('not-json')).toEqual(DEFAULT_WORK_ORDER_BILLING_EXCLUSIONS)
    expect(normalizeWorkOrderBillingExclusions(JSON.stringify([' Invoice ', 'DEPOSIT', 'invoice', '', 42]))).toEqual(['invoice', 'deposit'])
  })

  it('parses the admin text input as normalized unique terms', () => {
    expect(parseWorkOrderBillingExclusionText(' Invoice\nDEPOSIT\ninvoice\nPartial Invoice ')).toEqual(['invoice', 'deposit', 'partial invoice'])
  })
})
