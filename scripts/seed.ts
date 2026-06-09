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
    { slug: 'lead-intake', name: 'Lead Intake', adminOnly: false, sortOrder: 0 },
    { slug: 'leads', name: 'Leads', adminOnly: false, sortOrder: 1 },
    { slug: 'quote-tracker', name: 'Quote Tracker', adminOnly: false, sortOrder: 2 },
    { slug: 'admin', name: 'Administration', adminOnly: true, sortOrder: 99 },
  ]

  for (const moduleSeed of modulesToSeed) {
    const existing = await db.select().from(modules).where(eq(modules.slug, moduleSeed.slug))
    if (existing.length > 0) {
      console.log(`Module '${moduleSeed.slug}' already exists`)
    } else {
      await db.insert(modules).values(moduleSeed)
      console.log(`Created module: ${moduleSeed.slug}`)
    }
  }

  const [leadsModule] = await db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.slug, 'leads'))
    .limit(1)

  if (leadsModule) {
    const staffUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'staff'))

    for (const staffUser of staffUsers) {
      await db
        .insert(userModuleAccess)
        .values({
          userId: staffUser.id,
          moduleId: leadsModule.id,
          grantedBy: null,
        })
        .onConflictDoNothing()
    }
  }

  console.log('Seed completed successfully')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
