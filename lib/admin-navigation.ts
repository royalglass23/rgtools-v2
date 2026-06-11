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

const ADMIN_ROUTE_BY_SLUG: Record<string, string> = {
  admin: '/admin/administration',
  'admin/administration': '/admin/administration',
  'admin/lead-scoring': '/admin/lead-scoring',
  'admin/calculator-pricing': '/admin/calculator-pricing',
}

const ADMIN_SORT_ORDER: Record<string, number> = {
  admin: 0,
  'admin/administration': 0,
  'admin/lead-scoring': 1,
  'admin/calculator-pricing': 2,
}

function adminItemKey(slug: string) {
  return slug === 'admin/administration' ? 'admin' : slug
}

export function buildDashboardNavigation(modules: DashboardModule[]) {
  const activeModules = modules
    .filter((mod) => mod.isActive)
    .toSorted((a, b) => a.sortOrder - b.sortOrder)

  const primaryModules = activeModules.filter((mod) => !(mod.slug in ADMIN_ROUTE_BY_SLUG))
  const adminItemsByKey = new Map<string, DashboardNavItem>()

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

  return { primaryModules, adminItems }
}
