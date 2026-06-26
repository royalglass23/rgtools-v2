export type ServiceM8LeadTier = 'A' | 'B' | 'C' | 'D'

export type ServiceM8LeadSyncRecord = {
  leadId: string
  servicem8JobUuid: string | null
  clientName: string
  companyName: string | null
  phone: string | null
  email: string | null
  source: string
  projectType: string | null
  location: string | null
  suburb: string | null
  clientProfileKey: string | null
  budgetBand: string | null
  consentStatus: string | null
  complexity: string | null
  priceSensitivityRead: string | null
  decisionMakers: string | null
  distanceBand: string | null
  freeText: string | null
  seedScore: number | null
  tier: ServiceM8LeadTier | null
  scoreReason: string | null
  strikeFlag: string | null
  completeness: number | null
}

export type ServiceM8LeadPayload = {
  to: string[]
  subject: string
  body: string
  noteSignature: string
}

export function buildServiceM8InboxEmail(
  record: ServiceM8LeadSyncRecord,
  recipients: string[],
): ServiceM8LeadPayload {
  const tier = record.tier ?? 'D'
  const score = record.seedScore ?? 0
  const completeness = record.completeness ?? 0
  const subject = [
    'RGTools Lead',
    `Leads Quality ${tier}`,
    record.clientName,
    record.projectType,
  ].filter(Boolean).join(' - ')
  const bodyLines = [
    `Name: ${record.clientName}`,
    record.phone ? `Mobile: ${record.phone}` : null,
    record.email ? `Email: ${record.email}` : null,
    record.location ? `Address: ${record.location}` : null,
    '',
    '--- RGTools Lead Score ---',
    `Leads Quality: ${tier}`,
    `Score: ${score}`,
    `Completeness: ${completeness}%`,
    record.strikeFlag ? `Flag: ${record.strikeFlag}` : null,
    record.scoreReason ? `Reason: ${record.scoreReason}` : null,
    '',
    '--- Lead Intake ---',
    record.distanceBand ? `Driving distance: ${record.distanceBand}` : null,
    record.projectType ? `Project type: ${record.projectType}` : null,
    record.clientProfileKey ? `Client type: ${record.clientProfileKey}` : null,
    record.budgetBand ? `Budget band: ${record.budgetBand}` : null,
    record.consentStatus ? `Consent status: ${record.consentStatus}` : null,
    record.complexity ? `Complexity: ${record.complexity}` : null,
    record.priceSensitivityRead ? `Price-sensitivity read: ${record.priceSensitivityRead}` : null,
    record.decisionMakers ? `Decision-makers: ${record.decisionMakers}` : null,
    `Source: ${record.source}`,
    record.suburb ? `Suburb: ${record.suburb}` : null,
    record.freeText ? `Anything else: ${record.freeText}` : null,
    '',
    '--- Reference ---',
    `RGTools Lead ${record.leadId}`,
  ].filter((line): line is string => line !== null)

  return {
    to: recipients,
    subject,
    body: bodyLines.join('\n'),
    noteSignature: [
      tier,
      score,
      completeness,
      record.scoreReason ?? '',
      record.strikeFlag ?? '',
    ].join('|'),
  }
}
