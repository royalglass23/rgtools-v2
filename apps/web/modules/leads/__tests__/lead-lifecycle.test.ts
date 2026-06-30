import { describe, expect, it } from 'vitest'
import { isLeadReadOnlyForLeadIntake, isServiceM8QuoteStatus } from '../lead-lifecycle'

describe('lead lifecycle', () => {
  it('normalizes the singular ServiceM8 Quote status', () => {
    expect(isServiceM8QuoteStatus(' Quote ')).toBe(true)
    expect(isServiceM8QuoteStatus('quote')).toBe(true)
    expect(isServiceM8QuoteStatus('Quotes')).toBe(false)
  })

  it('keeps unlinked leads editable so staff can link or fetch them', () => {
    expect(isLeadReadOnlyForLeadIntake({ servicem8JobUuid: null, servicem8Status: null })).toBe(false)
  })

  it('keeps linked Quote leads editable', () => {
    expect(isLeadReadOnlyForLeadIntake({ servicem8JobUuid: 'job-1', servicem8Status: 'Quote' })).toBe(false)
  })

  it('makes linked non-Quote leads read-only for lead-intake work', () => {
    expect(isLeadReadOnlyForLeadIntake({ servicem8JobUuid: 'job-1', servicem8Status: 'Work Order' })).toBe(true)
  })
})
