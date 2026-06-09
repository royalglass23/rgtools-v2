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
  try {
    const result = await fetchLeadFromServiceM8(id, session.user.id)
    return NextResponse.json(result, { status: result.ok || result.reason === 'not_found' ? 200 : 500 })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      reason: 'error',
      message: error instanceof Error ? error.message : 'ServiceM8 fetch failed',
    }, { status: 500 })
  }
}
