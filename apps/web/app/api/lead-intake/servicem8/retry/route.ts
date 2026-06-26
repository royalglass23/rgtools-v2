import { NextRequest, NextResponse } from 'next/server'
import { retryServiceM8LeadSyncBatch } from '@/modules/lead-intake/servicem8/sync'

export async function POST(request: NextRequest) {
  const syncSecret = process.env.SERVICEM8_SYNC_SECRET
  const authHeader = request.headers.get('authorization')

  if (!syncSecret || authHeader !== `Bearer ${syncSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await readJsonBody(request)
  const limit = typeof body.limit === 'number' ? body.limit : 10
  const result = await retryServiceM8LeadSyncBatch({ limit })

  return NextResponse.json(result)
}

async function readJsonBody(request: NextRequest): Promise<{ limit?: unknown }> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? body : {}
  } catch {
    return {}
  }
}
