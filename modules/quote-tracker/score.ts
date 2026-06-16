export type StatusTag = 'hot' | 'warm' | 'cold' | 'dead'

export type EngagementData = {
  totalOpens: number
  totalTimeMs: number
  maxScrollDepth: number
  uniqueSessions: number
  uniqueDevices: number
  forwardingSuspected: boolean
  hasCta: boolean
  hasReturnVisit: boolean
  createdAt?: Date
}

export const STATUS_TAG_RULES: Record<StatusTag, string> = {
  hot: '3+ opens, return visit, CTA click, or more than 5 minutes total reading time.',
  warm: '1-2 opens with more than 50% max scroll depth.',
  cold: 'Opened, but engagement is still low or incomplete.',
  dead: 'Never opened after 3+ days since creation.',
}

const DAY_MS = 24 * 60 * 60 * 1000

export function computeScore(e: EngagementData): number {
  const raw =
    e.totalOpens * 10 +
    (Math.max(0, e.maxScrollDepth) / 100) * 20 +
    e.uniqueDevices * 10 +
    (e.forwardingSuspected ? 15 : 0) +
    (e.hasCta ? 25 : 0)

  return Math.min(100, Math.max(0, Math.round(raw)))
}

export function computeStatusTag(e: EngagementData): StatusTag {
  if (
    e.totalOpens >= 3 ||
    e.hasReturnVisit ||
    e.hasCta ||
    e.totalTimeMs > 5 * 60 * 1000
  ) {
    return 'hot'
  }

  if (e.totalOpens >= 1 && e.totalOpens <= 2 && e.maxScrollDepth > 50) {
    return 'warm'
  }

  if (e.totalOpens > 0) {
    return 'cold'
  }

  if (e.createdAt && Date.now() - e.createdAt.getTime() >= 3 * DAY_MS) {
    return 'dead'
  }

  return 'cold'
}
