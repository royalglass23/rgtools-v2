import { describe, expect, it } from 'vitest'
import { buildDashboardNavigation } from '../admin-navigation'

const moduleRow = (
  id: string,
  slug: string,
  name: string,
  sortOrder: number,
  adminOnly = false,
) => ({
  id,
  slug,
  name,
  sortOrder,
  adminOnly,
  isActive: true,
})

describe('buildDashboardNavigation', () => {
  it('keeps regular modules top-level and moves admin modules into the Admin menu', () => {
    const nav = buildDashboardNavigation([
      moduleRow('m1', 'lead-intake', 'Lead Intake', 0),
      moduleRow('m2', 'admin/lead-scoring', 'Lead Scoring', 101, true),
      moduleRow('m3', 'leads', 'Leads', 1),
      moduleRow('m4', 'admin/calculator-pricing', 'Cost Calculator Price', 102, true),
      moduleRow('m5', 'admin', 'Administration', 99, true),
      moduleRow('m6', 'admin/tracking', 'Tracking Settings', 103, true),
      moduleRow('m7', 'admin/client-merge-review', 'Client Merge Review', 105, true),
    ], { isAdmin: true })

    expect(nav.primaryModules.map((mod) => mod.slug)).toEqual([])
    expect(nav.leadIntakeItems).toEqual([
      { id: 'lead-intake-form', slug: 'lead-intake', name: 'Form', href: '/lead-intake' },
      { id: 'lead-intake-list', slug: 'leads', name: 'List', href: '/leads' },
      {
        id: 'lead-intake-configuration',
        slug: 'lead-intake/configuration',
        name: 'Configuration',
        href: '/lead-intake/configuration',
      },
    ])
    expect(nav.adminItems).toEqual([
      { id: 'm5', slug: 'admin', name: 'Administration', href: '/admin/administration' },
      { id: 'm2', slug: 'admin/lead-scoring', name: 'Lead Scoring', href: '/admin/lead-scoring' },
      {
        id: 'm4',
        slug: 'admin/calculator-pricing',
        name: 'Cost Calculator Price',
        href: '/admin/calculator-pricing',
      },
      {
        id: 'm6',
        slug: 'admin/tracking',
        name: 'Tracking Settings',
        href: '/admin/tracking',
      },
      {
        id: 'm7',
        slug: 'admin/client-merge-review',
        name: 'Client Merge Review',
        href: '/admin/client-merge-review',
      },
    ])
  })

  it('hides lead intake configuration for non-admin navigation', () => {
    const nav = buildDashboardNavigation([
      moduleRow('m1', 'lead-intake', 'Lead Intake', 0),
      moduleRow('m3', 'leads', 'Leads', 1),
    ])

    expect(nav.leadIntakeItems).toEqual([
      { id: 'lead-intake-form', slug: 'lead-intake', name: 'Form', href: '/lead-intake' },
      { id: 'lead-intake-list', slug: 'leads', name: 'List', href: '/leads' },
    ])
  })

  it('keeps the clients module as a top-level navigation item', () => {
    const nav = buildDashboardNavigation([
      moduleRow('clients', 'clients', 'Clients', 2),
      moduleRow('quotes', 'quote-tracker', 'Quote Tracker', 3),
    ])

    expect(nav.primaryModules.map((mod) => ({ slug: mod.slug, name: mod.name }))).toEqual([
      { slug: 'clients', name: 'Clients' },
      { slug: 'quote-tracker', name: 'Quote Tracker' },
    ])
  })

  it('deduplicates a migrated administration module against the legacy admin module', () => {
    const nav = buildDashboardNavigation([
      moduleRow('legacy', 'admin', 'Administration', 99, true),
      moduleRow('migrated', 'admin/administration', 'Administration', 100, true),
    ])

    expect(nav.adminItems).toEqual([
      {
        id: 'legacy',
        slug: 'admin',
        name: 'Administration',
        href: '/admin/administration',
      },
    ])
  })

  it('hides work order navigation by default while the module is parked on its branch', () => {
    const nav = buildDashboardNavigation([
      moduleRow('work-orders', 'work-orders', 'Work Orders', 5),
      moduleRow('work-order-config', 'admin/work-orders', 'Work Order Configuration', 106, true),
    ], { isAdmin: true })

    expect(nav.primaryModules).toEqual([])
    expect(nav.workOrderItems).toEqual([])
    expect(nav.adminItems).toEqual([])
  })

  it('groups work order list and configuration under the Work Order menu when enabled', () => {
    const nav = buildDashboardNavigation([
      moduleRow('work-orders', 'work-orders', 'Work Orders', 5),
      moduleRow('work-order-config', 'admin/work-orders', 'Work Order Configuration', 106, true),
    ], { isAdmin: true, showWorkOrderNavigation: true })

    expect(nav.primaryModules).toEqual([])
    expect(nav.adminItems).toEqual([])
    expect(nav.workOrderItems).toEqual([
      { id: 'work-order-list', slug: 'work-orders', name: 'Lists', href: '/work-orders' },
      { id: 'work-order-configuration', slug: 'admin/work-orders', name: 'Configuration', href: '/admin/work-orders' },
    ])
  })
})
