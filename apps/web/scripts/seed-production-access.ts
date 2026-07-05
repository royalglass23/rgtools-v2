import { config } from 'dotenv'
config({ path: '.env.local' })

const PRODUCTION_STAFF_MODULE_SLUGS = [
  'lead-intake',
  'leads',
  'quote-tracker',
]

async function seedProductionAccess() {
  const { and, eq, inArray } = await import('drizzle-orm')
  const { db } = await import('../lib/db')
  const { users, modules, userModuleAccess } = await import('@rgtools/db/schema')

  const staffUsers = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.role, 'staff'))

  const productionModules = await db
    .select({ id: modules.id, slug: modules.slug })
    .from(modules)
    .where(and(
      eq(modules.isActive, true),
      inArray(modules.slug, PRODUCTION_STAFF_MODULE_SLUGS),
    ))

  const missingModuleSlugs = PRODUCTION_STAFF_MODULE_SLUGS.filter((slug) => (
    !productionModules.some((moduleRow) => moduleRow.slug === slug)
  ))

  if (missingModuleSlugs.length > 0) {
    throw new Error(`Missing production module rows: ${missingModuleSlugs.join(', ')}`)
  }

  let inserted = 0
  for (const staffUser of staffUsers) {
    for (const moduleRow of productionModules) {
      const result = await db
        .insert(userModuleAccess)
        .values({
          userId: staffUser.id,
          moduleId: moduleRow.id,
          grantedBy: null,
        })
        .onConflictDoNothing()
        .returning({ userId: userModuleAccess.userId })

      inserted += result.length
    }
  }

  console.log(`Checked ${staffUsers.length} staff users`)
  console.log(`Ensured staff access to: ${PRODUCTION_STAFF_MODULE_SLUGS.join(', ')}`)
  console.log(`Inserted ${inserted} missing access grants`)
  process.exit(0)
}

seedProductionAccess().catch((error) => {
  console.error('Seed production access failed:', error)
  process.exit(1)
})
