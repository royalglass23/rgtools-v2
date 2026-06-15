import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pricingConfigVersions } from '@/drizzle/schema-leads'

export async function GET() {
  let activePricing: { config: unknown } | undefined

  try {
    ;[activePricing] = await db
      .select({ config: pricingConfigVersions.config })
      .from(pricingConfigVersions)
      .where(eq(pricingConfigVersions.isActive, true))
      .limit(1)
  } catch {
    return new Response(null, { status: 503 })
  }

  if (!activePricing) {
    return new Response(null, { status: 503 })
  }

  return Response.json(activePricing.config, {
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  })
}
