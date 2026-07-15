import { NextRequest, NextResponse } from 'next/server'

import { userCanAccessSlug } from '@/lib/access-db'
import { auth } from '@/lib/auth'
import { lookupLinzLotDescription } from '@/modules/ps-generator/linz-lot-description'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const allowed = await userCanAccessSlug(session.user.id, 'ps-generator')
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  const parseResult = await readLotDescriptionRequest(request)
  if (!parseResult.ok) {
    return NextResponse.json({ ok: false, error: parseResult.error }, { status: 400 })
  }

  try {
    const result = await lookupLinzLotDescription(parseResult.address)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('ps-generator.lot-description.lookup-failed', error)
    return NextResponse.json({ ok: false, error: 'Unable to look up lot description from LINZ' }, { status: 500 })
  }
}

async function readLotDescriptionRequest(request: NextRequest): Promise<
  | { ok: true; address: string }
  | { ok: false; error: string }
> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { ok: false, error: 'Invalid JSON payload' }
  }

  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid payload' }
  const address = (body as Record<string, unknown>).address
  if (typeof address !== 'string' || !address.trim()) {
    return { ok: false, error: 'Job address is required' }
  }

  return { ok: true, address: address.trim() }
}
