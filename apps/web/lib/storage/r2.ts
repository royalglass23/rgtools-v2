import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

import type { QuoteStorage } from './types'

type R2Env = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
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
