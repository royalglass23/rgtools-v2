import { describe, expect, it } from 'vitest'
import {
  buildAuditDiff,
  deriveAuditEntityType,
  formatAuditDetail,
} from '../audit'

describe('buildAuditDiff', () => {
  it('returns only changed fields for updates', () => {
    expect(buildAuditDiff(
      { tier: 'B', notes: 'old', untouched: 10 },
      { tier: 'A', notes: 'new', untouched: 10 },
    )).toEqual({
      tier: { from: 'B', to: 'A' },
      notes: { from: 'old', to: 'new' },
    })
  })

  it('uses to-only entries for creates', () => {
    expect(buildAuditDiff(null, { username: 'mia', role: 'staff' })).toEqual({
      username: { to: 'mia' },
      role: { to: 'staff' },
    })
  })

  it('uses from-only entries for deletes', () => {
    expect(buildAuditDiff({ username: 'mia', role: 'staff' }, null)).toEqual({
      username: { from: 'mia' },
      role: { from: 'staff' },
    })
  })

  it('returns an empty diff for no-op updates', () => {
    expect(buildAuditDiff({ tier: 'A' }, { tier: 'A' })).toEqual({})
  })
})

describe('formatAuditDetail', () => {
  it('renders diff-shaped detail readably', () => {
    expect(formatAuditDetail({
      tier: { from: 'B', to: 'A' },
      owner: { to: 'Sam' },
      removed: { from: true },
    })).toBe('tier: B -> A; owner: Sam; removed: true -> empty')
  })

  it('renders old-format detail readably', () => {
    expect(formatAuditDetail({ username: 'mia', moduleSlug: 'quotes' })).toBe('username: mia; moduleSlug: quotes')
  })
})

describe('deriveAuditEntityType', () => {
  it('derives known entity types from action prefixes', () => {
    expect(deriveAuditEntityType('lead.edited')).toBe('lead')
    expect(deriveAuditEntityType('quote.created')).toBe('quote')
    expect(deriveAuditEntityType('work_order.deleted')).toBe('work_order')
    expect(deriveAuditEntityType('work_order_item.label_regenerated')).toBe('work_order_item')
    expect(deriveAuditEntityType('access.grant')).toBe('access')
  })

  it('returns null for unknown prefixes', () => {
    expect(deriveAuditEntityType('service.connected')).toBeNull()
  })
})
