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

const LEGACY_OPTION_LABELS: Record<string, string> = {
  within_30km: 'Within 30 km',
  '30km_to_80km': '30-80 km',
  over_80km: 'Over 80 km',
  new_business: 'New Business',
  existing_business: 'Existing Business',
  homeowner: 'Homeowner',
  builder: 'Builder',
  developer: 'Developer',
  architect: 'Architect',
  pool_builder: 'Pool Builder',
  '2k_to_10k': '$2k to $10k',
  '10k_to_50k': '$10k to $50k',
  standard_non_custom: 'Standard Non Custom',
  pool_fence: 'Pool Fence',
  stair: 'Stair Balustrade',
  balcony_balustrade: 'Balcony Balustrade',
  ground_level: 'Ground Level Balustrade',
  stair_balustrade: 'Stair Balustrade',
  calculator: 'Calculator',
  anytime: 'Anytime',
  spigot_round: 'Round Spigots',
  standoff_posts: 'Stand-off Posts',
  jh_clamps: 'JH Clamps',
  tile: 'Tile',
  concrete: 'Concrete',
  timber: 'Timber',
  steel: 'Steel',
  matte_black: 'Matte Black',
  standard_chrome: 'Standard Chrome',
  brushed_chrome: 'Brushed Chrome',
  powder_coated: 'Powder Coated',
  toughened_12mm: '12mm Toughened',
  toughened_12mm_clear: '12mm Toughened / Clear',
  laminated: 'Laminated Glass',
  clear: 'Clear',
  low_iron: 'Low Iron / Ultra-Clear',
  tinted: 'Tinted',
  frosted: 'Frosted',
}

const LEGACY_OPTION_PATTERN = new RegExp(
  `\\b(${Object.keys(LEGACY_OPTION_LABELS)
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join('|')})\\b`,
  'g',
)

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
    record.scoreReason ? `Reason: ${humanizeStoredText(record.scoreReason)}` : null,
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
    readableLine('Details', humanizeStoredText(record.freeText)),
    jobCard.note ? `Note: ${humanizeStoredText(jobCard.note)}` : null,
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
    humanizeStoredText(record.scoreReason),
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
  if (LEGACY_OPTION_LABELS[cleaned]) return LEGACY_OPTION_LABELS[cleaned]
  return cleaned
    .split('_')
    .filter(Boolean)
    .map((part) => {
      if (/^lt$/i.test(part)) return '<'
      if (/^gt$/i.test(part)) return '>'
      if (/^km$/i.test(part)) return 'km'
      if (/^\d+k$/i.test(part)) return `$${part.toLowerCase()}`
      if (/^\d+$/.test(part)) return part
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
    .replace(/< (\d+)/g, '<$1')
    .replace(/> (\d+)/g, '>$1')
    .replace(/\bTo\b/g, 'to')
    .replace(/\bKm\b/g, 'km')
}

function humanizeStoredText(value: string | null | undefined): string | null {
  const cleaned = cleanOneLine(value)
  if (!cleaned) return null

  return cleaned
    .replace(LEGACY_OPTION_PATTERN, (match) => LEGACY_OPTION_LABELS[match] ?? match)
    .replace(/\b[a-z0-9]+(?:_[a-z0-9]+)+\b/g, (match) => humanizeValue(match) ?? match)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
