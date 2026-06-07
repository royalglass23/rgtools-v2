import { computeDistanceBand } from '@/modules/lead-intake/distance'
import { NextResponse } from 'next/server'

export async function GET() {
  const keyPresent = Boolean(process.env.GOOGLE_MAPS_SERVER_KEY)
  const keyPrefix = process.env.GOOGLE_MAPS_SERVER_KEY?.slice(0, 8) ?? 'missing'
  const band = await computeDistanceBand('Albany, Auckland, New Zealand')

  return NextResponse.json({ keyPresent, keyPrefix, band })
}
