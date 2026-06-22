import { config } from 'dotenv'
config({ path: '.env.local' })

import { getServiceM8ApiKey } from '../lib/servicem8/client'

const WEBHOOK_SUBSCRIPTION_URL = 'https://api.servicem8.com/webhook_subscriptions/object'
const UNIQUE_ID = 'rgtools-quote-attachment-webhook'
const FIELDS = [
  'edit_date',
  'attachment_name',
  'file_type',
  'attachment_source',
  'related_object_uuid',
  'active',
].join(',')

async function main() {
  const callbackUrl = process.env.SERVICEM8_ATTACHMENT_WEBHOOK_URL?.trim()
  const secret = process.env.SERVICEM8_WEBHOOK_SECRET?.trim()

  if (!callbackUrl) {
    throw new Error('SERVICEM8_ATTACHMENT_WEBHOOK_URL is not configured')
  }

  if (!secret) {
    throw new Error('SERVICEM8_WEBHOOK_SECRET is not configured')
  }

  const url = new URL(callbackUrl)
  url.searchParams.set('token', secret)

  const body = new URLSearchParams({
    object: 'attachment',
    fields: FIELDS,
    callback_url: url.toString(),
    unique_id: UNIQUE_ID,
  })

  const response = await fetch(WEBHOOK_SUBSCRIPTION_URL, {
    method: 'POST',
    headers: {
      'X-API-Key': getServiceM8ApiKey(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`ServiceM8 webhook registration failed with HTTP ${response.status}: ${text}`)
  }

  console.log(`Registered ServiceM8 attachment webhook (${UNIQUE_ID}): ${text}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
