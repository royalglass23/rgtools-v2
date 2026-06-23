import { config } from 'dotenv'
config({ path: '.env.local' })

async function seed() {
  const bcrypt = await import('bcryptjs')
  const { db } = await import('../lib/db')
  const { users, modules, userModuleAccess } = await import('../drizzle/schema')
  const { eq } = await import('drizzle-orm')

  const username = 'rgadmin'
  const password = '*royalglass23'

  // Upsert rgadmin user
  const existing = await db.select().from(users).where(eq(users.username, username))
  if (existing.length > 0) {
    // User exists; update isProtected and role
    await db
      .update(users)
      .set({ role: 'admin', isProtected: true })
      .where(eq(users.username, username))
    console.log(`Updated user '${username}' to role=admin, isProtected=true`)
  } else {
    // User does not exist; create with role=admin and isProtected=true
    const passwordHash = await bcrypt.default.hash(password, 12)
    await db.insert(users).values({
      username,
      passwordHash,
      role: 'admin',
      isProtected: true,
    })
    console.log(`Created admin user: ${username}`)
  }

  // Upsert modules
  const modulesToSeed = [
    { slug: 'lead-intake', name: 'Lead Intake', adminOnly: false, sortOrder: 0, isActive: true },
    { slug: 'leads', name: 'Leads', adminOnly: false, sortOrder: 1, isActive: true },
    { slug: 'clients', name: 'Clients', adminOnly: false, sortOrder: 2, isActive: true },
    { slug: 'quote-tracker', name: 'Quote Tracker', adminOnly: false, sortOrder: 3, isActive: true },
    { slug: 'admin', name: 'Administration', adminOnly: true, sortOrder: 99, isActive: true },
    { slug: 'admin/lead-scoring', name: 'Lead Scoring', adminOnly: true, sortOrder: 100, isActive: true },
    { slug: 'admin/calculator-pricing', name: 'Cost Calculator Price', adminOnly: true, sortOrder: 101, isActive: true },
    { slug: 'admin/dashboard-settings', name: 'Dashboard Settings', adminOnly: true, sortOrder: 102, isActive: true },
    { slug: 'admin/tracking', name: 'Tracking Settings', adminOnly: true, sortOrder: 103, isActive: true },
    { slug: 'admin/lead-import', name: 'Lead Import', adminOnly: true, sortOrder: 104, isActive: true },
    { slug: 'admin/client-merge-review', name: 'Client Merge Review', adminOnly: true, sortOrder: 105, isActive: true },
  ]

  for (const moduleSeed of modulesToSeed) {
    const existing = await db.select().from(modules).where(eq(modules.slug, moduleSeed.slug))
    if (existing.length > 0) {
      await db
        .update(modules)
        .set({ ...moduleSeed, updatedAt: new Date() })
        .where(eq(modules.slug, moduleSeed.slug))
      console.log(`Updated module: ${moduleSeed.slug}`)
    } else {
      await db.insert(modules).values(moduleSeed)
      console.log(`Created module: ${moduleSeed.slug}`)
    }
  }

  const staffDefaultModules = await db
    .select({ id: modules.id, slug: modules.slug })
    .from(modules)
    .where(eq(modules.adminOnly, false))

  if (staffDefaultModules.length > 0) {
    const staffUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'staff'))

    for (const staffUser of staffUsers) {
      for (const moduleRow of staffDefaultModules) {
        await db
          .insert(userModuleAccess)
          .values({
            userId: staffUser.id,
            moduleId: moduleRow.id,
            grantedBy: null,
          })
          .onConflictDoNothing()
      }
    }
  }

  console.log('Seed completed successfully')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
