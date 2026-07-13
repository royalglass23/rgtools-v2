import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { userCanAccessSlug } from '@/lib/access-db'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getStorageDriver } from '@/lib/storage'
import { createR2PresignedPutUrl } from '@/lib/storage/r2'
import { psConfigVersions } from '@rgtools/db/schema-ps-generator'

const VARIANT_KINDS = new Set(['standard_ps1', 'pool_ps1', 'ps3'])
const MAX_TEMPLATE_UPLOAD_BYTES = 25 * 1024 * 1024

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allowed = await userCanAccessSlug(session.user.id, 'ps-generator/configuration')
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (getStorageDriver() !== 'r2') {
    return NextResponse.json({ error: 'Direct template upload requires R2 storage.' }, { status: 400 })
  }

  const body = await readUploadRequest(request)
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 })
  }

  const [version] = await db
    .select({ id: psConfigVersions.id, state: psConfigVersions.state })
    .from(psConfigVersions)
    .where(and(eq(psConfigVersions.id, body.input.configVersionId), eq(psConfigVersions.state, 'draft')))
    .limit(1)
  if (!version) {
    return NextResponse.json({ error: 'Only draft PS configuration can be edited here.' }, { status: 400 })
  }

  const objectKey = templateObjectKey({
    configVersionId: body.input.configVersionId,
    systemPart: body.input.systemPart,
    variantKind: body.input.variantKind,
    filename: body.input.filename,
  })
  const signed = createR2PresignedPutUrl({
    key: objectKey,
    contentType: 'application/pdf',
    expiresSeconds: 600,
  })

  return NextResponse.json({
    objectKey,
    originalFilename: body.input.filename,
    uploadUrl: signed.url,
    headers: signed.headers,
  })
}

async function readUploadRequest(request: NextRequest): Promise<
  | { ok: true; input: {
    configVersionId: string
    systemPart: string
    variantKind: 'standard_ps1' | 'pool_ps1' | 'ps3'
    filename: string
    contentType: string
    size: number
  } }
  | { ok: false; error: string }
> {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return { ok: false, error: 'Invalid JSON payload' }
  }

  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid payload' }
  const body = payload as Record<string, unknown>
  const configVersionId = String(body.configVersionId ?? '').trim()
  const systemPart = sanitizeObjectPart(String(body.systemPart ?? ''))
  const variantKind = String(body.variantKind ?? '')
  const filename = String(body.filename ?? '').trim()
  const contentType = String(body.contentType ?? '').trim()
  const size = Number(body.size)

  if (!configVersionId) return { ok: false, error: 'Missing draft.' }
  if (!systemPart) return { ok: false, error: 'Missing system.' }
  if (!VARIANT_KINDS.has(variantKind)) return { ok: false, error: 'Invalid template kind.' }
  if (!filename || !filename.toLowerCase().endsWith('.pdf')) return { ok: false, error: 'Template upload must be a PDF.' }
  if (contentType && contentType !== 'application/pdf') return { ok: false, error: 'Template upload must be a PDF.' }
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: 'Template PDF is empty.' }
  if (size > MAX_TEMPLATE_UPLOAD_BYTES) return { ok: false, error: 'Template PDF must be 25 MB or smaller.' }

  return {
    ok: true,
    input: {
      configVersionId,
      systemPart,
      variantKind: variantKind as 'standard_ps1' | 'pool_ps1' | 'ps3',
      filename,
      contentType,
      size,
    },
  }
}

function templateObjectKey(input: {
  configVersionId: string
  systemPart: string
  variantKind: 'standard_ps1' | 'pool_ps1' | 'ps3'
  filename: string
}) {
  return `drafts/ps-generator/templates/${input.configVersionId}/${sanitizeObjectPart(input.systemPart)}/${input.variantKind}/${sanitizeObjectPart(input.filename)}`
}

function sanitizeObjectPart(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
}
