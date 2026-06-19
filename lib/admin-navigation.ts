export interface DashboardModule {
  id: string
  slug: string
  name: string
  sortOrder: number
  adminOnly: boolean
  isActive: boolean
}

export interface DashboardNavItem {
  id: string
  slug: string
  name: string
  href: string
}

const LEAD_INTAKE_ROUTE_BY_SLUG: Record<string, DashboardNavItem> = {
  'lead-intake': {
    id: 'lead-intake-form',
    slug: 'lead-intake',
    name: 'Form',
    href: '/lead-intake',
  },
  leads: {
    id: 'lead-intake-list',
    slug: 'leads',
    name: 'List',
    href: '/leads',
  },
}

const LEAD_INTAKE_SORT_ORDER: Record<string, number> = {
  'lead-intake': 0,
  leads: 1,
  'lead-intake/configuration': 2,
}

const ADMIN_ROUTE_BY_SLUG: Record<string, string> = {
  admin: '/admin/administration',
  'admin/administration': '/admin/administration',
  'admin/lead-scoring': '/admin/lead-scoring',
  'admin/calculator-pricing': '/admin/calculator-pricing',
  'admin/dashboard-settings': '/admin/dashboard-settings',
  'admin/tracking': '/admin/tracking',
  'admin/lead-import': '/admin/lead-import',
}

const ADMIN_SORT_ORDER: Record<string, number> = {
  admin: 0,
  'admin/administration': 0,
  'admin/lead-scoring': 1,
  'admin/calculator-pricing': 2,
  'admin/dashboard-settings': 3,
  'admin/tracking': 4,
  'admin/lead-import': 5,
}

function adminItemKey(slug: string) {
  return slug === 'admin/administration' ? 'admin' : slug
}

export function buildDashboardNavigation(modules: DashboardModule[], options: { isAdmin?: boolean } = {}) {
  const activeModules = modules
    .filter((mod) => mod.isActive)
    .toSorted((a, b) => a.sortOrder - b.sortOrder)

  const primaryModules = activeModules.filter((mod) => (
    !(mod.slug in ADMIN_ROUTE_BY_SLUG) &&
    !(mod.slug in LEAD_INTAKE_ROUTE_BY_SLUG)
  ))
  const leadIntakeItemsByKey = new Map<string, DashboardNavItem>()
  const adminItemsByKey = new Map<string, DashboardNavItem>()

  for (const mod of activeModules) {
    const item = LEAD_INTAKE_ROUTE_BY_SLUG[mod.slug]
    if (!item) continue

    leadIntakeItemsByKey.set(item.slug, item)
  }

  if (options.isAdmin && leadIntakeItemsByKey.size > 0) {
    leadIntakeItemsByKey.set('lead-intake/configuration', {
      id: 'lead-intake-configuration',
      slug: 'lead-intake/configuration',
      name: 'Configuration',
      href: '/lead-intake/configuration',
    })
  }

  for (const mod of activeModules) {
    const href = ADMIN_ROUTE_BY_SLUG[mod.slug]
    if (!href) continue

    const key = adminItemKey(mod.slug)
    if (!adminItemsByKey.has(key)) {
      adminItemsByKey.set(key, {
        id: mod.id,
        slug: mod.slug,
        name: mod.name,
        href,
      })
    }
  }

  const adminItems = Array.from(adminItemsByKey.values()).toSorted((a, b) => {
    const aOrder = ADMIN_SORT_ORDER[a.slug] ?? Number.MAX_SAFE_INTEGER
    const bOrder = ADMIN_SORT_ORDER[b.slug] ?? Number.MAX_SAFE_INTEGER
    return aOrder - bOrder
  })

  const leadIntakeItems = Array.from(leadIntakeItemsByKey.values()).toSorted((a, b) => {
    const aOrder = LEAD_INTAKE_SORT_ORDER[a.slug] ?? Number.MAX_SAFE_INTEGER
    const bOrder = LEAD_INTAKE_SORT_ORDER[b.slug] ?? Number.MAX_SAFE_INTEGER
    return aOrder - bOrder
  })

  return { primaryModules, leadIntakeItems, adminItems }
}
