import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { linkLeadToServiceM8JobByNumber } from '@/modules/leads/servicem8-fetch'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const jobNumber = body && typeof body === 'object' && 'jobNumber' in body
    ? String(body.jobNumber)
    : ''

  try {
    const result = await linkLeadToServiceM8JobByNumber(id, jobNumber, session.user.id)
    const httpStatus = result.ok ? 200 : result.reason === 'not_found' ? 200 : 400
    return NextResponse.json(result, { status: httpStatus })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      reason: 'error',
      message: error instanceof Error ? error.message : 'ServiceM8 link failed',
    }, { status: 500 })
  }
}
