import { describe, expect, it } from 'vitest'

import {
  effectiveImportance,
  effectiveRiskLevel,
  matchKeyForWorkOrder,
  normalizeConfigName,
} from '../domain'

describe('work order identity', () => {
  it('uses the ServiceM8 job UUID when present', () => {
    expect(matchKeyForWorkOrder({
      servicem8JobUuid: 'job-123',
      jobNumber: 'R260210',
      jobAddress: '1 Queen Street',
    })).toEqual({ kind: 'servicem8_uuid', value: 'job-123' })
  })

  it('falls back to job number plus normalized job address', () => {
    expect(matchKeyForWorkOrder({
      servicem8JobUuid: null,
      jobNumber: ' R260210 ',
      jobAddress: '  1 Queen   Street ',
    })).toEqual({ kind: 'job_number_address', value: 'R260210|1 queen street' })
  })

  it('treats job number alone as a weak fallback', () => {
    expect(matchKeyForWorkOrder({
      servicem8JobUuid: null,
      jobNumber: 'R260210',
      jobAddress: null,
    })).toEqual({ kind: 'job_number', value: 'R260210' })
  })
})

describe('work order effective AI/manual values', () => {
  it('uses manual risk level override ahead of the AI suggestion', () => {
    expect(effectiveRiskLevel({ aiRiskLevel: 'low', riskLevelOverride: 'high' })).toBe('high')
  })

  it('uses the AI risk level when there is no manual override', () => {
    expect(effectiveRiskLevel({ aiRiskLevel: 'medium', riskLevelOverride: null })).toBe('medium')
  })

  it('uses manual importance override ahead of the AI suggestion', () => {
    expect(effectiveImportance({ aiImportance: 'medium', importanceOverride: 'high' })).toBe('high')
  })
})

describe('work order configuration names', () => {
  it('normalizes config names to block whitespace and case duplicates', () => {
    expect(normalizeConfigName('  Ricky   Smith ')).toBe('ricky smith')
  })
})
