type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>

export async function purgePersonalData(sql: SqlFn): Promise<void> {
  await sql`
    DELETE FROM quote_events
    WHERE quote_id IN (
      SELECT id FROM quotes
      WHERE expires_at < NOW() - INTERVAL '12 months'
         OR archived_at < NOW() - INTERVAL '12 months'
    )
  `
  await sql`
    DELETE FROM quote_viewer_emails
    WHERE quote_id IN (
      SELECT id FROM quotes
      WHERE expires_at < NOW() - INTERVAL '12 months'
         OR archived_at < NOW() - INTERVAL '12 months'
    )
  `
}
