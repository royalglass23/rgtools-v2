import { describe, expect, it } from 'vitest'
import { buildDashboardNavigation } from '../../../lib/admin-navigation'
import { PS_GENERATOR_DEFAULTS, PS_GENERATOR_OPTION_CATEGORIES } from '../config'

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

describe('ps generator module shell', () => {
  it('groups Generate PS and Configuration under a PS Generator menu for admins', () => {
    const nav = buildDashboardNavigation([
      moduleRow('ps', 'ps-generator', 'PS Generator', 4),
      moduleRow('ps-config', 'ps-generator/configuration', 'PS Configuration', 5, true),
    ], { isAdmin: true })

    expect(nav.primaryModules).toEqual([])
    expect(nav.psGeneratorItems).toEqual([
      { id: 'ps-generator-generate', slug: 'ps-generator', name: 'Generate PS', href: '/ps-generator' },
      { id: 'ps-generator-history', slug: 'ps-generator/history', name: 'History', href: '/ps-generator/history' },
      {
        id: 'ps-generator-configuration',
        slug: 'ps-generator/configuration',
        name: 'Configuration',
        href: '/ps-generator/configuration',
      },
    ])
  })

  it('hides PS Configuration when only Generate PS is granted', () => {
    const nav = buildDashboardNavigation([
      moduleRow('ps', 'ps-generator', 'PS Generator', 4),
      moduleRow('ps-history', 'ps-generator/history', 'PS History', 5),
    ])

    expect(nav.psGeneratorItems).toEqual([
      { id: 'ps-generator-generate', slug: 'ps-generator', name: 'Generate PS', href: '/ps-generator' },
      { id: 'ps-generator-history', slug: 'ps-generator/history', name: 'History', href: '/ps-generator/history' },
    ])
  })

  it('shows PS Configuration to a non-admin config editor with an explicit grant', () => {
    const nav = buildDashboardNavigation([
      moduleRow('ps', 'ps-generator', 'PS Generator', 4),
      moduleRow('ps-config', 'ps-generator/configuration', 'PS Configuration', 5),
    ])

    expect(nav.psGeneratorItems).toEqual([
      { id: 'ps-generator-generate', slug: 'ps-generator', name: 'Generate PS', href: '/ps-generator' },
      {
        id: 'ps-generator-configuration',
        slug: 'ps-generator/configuration',
        name: 'Configuration',
        href: '/ps-generator/configuration',
      },
    ])
  })

  it('keeps the MT-90 generation defaults and fixed Phase 1 option categories explicit', () => {
    expect(PS_GENERATOR_DEFAULTS).toEqual({
      system: 'double-disc',
      structureMaterial: 'timber',
      structureType: 'deck',
      location: 'external',
      structureBuilt: 'new',
      glassType: 'toughened',
      thickness: '12mm',
      gateRequired: 'no',
    })

    expect(PS_GENERATOR_OPTION_CATEGORIES).toEqual([
      'system',
      'structure_material',
      'structure_type',
      'location',
      'structure_built',
      'glass_type',
      'thickness',
      'gate_required',
    ])
  })
})
