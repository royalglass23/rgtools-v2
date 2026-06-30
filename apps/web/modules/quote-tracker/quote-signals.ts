import type { StatusTag } from './score'

export type QuoteSignalBucket =
  | 'high_intent'
  | 'gentle_nudge'
  | 'likely_unopened'
  | 'waiting_on_customer_context'
  | 'needs_clarification'
  | 'low_signal'
  | 'close_the_loop'

export const QUOTE_SIGNAL_LABELS: Record<QuoteSignalBucket, string> = {
  high_intent: 'High intent',
  gentle_nudge: 'Gentle nudge',
  likely_unopened: 'Likely unopened',
  waiting_on_customer_context: 'Waiting on customer context',
  needs_clarification: 'Needs clarification',
  low_signal: 'Low signal',
  close_the_loop: 'Close the loop',
}

export type QuoteSignalQuote = {
  id: string
  quoteValue: string | null
  statusTag: StatusTag | null
  interestScore: number | null
  createdAt: Date
  expiresAt: Date | null
  archivedAt: Date | null
  updatedAt: Date
  ownerUserId: string | null
  clientName: string
  companyName: string | null
  jobDescription: string | null
  jobAddress: string | null
}

export type QuoteSignalEngagement = {
  totalOpens: number
  uniqueViewers: number
  totalTimeMs: number
  maxScrollDepth: number
  hasDownload: boolean
  hasCta: boolean
  forwardingSuspected: boolean
  hasReturnVisit: boolean
  lastOpenedAt: Date | null
}

export type QuoteSignalConversationSnapshot = {
  id: string
  createdAt: Date
  structuredSummary?: {
    openQuestions?: string[]
    risksBlockers?: string[]
    lastKnownPosition?: string
  } | null
} | null

export type QuoteSignalInput = {
  quote: QuoteSignalQuote
  engagement: QuoteSignalEngagement
  conversationSnapshot: QuoteSignalConversationSnapshot
  now: Date
}

export type QuoteGuidanceRecommendation =
  | { kind: 'act_now'; revisitAt: null; watchForSignals: string[] }
  | { kind: 'wait'; revisitAt: string; watchForSignals: string[] }
  | { kind: 'close_loop'; revisitAt: null; watchForSignals: string[] }

export type QuoteSignalAnalyticsSnapshot = {
  generatedAt: string
  bucket: QuoteSignalBucket
  label: string
  quote: {
    quoteValue: string | null
    quoteAgeDays: number
    daysUntilExpiry: number | null
    isExpired: boolean
    isArchived: boolean
    statusTag: StatusTag | null
    interestScore: number | null
    ownerUserId: string | null
    updatedAt: string
    hasCustomerContext: boolean
    hasJobContext: boolean
  }
  engagement: {
    totalOpens: number
    uniqueViewers: number
    totalTimeMs: number
    maxScrollDepth: number
    hasDownload: boolean
    hasCta: boolean
    forwardingSuspected: boolean
    hasReturnVisit: boolean
    lastOpenedAt: string | null
  }
  conversationSnapshot: {
    id: string | null
    createdAt: string | null
    openQuestionCount: number
    riskCount: number
    lastKnownPosition: string | null
  }
  recommendation: QuoteGuidanceRecommendation
}

export type QuoteSignalClassification = {
  bucket: QuoteSignalBucket
  label: string
  reasons: string[]
  recommendation: QuoteGuidanceRecommendation
  analyticsSnapshot: QuoteSignalAnalyticsSnapshot
}

export type SuggestionStalenessResult = {
  isStale: boolean
  staleAt: string | null
  reasons: string[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const DUPLICATE_OPEN_WINDOW_MS = 30 * 1000
const MEANINGFUL_READ_TIME_INCREASE_MS = 60 * 1000
const MEANINGFUL_SCROLL_INCREASE = 10

export function classifyQuoteSignal(input: QuoteSignalInput): QuoteSignalClassification {
  const reasons: string[] = []
  const bucket = chooseSignalBucket(input, reasons)
  const label = QUOTE_SIGNAL_LABELS[bucket]
  const recommendation = buildRecommendation(bucket, input.now)

  return {
    bucket,
    label,
    reasons,
    recommendation,
    analyticsSnapshot: buildAnalyticsSnapshot(input, bucket, label, recommendation),
  }
}

export function detectSuggestionStaleness(
  saved: QuoteSignalAnalyticsSnapshot,
  current: QuoteSignalInput,
): SuggestionStalenessResult {
  const reasons: string[] = []
  const currentClassification = classifyQuoteSignal(current)
  const currentSnapshot = currentClassification.analyticsSnapshot

  if (
    saved.bucket === 'likely_unopened' &&
    saved.engagement.totalOpens === 0 &&
    currentSnapshot.engagement.totalOpens > 0
  ) {
    reasons.push('Customer opened the Tracked Quote after likely-unopened guidance.')
  }

  if (!saved.engagement.hasDownload && currentSnapshot.engagement.hasDownload) {
    reasons.push('Customer downloaded the Quote PDF after guidance was generated.')
  }

  if (!saved.engagement.hasCta && currentSnapshot.engagement.hasCta) {
    reasons.push('Customer clicked a call-to-action after guidance was generated.')
  }

  if (!saved.engagement.hasReturnVisit && currentSnapshot.engagement.hasReturnVisit) {
    reasons.push('Customer returned to the Tracked Quote after guidance was generated.')
  }

  if (!saved.engagement.forwardingSuspected && currentSnapshot.engagement.forwardingSuspected) {
    reasons.push('Forwarding signal appeared after guidance was generated.')
  }

  if (saved.quote.statusTag !== currentSnapshot.quote.statusTag) {
    reasons.push('Status tag changed after guidance was generated.')
  }

  if (saved.bucket !== currentSnapshot.bucket) {
    reasons.push(`Signal bucket changed from ${saved.label} to ${currentSnapshot.label}.`)
  }

  if (currentSnapshot.conversationSnapshot.id !== saved.conversationSnapshot.id) {
    reasons.push('A newer Conversation Snapshot is available.')
  }

  if (!saved.quote.isExpired && currentSnapshot.quote.isExpired) {
    reasons.push('Tracked Quote expired after guidance was generated.')
  }

  if (!saved.quote.isArchived && currentSnapshot.quote.isArchived) {
    reasons.push('Tracked Quote was archived after guidance was generated.')
  }

  if (isMeaningfulReadIncrease(saved, currentSnapshot)) {
    reasons.push('Read time increased meaningfully after guidance was generated.')
  }

  if (currentSnapshot.engagement.maxScrollDepth - saved.engagement.maxScrollDepth >= MEANINGFUL_SCROLL_INCREASE) {
    reasons.push('Scroll depth increased meaningfully after guidance was generated.')
  }

  if (isQuoteRefresh(saved, currentSnapshot)) {
    reasons.push('Tracked Quote was refreshed after guidance was generated.')
  }

  const filteredReasons = shouldTreatAsDuplicateOpenOnly(saved, currentSnapshot, reasons) ? [] : reasons

  return {
    isStale: filteredReasons.length > 0,
    staleAt: filteredReasons.length > 0 ? current.now.toISOString() : null,
    reasons: filteredReasons,
  }
}

function chooseSignalBucket(input: QuoteSignalInput, reasons: string[]): QuoteSignalBucket {
  const { quote, engagement, conversationSnapshot, now } = input
  const isExpired = Boolean(quote.expiresAt && quote.expiresAt <= now)
  const quoteAgeDays = elapsedDays(quote.createdAt, now)
  const openQuestions = conversationSnapshot?.structuredSummary?.openQuestions ?? []
  const risksBlockers = conversationSnapshot?.structuredSummary?.risksBlockers ?? []
  const lastKnownPosition = conversationSnapshot?.structuredSummary?.lastKnownPosition ?? ''

  if (quote.archivedAt || isExpired) {
    reasons.push(quote.archivedAt ? 'Tracked Quote is archived.' : 'Tracked Quote has expired.')
    return 'close_the_loop'
  }

  if (
    engagement.hasCta ||
    engagement.hasDownload ||
    engagement.forwardingSuspected ||
    engagement.hasReturnVisit ||
    engagement.totalOpens >= 3 ||
    engagement.totalTimeMs >= 5 * 60 * 1000 ||
    engagement.maxScrollDepth >= 90 ||
    quote.statusTag === 'hot' ||
    (quote.interestScore ?? 0) >= 80
  ) {
    if (engagement.hasCta || engagement.hasDownload) {
      reasons.push('Clicked a call-to-action or downloaded the Quote PDF.')
    }
    if (engagement.hasReturnVisit || engagement.totalOpens >= 3) {
      reasons.push('Returned to the Tracked Quote after the first open.')
    }
    if (engagement.forwardingSuspected) {
      reasons.push('Forwarding signal suggests more than one decision-maker is reviewing.')
    }
    if (engagement.totalTimeMs >= 5 * 60 * 1000 || engagement.maxScrollDepth >= 90) {
      reasons.push('Spent meaningful time reading the Quote PDF.')
    }
    return 'high_intent'
  }

  if (openQuestions.length > 0 || risksBlockers.length > 0) {
    reasons.push('Conversation Snapshot contains open questions or blockers.')
    return 'needs_clarification'
  }

  if (mentionsWaiting(lastKnownPosition)) {
    reasons.push('Conversation Snapshot suggests the customer is waiting on outside context.')
    return 'waiting_on_customer_context'
  }

  if (engagement.totalOpens === 0 && quoteAgeDays >= 3) {
    reasons.push('No customer open has been recorded after three days.')
    return 'likely_unopened'
  }

  if (
    quote.statusTag === 'warm' ||
    ((quote.interestScore ?? 0) >= 35 && (quote.interestScore ?? 0) < 80) ||
    (engagement.totalOpens > 0 && (engagement.maxScrollDepth >= 50 || engagement.totalTimeMs >= 60 * 1000))
  ) {
    reasons.push('Customer has opened the Tracked Quote, but there is no high-intent action yet.')
    return 'gentle_nudge'
  }

  reasons.push('Tracked Quote has limited engagement so far.')
  return 'low_signal'
}

function buildRecommendation(bucket: QuoteSignalBucket, now: Date): QuoteGuidanceRecommendation {
  if (bucket === 'close_the_loop') {
    return { kind: 'close_loop', revisitAt: null, watchForSignals: [] }
  }

  if (bucket === 'likely_unopened' || bucket === 'low_signal') {
    return {
      kind: 'wait',
      revisitAt: new Date(now.getTime() + DAY_MS).toISOString(),
      watchForSignals: ['first_open', 'download_or_cta', 'forwarding_signal'],
    }
  }

  return {
    kind: 'act_now',
    revisitAt: null,
    watchForSignals: ['download_or_cta', 'reply_or_new_context', 'quote_refresh'],
  }
}

function buildAnalyticsSnapshot(
  input: QuoteSignalInput,
  bucket: QuoteSignalBucket,
  label: string,
  recommendation: QuoteGuidanceRecommendation,
): QuoteSignalAnalyticsSnapshot {
  const { quote, engagement, conversationSnapshot, now } = input

  return {
    generatedAt: now.toISOString(),
    bucket,
    label,
    quote: {
      quoteValue: quote.quoteValue,
      quoteAgeDays: elapsedDays(quote.createdAt, now),
      daysUntilExpiry: quote.expiresAt ? elapsedDays(now, quote.expiresAt) : null,
      isExpired: Boolean(quote.expiresAt && quote.expiresAt <= now),
      isArchived: Boolean(quote.archivedAt),
      statusTag: quote.statusTag,
      interestScore: quote.interestScore,
      ownerUserId: quote.ownerUserId,
      updatedAt: quote.updatedAt.toISOString(),
      hasCustomerContext: Boolean(quote.clientName || quote.companyName),
      hasJobContext: Boolean(quote.jobDescription || quote.jobAddress),
    },
    engagement: {
      totalOpens: engagement.totalOpens,
      uniqueViewers: engagement.uniqueViewers,
      totalTimeMs: engagement.totalTimeMs,
      maxScrollDepth: engagement.maxScrollDepth,
      hasDownload: engagement.hasDownload,
      hasCta: engagement.hasCta,
      forwardingSuspected: engagement.forwardingSuspected,
      hasReturnVisit: engagement.hasReturnVisit,
      lastOpenedAt: engagement.lastOpenedAt?.toISOString() ?? null,
    },
    conversationSnapshot: {
      id: conversationSnapshot?.id ?? null,
      createdAt: conversationSnapshot?.createdAt.toISOString() ?? null,
      openQuestionCount: conversationSnapshot?.structuredSummary?.openQuestions?.length ?? 0,
      riskCount: conversationSnapshot?.structuredSummary?.risksBlockers?.length ?? 0,
      lastKnownPosition: conversationSnapshot?.structuredSummary?.lastKnownPosition ?? null,
    },
    recommendation,
  }
}

function elapsedDays(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS)
}

function mentionsWaiting(value: string): boolean {
  return /\b(waiting|pending|confirm|confirmation|deciding|reviewing|checking)\b/i.test(value)
}

function isMeaningfulReadIncrease(
  saved: QuoteSignalAnalyticsSnapshot,
  current: QuoteSignalAnalyticsSnapshot,
): boolean {
  return current.engagement.totalTimeMs - saved.engagement.totalTimeMs >= MEANINGFUL_READ_TIME_INCREASE_MS
}

function isQuoteRefresh(saved: QuoteSignalAnalyticsSnapshot, current: QuoteSignalAnalyticsSnapshot): boolean {
  const savedUpdatedAt = Date.parse(saved.quote.updatedAt)
  const currentUpdatedAt = Date.parse(current.quote.updatedAt)
  const generatedAt = Date.parse(saved.generatedAt)

  return (
    !Number.isNaN(savedUpdatedAt) &&
    !Number.isNaN(currentUpdatedAt) &&
    !Number.isNaN(generatedAt) &&
    currentUpdatedAt > savedUpdatedAt &&
    currentUpdatedAt > generatedAt
  )
}

function shouldTreatAsDuplicateOpenOnly(
  saved: QuoteSignalAnalyticsSnapshot,
  current: QuoteSignalAnalyticsSnapshot,
  reasons: string[],
): boolean {
  if (reasons.length > 0) return false
  if (current.engagement.totalOpens <= saved.engagement.totalOpens) return false
  const lastOpenedAt = current.engagement.lastOpenedAt ? Date.parse(current.engagement.lastOpenedAt) : NaN
  const generatedAt = Date.parse(saved.generatedAt)
  return (
    !Number.isNaN(lastOpenedAt) &&
    !Number.isNaN(generatedAt) &&
    lastOpenedAt - generatedAt <= DUPLICATE_OPEN_WINDOW_MS
  )
}
