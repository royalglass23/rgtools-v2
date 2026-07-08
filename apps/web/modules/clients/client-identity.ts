export type ClientIdentityType =
  | 'company'
  | 'individual_homeowner'
  | 'household'
  | 'contractor'
  | 'sole_trader'
  | 'other'

export type ClientReviewStatus = 'pending_review' | 'reviewed' | 'dismissed'
export type ClientCanonicalSource = 'import' | 'manual' | 'system'

export type ClientIdentityExisting = {
  name: string
  companyName: string | null
  phone: string | null
  phoneNormalized: string | null
  email: string | null
  reviewStatus: ClientReviewStatus
  canonicalSource: ClientCanonicalSource
  canonicalUpdatedAt?: Date
}

export type ClientIdentitySource = {
  servicem8CompanyUuid?: string | null
  clientName: string
  companyName?: string | null
  phone?: string | null
  phoneNormalized?: string | null
  email?: string | null
  sourceSnapshot?: unknown
  syncedAt?: Date
}

export type ClientIdentityUpsert = {
  servicem8CompanyUuid: string | null
  name: string
  companyName: string | null
  phone: string | null
  phoneNormalized: string | null
  email: string | null
  canonicalSource: ClientCanonicalSource
  canonicalUpdatedAt: Date
  reviewStatus: ClientReviewStatus
  servicem8Name: string
  servicem8CompanyName: string | null
  servicem8Phone: string | null
  servicem8PhoneNormalized: string | null
  servicem8Email: string | null
  servicem8SourceSnapshot: unknown
  servicem8LastSyncedAt: Date
  updatedAt: Date
}

export function buildClientIdentityUpsert({
  existing,
  source,
  now,
}: {
  existing: ClientIdentityExisting | null
  source: ClientIdentitySource
  now: Date
}): ClientIdentityUpsert {
  const servicem8Name = source.clientName.trim()
  const locked = Boolean(existing && (
    existing.reviewStatus === 'reviewed' || existing.canonicalSource === 'manual'
  ))

  return {
    servicem8CompanyUuid: source.servicem8CompanyUuid?.trim() || null,
    name: locked ? existing!.name : servicem8Name,
    companyName: locked ? existing!.companyName : clean(source.companyName),
    phone: locked ? existing!.phone : clean(source.phone),
    phoneNormalized: locked ? existing!.phoneNormalized : clean(source.phoneNormalized),
    email: locked ? existing!.email : clean(source.email),
    canonicalSource: existing?.canonicalSource ?? 'import',
    canonicalUpdatedAt: locked ? existing!.canonicalUpdatedAt ?? now : now,
    reviewStatus: existing?.reviewStatus ?? 'pending_review',
    servicem8Name,
    servicem8CompanyName: clean(source.companyName),
    servicem8Phone: clean(source.phone),
    servicem8PhoneNormalized: clean(source.phoneNormalized),
    servicem8Email: clean(source.email),
    servicem8SourceSnapshot: source.sourceSnapshot ?? null,
    servicem8LastSyncedAt: source.syncedAt ?? now,
    updatedAt: now,
  }
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
