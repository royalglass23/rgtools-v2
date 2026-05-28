import { config } from 'dotenv'
config({ path: '.env.local' })

async function seed() {
  const bcrypt = await import('bcryptjs')
  const { db } = await import('../lib/db')
  const { users } = await import('../drizzle/schema')
  const { eq } = await import('drizzle-orm')

  const username = 'rgadmin'
  const password = '*royalglass23'

  const existing = await db.select().from(users).where(eq(users.username, username))
  if (existing.length > 0) {
    console.log(`User '${username}' already exists — skipping.`)
    process.exit(0)
  }

  const passwordHash = await bcrypt.default.hash(password, 12)
  await db.insert(users).values({ username, passwordHash, role: 'admin' })
  console.log(`Created admin user: ${username}`)
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
