import { eq } from 'drizzle-orm'

import { auditLog, quotes } from '@/drizzle/schema'
import { leads } from '@/drizzle/schema-leads'
import { db } from '@/lib/db'
import {
  createServiceM8RequestFromEnv,
  getJobQuoteMeta,
  getQuoteAttachmentPdf,
  resolveJobUuid,
} from '@/lib/servicem8/client'
import { generateShortCode } from '@/lib/short-code'
import { getStorage, getStorageDriver } from '@/lib/storage'

import { resolveExpiry, type ExpiryPreset } from './expiry'

export type CreateTrackedQuoteOptions = {
  jobUuid?: string
  jobNumber?: string
  leadId?: string
  ownerUserId?: string | null
  expiry?: ExpiryPreset | { customDate: string }
}

export type CreateTrackedQuoteResult =
  | {
      ok: true
      quoteId: string
      shortCode: string
      link: string
      expiresAt: Date
      clientName: string
      jobAddress: string | null
      quoteValue: string
      storageDriver: string
    }
  | { ok: false; reason: 'job_not_found' | 'no_quote_pdf'; message: string }

function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const candidate = err as { code?: string; constraint?: string }
  if (candidate.code !== '23505') return false
  return constraint ? candidate.constraint === constraint : true
}

async function resolveJobUuidFromOptions(opts: CreateTrackedQuoteOptions): Promise<string | null> {
  if (opts.jobUuid) return opts.jobUuid

  if (opts.jobNumber) {
    const request = createServiceM8RequestFromEnv()
    return resolveJobUuid({ jobNumber: opts.jobNumber }, request)
  }

  if (opts.leadId) {
    const [lead] = await db
      .select({ servicem8JobUuid: leads.servicem8JobUuid })
      .from(leads)
      .where(eq(leads.id, opts.leadId))
      .limit(1)

    return lead?.servicem8JobUuid ?? null
  }

  return null
}

async function findExistingQuote(jobUuid: string) {
  const [existing] = await db
    .select({
      id: quotes.id,
      shortCode: quotes.shortCode,
    })
    .from(quotes)
    .where(eq(quotes.servicem8Uuid, jobUuid))
    .limit(1)

  return existing ?? null
}

async function generateUnusedShortCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const shortCode = generateShortCode(8)
    const [existing] = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(eq(quotes.shortCode, shortCode))
      .limit(1)

    if (!existing) return shortCode
  }

  throw new Error('Unable to generate a unique short code after 5 attempts.')
}

export async function createTrackedQuote(
  opts: CreateTrackedQuoteOptions,
): Promise<CreateTrackedQuoteResult> {
  const jobUuid = await resolveJobUuidFromOptions(opts)
  if (!jobUuid) {
    return { ok: false, reason: 'job_not_found', message: 'No matching ServiceM8 job found.' }
  }

  const request = createServiceM8RequestFromEnv()
  const meta = await getJobQuoteMeta(jobUuid, request)
  const pdf = await getQuoteAttachmentPdf(jobUuid, request)
  if (!pdf) {
    return { ok: false, reason: 'no_quote_pdf', message: 'Generate the quote in ServiceM8 first.' }
  }

  const existing = await findExistingQuote(jobUuid)
  const expiresAt = resolveExpiry(opts.expiry)
  const storageDriver = getStorageDriver()
  const storage = getStorage()
  const clientName = meta.clientName ?? 'Quote'
  const quoteValue = meta.totalIncGst.toFixed(2)

  for (let attempt = 0; attempt < 5; attempt++) {
    const shortCode = existing?.shortCode ?? await generateUnusedShortCode()
    const pdfStorageKey = `quotes/${shortCode}.pdf`

    await storage.put(pdfStorageKey, Buffer.from(pdf.bytes), 'application/pdf')

    try {
      const [row] = await db
        .insert(quotes)
        .values({
          servicem8Uuid: jobUuid,
          shortCode,
          clientName,
          companyName: meta.clientName,
          jobDescription: meta.jobDescription,
          jobAddress: meta.jobAddress,
          quoteValue,
          pdfStorageKey,
          expiresAt,
          emailGateEnabled: false,
          ownerUserId: opts.ownerUserId ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: quotes.servicem8Uuid,
          set: {
            shortCode,
            clientName,
            companyName: meta.clientName,
            jobDescription: meta.jobDescription,
            jobAddress: meta.jobAddress,
            quoteValue,
            pdfStorageKey,
            expiresAt,
            emailGateEnabled: false,
            ownerUserId: opts.ownerUserId ?? null,
            updatedAt: new Date(),
          },
        })
        .returning({ id: quotes.id, shortCode: quotes.shortCode })

      const quoteId = row.id
      const finalShortCode = row.shortCode ?? shortCode

      await db.insert(auditLog).values({
        action: 'quote.tracked_created',
        targetId: quoteId,
        detail: { jobUuid, shortCode: finalShortCode, storageDriver },
      })

      const baseUrl = process.env.VIEWER_BASE_URL ?? 'https://quotes.royalglass.co.nz'

      return {
        ok: true,
        quoteId,
        shortCode: finalShortCode,
        link: `${baseUrl}/q/${finalShortCode}`,
        expiresAt,
        clientName,
        jobAddress: meta.jobAddress ?? null,
        quoteValue,
        storageDriver,
      }
    } catch (err) {
      await storage.delete(pdfStorageKey)

      if (!existing && isUniqueViolation(err)) continue

      throw err
    }
  }

  throw new Error('Unable to create tracked quote after 5 short-code attempts.')
}
