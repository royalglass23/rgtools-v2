import { NextRequest, NextResponse } from 'next/server'
import { importCalculatorLeads } from '@/modules/lead-intake/calculator/import-calculator-leads'

export async function POST(request: NextRequest) {
  const importSecret = process.env.CALCULATOR_IMPORT_SECRET
  const authHeader = request.headers.get('authorization')

  if (!importSecret || authHeader !== `Bearer ${importSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await readJsonBody(request)
  const limit = typeof body.limit === 'number' ? body.limit : 25

  try {
    const summary = await importCalculatorLeads({ limit })
    return NextResponse.json(summary)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

async function readJsonBody(request: NextRequest): Promise<{ limit?: unknown }> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? body : {}
  } catch {
    return {}
  }
}
