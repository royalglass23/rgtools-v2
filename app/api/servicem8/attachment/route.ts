import { NextRequest, NextResponse } from 'next/server'

import { handleServiceM8AttachmentWebhook } from '@/modules/quote-tracker/servicem8-attachment-webhook'

export async function GET(request: NextRequest) {
  return respond(await handleServiceM8AttachmentWebhook({
    url: request.url,
    headers: request.headers,
    body: {},
  }))
}

export async function POST(request: NextRequest) {
  return respond(await handleServiceM8AttachmentWebhook({
    url: request.url,
    headers: request.headers,
    body: await readJsonBody(request),
  }))
}

function respond(result: Awaited<ReturnType<typeof handleServiceM8AttachmentWebhook>>) {
  if (typeof result.body === 'string') {
    return new NextResponse(result.body, { status: result.status })
  }

  return NextResponse.json(result.body, { status: result.status })
}

async function readJsonBody(request: NextRequest) {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? body : {}
  } catch {
    return {}
  }
}
