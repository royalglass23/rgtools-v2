export interface QuoteStorage {
  put(key: string, bytes: Buffer, contentType?: string): Promise<void>
  head(key: string): Promise<boolean>
  get(key: string): Promise<Buffer | null>
  delete(key: string): Promise<void>
}
