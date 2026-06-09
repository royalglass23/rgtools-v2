import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { fetchLeadFromServiceM8 } from '@/modules/leads/servicem8-fetch'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, reason: 'not_found', message: 'Lead not found' }, { status: 404 })
  }

  try {
    const result = await fetchLeadFromServiceM8(id, session.user.id)
    const httpStatus = result.ok ? 200 : result.reason === 'not_found' ? 200 : 500
    return NextResponse.json(result, { status: httpStatus })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      reason: 'error',
      message: error instanceof Error ? error.message : 'ServiceM8 fetch failed',
    }, { status: 500 })
  }
}
