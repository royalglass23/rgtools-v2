import { archiveAuditRows, purgePersonalData } from './retention'

export interface Env {
  DATABASE_URL: string
  QUOTES_BUCKET: R2Bucket
}

type ExpiredQuote = {
  id: string
  short_code: string | null
  pdf_storage_key: string
}

const worker = {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(env.DATABASE_URL)

    const expired = await sql`
      SELECT id, short_code, pdf_storage_key FROM quotes
      WHERE expires_at < NOW() AND pdf_storage_key IS NOT NULL AND archived_at IS NULL
    ` as ExpiredQuote[]

    for (const quote of expired) {
      await env.QUOTES_BUCKET.delete(quote.pdf_storage_key)
      await sql`
        UPDATE quotes
        SET pdf_storage_key = NULL, archived_at = NOW(), updated_at = NOW()
        WHERE id = ${quote.id}
      `
    }

    await sql`
      UPDATE quote_events SET ip = NULL
      WHERE ip IS NOT NULL AND created_at < NOW() - INTERVAL '90 days'
    `

    await purgePersonalData(sql)
    await archiveAuditRows(sql)

    console.log(JSON.stringify({
      expired: expired.length,
      purgedIps: true,
      at: new Date().toISOString(),
    }))
  },
}

export default worker
