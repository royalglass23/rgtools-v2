import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { userCanAccessSlug } from '@/lib/access-db'
import { db } from '@/lib/db'
import { getStorage } from '@/lib/storage'
import { getRetainedGeneratedPdfDownload } from '@/modules/ps-generator/history'
import { psGeneratedPdfObjects } from '@rgtools/db/schema-ps-generator'

interface GeneratedPdfDownloadRouteProps {
  params: Promise<{ objectId: string }>
}

export async function GET(_request: Request, { params }: GeneratedPdfDownloadRouteProps) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await userCanAccessSlug(session.user.id, 'ps-generator/history')
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { objectId } = await params
  const [object] = await db
    .select()
    .from(psGeneratedPdfObjects)
    .where(eq(psGeneratedPdfObjects.id, objectId))
    .limit(1)

  if (!object) return NextResponse.json({ error: 'Generated PDF was not found' }, { status: 404 })

  const download = await getRetainedGeneratedPdfDownload(object, { storage: getStorage() })
  if (!download.ok) {
    return NextResponse.json({ error: download.reason === 'expired' ? 'Generated PDF is no longer retained' : 'Generated PDF file is missing' }, { status: 410 })
  }

  const body = download.bytes.buffer.slice(
    download.bytes.byteOffset,
    download.bytes.byteOffset + download.bytes.byteLength,
  ) as ArrayBuffer

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${sanitizeFilename(download.filename)}"`,
    },
  })
}

function sanitizeFilename(filename: string) {
  return filename.replace(/["\r\n]/g, '_')
}
