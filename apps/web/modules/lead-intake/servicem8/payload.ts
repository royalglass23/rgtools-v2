import { DECISION_MATRIX, type MatrixFieldKey } from '@/modules/lead-intake/scoring/score-lead'

export type ServiceM8LeadTier = 'A' | 'B' | 'C' | 'D' | 'E'

export type ServiceM8LeadSyncRecord = {
  leadId: string
  servicem8JobUuid: string | null
  clientName: string
  companyName: string | null
  phone: string | null
  email: string | null
  channel: string
  source: string | null
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
  paymentHistory: string | null
  siteAccess: string | null
  installationHeight: string | null
  freeText: string | null
  seedScore: number | null
  tier: ServiceM8LeadTier | null
  scoreReason: string | null
  strikeFlag: string | null
  completeness: number | null
  updatedAt: Date
}

export type ServiceM8LeadPayload = {
  to: string[]
  subject: string
  body: string
  noteSignature: string
}

export type ServiceM8LeadJobCardFields = {
  jobDescription: string | null
  clientType: string | null
  leadsQuality: ServiceM8LeadTier | null
  note: string | null
}

export function buildServiceM8InboxEmail(
  record: ServiceM8LeadSyncRecord,
  recipients: string[],
): ServiceM8LeadPayload {
  const tier = record.tier ?? 'D'
  const score = record.seedScore ?? 0
  const completeness = record.completeness ?? 0
  const jobCard = buildServiceM8LeadJobCardFields(record)
  const subject = [
    'RGTools Lead',
    `Leads Quality ${tier}`,
    record.clientName,
    humanizeValue(record.projectType),
  ].filter(Boolean).join(' - ')
  const bodyLines = [
    `Name: ${record.clientName}`,
    record.companyName ? `Company: ${record.companyName}` : null,
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
    readableLine('Driving distance', optionLabel('distanceBand', record.distanceBand)),
    readableLine('Project type', humanizeValue(record.projectType)),
    readableLine('Client type', jobCard.clientType),
    readableLine('Budget band', optionLabel('budgetBand', record.budgetBand)),
    readableLine('Consent status', humanizeValue(record.consentStatus)),
    readableLine('Complexity', optionLabel('projectType', record.complexity)),
    readableLine('Price-sensitivity read', optionLabel('priceSensitivity', record.priceSensitivityRead)),
    readableLine('Decision-makers', optionLabel('decisionMakers', record.decisionMakers)),
    readableLine('Source', optionLabel('source', record.source)),
    readableLine('Payment history', optionLabel('paymentHistory', record.paymentHistory)),
    readableLine('Site access', optionLabel('siteAccess', record.siteAccess)),
    readableLine('Installation height', optionLabel('installationHeight', record.installationHeight)),
    readableLine('Channel', humanizeValue(record.channel)),
    record.suburb ? `Suburb: ${record.suburb}` : null,
    jobCard.jobDescription ? `Job description: ${jobCard.jobDescription}` : null,
    readableLine('Details', cleanOneLine(record.freeText)),
    jobCard.note ? `Note: ${jobCard.note}` : null,
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

export function buildServiceM8LeadJobCardFields(
  record: Pick<ServiceM8LeadSyncRecord,
    | 'leadId'
    | 'clientProfileKey'
    | 'freeText'
    | 'projectType'
    | 'complexity'
    | 'tier'
    | 'seedScore'
    | 'completeness'
    | 'scoreReason'
    | 'strikeFlag'
    | 'updatedAt'
  >,
): ServiceM8LeadJobCardFields {
  const leadQuality = record.tier ?? null
  const jobDescriptionSegments = [
    record.seedScore === null || record.seedScore === undefined ? null : `Score ${record.seedScore}`,
    readableSegment('Product', humanizeValue(record.projectType)),
    readableSegment('Project', optionLabel('projectType', record.complexity)),
  ].filter((line): line is string => Boolean(line))
  const jobDescription = [
    ...jobDescriptionSegments,
    readableSegment('Last update', formatLeadCardDate(record.updatedAt)),
  ].filter((line): line is string => Boolean(line)).join(' | ')
  const noteLines = [
    leadQuality ? `Leads Quality ${leadQuality}` : null,
    record.seedScore === null || record.seedScore === undefined ? null : `Score ${record.seedScore}`,
    record.completeness === null || record.completeness === undefined ? null : `${record.completeness}% complete`,
    cleanOneLine(record.scoreReason),
    cleanOneLine(record.strikeFlag),
    `RGTools Lead ${record.leadId}`,
  ].filter((line): line is string => Boolean(line))

  return {
    jobDescription: jobDescriptionSegments.length > 0 ? jobDescription : null,
    clientType: optionLabel('clientType', record.clientProfileKey),
    leadsQuality: leadQuality,
    note: noteLines.length > 0 ? noteLines.join(' | ') : null,
  }
}

function optionLabel(fieldKey: MatrixFieldKey, value: string | null | undefined): string | null {
  if (!value) return null
  return DECISION_MATRIX.fields
    .find((field) => field.key === fieldKey)
    ?.options.find((option) => option.key === value)
    ?.label ?? humanizeValue(value)
}

function readableLine(label: string, value: string | null): string | null {
  return value ? `${label}: ${value}` : null
}

function readableSegment(label: string, value: string | null): string | null {
  return value ? `${label}: ${value}` : null
}

function formatLeadCardDate(value: Date): string | null {
  if (Number.isNaN(value.getTime())) return null
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Pacific/Auckland',
  }).format(value)
}

function cleanOneLine(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, ' ').trim()
  return cleaned || null
}

function humanizeValue(value: string | null | undefined): string | null {
  const cleaned = cleanOneLine(value)
  if (!cleaned) return null
  return cleaned
    .split('_')
    .filter(Boolean)
    .map((part) => {
      if (/^lt$/i.test(part)) return '<'
      if (/^gt$/i.test(part)) return '>'
      if (/^\d+k$/i.test(part)) return `$${part.toLowerCase()}`
      if (/^\d+$/.test(part)) return part
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
    .replace(/< (\d+)/g, '<$1')
    .replace(/> (\d+)/g, '>$1')
}
