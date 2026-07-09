import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { createHash, createHmac } from 'node:crypto'

import type { QuoteStorage } from './types'

type R2Env = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

type PresignedPutInput = {
  key: string
  contentType: string
  expiresSeconds?: number
  now?: Date
}

function readR2Env(): R2Env {
  const isDev = process.env.NODE_ENV === 'development'

  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = isDev
    ? (process.env.R2_ACCESS_KEY_ID_DEV ?? process.env.R2_ACCESS_KEY_ID)
    : process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = isDev
    ? (process.env.R2_SECRET_ACCESS_KEY_DEV ?? process.env.R2_SECRET_ACCESS_KEY)
    : process.env.R2_SECRET_ACCESS_KEY
  const bucket = isDev
    ? (process.env.R2_BUCKET_DEV ?? process.env.R2_BUCKET)
    : process.env.R2_BUCKET

  const missing = [
    !accountId && 'R2_ACCOUNT_ID',
    !accessKeyId && (isDev ? 'R2_ACCESS_KEY_ID_DEV' : 'R2_ACCESS_KEY_ID'),
    !secretAccessKey && (isDev ? 'R2_SECRET_ACCESS_KEY_DEV' : 'R2_SECRET_ACCESS_KEY'),
    !bucket && (isDev ? 'R2_BUCKET_DEV' : 'R2_BUCKET'),
  ].filter(Boolean)

  if (missing.length > 0) {
    throw new Error(`R2 storage driver is selected but missing env vars: ${missing.join(', ')}`)
  }

  return {
    accountId: accountId!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucket: bucket!,
  }
}

export class R2QuoteStorage implements QuoteStorage {
  private client: S3Client | null = null
  private bucket: string | null = null

  private getClient(): { client: S3Client; bucket: string } {
    if (!this.client || !this.bucket) {
      const env = readR2Env()
      this.client = new S3Client({
        endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
        region: 'auto',
        credentials: {
          accessKeyId: env.accessKeyId,
          secretAccessKey: env.secretAccessKey,
        },
      })
      this.bucket = env.bucket
    }

    return { client: this.client, bucket: this.bucket }
  }

  async put(key: string, bytes: Buffer, contentType = 'application/pdf'): Promise<void> {
    const { client, bucket } = this.getClient()
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
    }))
  }

  async head(key: string): Promise<boolean> {
    const { client, bucket } = this.getClient()
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      return true
    } catch (err) {
      if (err instanceof NotFound || (err as { name?: string }).name === 'NotFound') return false
      throw err
    }
  }

  async get(key: string): Promise<Buffer | null> {
    const { client, bucket } = this.getClient()
    try {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
      if (!result.Body) return null
      return Buffer.from(await result.Body.transformToByteArray())
    } catch (err) {
      if (err instanceof NotFound || (err as { name?: string }).name === 'NoSuchKey') return null
      throw err
    }
  }

  async delete(key: string): Promise<void> {
    const { client, bucket } = this.getClient()
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  }
}

export function createR2PresignedPutUrl(input: PresignedPutInput) {
  const env = readR2Env()
  const expiresSeconds = Math.min(Math.max(input.expiresSeconds ?? 600, 60), 3600)
  const now = input.now ?? new Date()
  const amzDate = formatAmzDate(now)
  const shortDate = amzDate.slice(0, 8)
  const host = `${env.accountId}.r2.cloudflarestorage.com`
  const credentialScope = `${shortDate}/auto/s3/aws4_request`
  const signedHeaders = 'content-type;host;x-amz-content-sha256'
  const canonicalUri = `/${encodePathPart(env.bucket)}/${input.key.split('/').map(encodePathPart).join('/')}`
  const query = canonicalQueryString({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${env.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
  })
  const canonicalHeaders = [
    `content-type:${input.contentType}`,
    `host:${host}`,
    'x-amz-content-sha256:UNSIGNED-PAYLOAD',
    '',
  ].join('\n')
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    query,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n')
  const signature = hmacHex(signingKey(env.secretAccessKey, shortDate), stringToSign)

  return {
    url: `https://${host}${canonicalUri}?${query}&X-Amz-Signature=${signature}`,
    headers: {
      'content-type': input.contentType,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    },
  }
}

function formatAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

function canonicalQueryString(values: Record<string, string>) {
  return Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&')
}

function encodePathPart(value: string) {
  return encodeRfc3986(value)
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function hmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value, 'utf8').digest()
}

function hmacHex(key: Buffer, value: string) {
  return createHmac('sha256', key).update(value, 'utf8').digest('hex')
}

function signingKey(secretAccessKey: string, shortDate: string) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, shortDate)
  const regionKey = hmac(dateKey, 'auto')
  const serviceKey = hmac(regionKey, 's3')
  return hmac(serviceKey, 'aws4_request')
}
