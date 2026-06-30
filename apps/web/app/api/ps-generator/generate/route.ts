import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { userCanAccessSlug } from '@/lib/access-db'
import {
  generateProducerStatementPackage,
  PsGenerationError,
  type GenerateProducerStatementPackageInput,
  type PsGenerationMode,
} from '@/modules/ps-generator/generation'

const MODES: PsGenerationMode[] = ['ps1_only', 'ps3_only', 'both']

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allowed = await userCanAccessSlug(session.user.id, 'ps-generator')
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parseResult = await readGenerateRequest(request)
  if (!parseResult.ok) {
    return NextResponse.json({ error: parseResult.error }, { status: 400 })
  }

  try {
    const result = await generateProducerStatementPackage(parseResult.input, {
      persistGeneratedOutputs: true,
      actor: {
        id: session.user.id,
        label: session.user.name ?? session.user.email ?? session.user.id,
      },
    })
    return NextResponse.json({
      ok: true,
      operationId: result.operationId,
      mode: result.mode,
      versionLabel: result.versionLabel,
      outputs: result.outputs.map((output) => ({
        documentKind: output.documentKind,
        templateVariantId: output.templateVariantId,
        templateLabel: output.templateLabel,
        filename: output.filename,
        contentType: output.contentType,
        base64: output.bytes.toString('base64'),
      })),
    })
  } catch (error) {
    if (error instanceof PsGenerationError) {
      return NextResponse.json({
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      }, { status: 422 })
    }

    console.error('ps-generator.generate.failed', error)
    return NextResponse.json({ error: 'Unable to generate Producer Statement PDFs' }, { status: 500 })
  }
}

async function readGenerateRequest(request: NextRequest): Promise<
  | { ok: true; input: GenerateProducerStatementPackageInput }
  | { ok: false; error: string }
> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { ok: false, error: 'Invalid JSON payload' }
  }

  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid payload' }
  const payload = body as Record<string, unknown>
  if (!isGenerationMode(payload.mode)) return { ok: false, error: 'Invalid generation mode' }
  if (!isRecord(payload.projectDetails)) return { ok: false, error: 'Invalid project details' }
  if (!isRecord(payload.selections)) return { ok: false, error: 'Invalid selections' }

  const projectDetails = payload.projectDetails
  const selections = payload.selections
  if (typeof projectDetails.clientName !== 'string' || !projectDetails.clientName.trim()) {
    return { ok: false, error: 'Client name is required' }
  }
  if (typeof projectDetails.jobAddress !== 'string' || !projectDetails.jobAddress.trim()) {
    return { ok: false, error: 'Job address is required' }
  }

  const normalizedSelections: Record<string, string> = {}
  for (const [key, value] of Object.entries(selections)) {
    if (typeof value === 'string' && value.trim()) normalizedSelections[key] = value
  }
  if (!normalizedSelections.system) return { ok: false, error: 'System selection is required' }

  return {
    ok: true,
    input: {
      mode: payload.mode,
      projectDetails: projectDetails as GenerateProducerStatementPackageInput['projectDetails'],
      selections: normalizedSelections,
    },
  }
}

function isGenerationMode(value: unknown): value is PsGenerationMode {
  return MODES.includes(value as PsGenerationMode)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
