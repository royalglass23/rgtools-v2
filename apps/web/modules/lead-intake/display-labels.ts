export const PROJECT_TYPES = [
  { key: 'ground_level', label: 'Ground Level Balustrade' },
  { key: 'balcony_balustrade', label: 'Balcony Balustrade' },
  { key: 'stair_balustrade', label: 'Stair Balustrade' },
  { key: 'pool_fence', label: 'Pool Fence' },
  { key: 'shower', label: 'Shower' },
  { key: 'handrail', label: 'Handrail' },
  { key: 'other', label: 'Other' },
]

export const SOURCES = [
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'wechat', label: 'WeChat' },
  { key: 'calculator', label: 'Calculator' },
  { key: 'contact_form', label: 'Contact Form' },
  { key: 'other', label: 'Other' },
]

const PROJECT_TYPE_LABELS = Object.fromEntries(PROJECT_TYPES.map((option) => [option.key, option.label]))
const SOURCE_LABELS = Object.fromEntries(SOURCES.map((option) => [option.key, option.label]))

export function formatProjectType(value: string | null | undefined) {
  return formatKnownValue(value, PROJECT_TYPE_LABELS)
}

export function formatLeadSource(value: string | null | undefined) {
  return formatKnownValue(value, SOURCE_LABELS)
}

export function formatAnswerKey(value: string | null | undefined) {
  if (!value) return '-'
  return titleCase(value.replaceAll('_', ' ').replaceAll('/', ' / '))
}

function formatKnownValue(value: string | null | undefined, labels: Record<string, string>) {
  if (!value) return '-'
  return labels[value] ?? formatAnswerKey(value)
}

function titleCase(value: string) {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}
