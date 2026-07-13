export type LinzLotDescriptionConfidence = 'high' | 'needs_confirmation'

export type LinzLotDescriptionResult =
  | {
    found: true
    lotDescription: string
    confidence: LinzLotDescriptionConfidence
    source: 'linz-dvr' | 'linz-property-title-parcels'
    warning?: string
    address?: {
      addressId: number
      fullAddress: string
    }
    unitOfPropertyId?: string
    titleNos?: string[]
    parcels?: Array<{
      id: number
      appellation: string
      areaSquareMetres: number | null
      titles: string | null
    }>
  }
  | {
    found: false
    message: string
  }

export type LinzFeature = {
  properties: Record<string, unknown>
}

export type LinzFeatureClient = {
  getFeatures: (typeName: string, cqlFilter: string, options?: { count?: number }) => Promise<LinzFeature[]>
}

const LINZ_WFS_URL = 'https://data.linz.govt.nz/services/wfs'
const NEEDS_CONFIRMATION_WARNING = 'LINZ linked this property to multiple titles/parcels. Review before generating.'

export async function lookupLinzLotDescription(address: string) {
  return resolveLinzLotDescription(address, createLinzFeatureClient())
}

export async function resolveLinzLotDescription(
  address: string,
  client: LinzFeatureClient,
): Promise<LinzLotDescriptionResult> {
  const addressRecord = await findAddress(address, client)
  if (!addressRecord) {
    return { found: false, message: 'No LINZ address match found.' }
  }

  const propertyRefs = await client.getFeatures('table-115638', `address_id=${addressRecord.addressId}`)
  const unitOfPropertyId = firstString(propertyRefs[0]?.properties.unit_of_property_id)
  if (!unitOfPropertyId) {
    return { found: false, message: 'LINZ did not link this address to a property.' }
  }

  const dvrRows = await client.getFeatures('table-114085', `unit_of_property_id='${escapeCqlString(unitOfPropertyId)}'`)
  const dvrLegalDescription = dvrRows
    .map((row) => firstString(row.properties.legal_description))
    .find((value): value is string => Boolean(value))
  if (dvrLegalDescription) {
    return {
      found: true,
      lotDescription: normalizeLotDescription(dvrLegalDescription),
      confidence: 'high',
      source: 'linz-dvr',
      address: addressRecord,
      unitOfPropertyId,
    }
  }

  const titleRows = await client.getFeatures('table-113970', `unit_of_property_id='${escapeCqlString(unitOfPropertyId)}'`)
  const titleNos = uniqueSorted(titleRows.map((row) => firstString(row.properties.title_no)).filter(isPresent))
  if (titleNos.length === 0) {
    return { found: false, message: 'LINZ did not link this property to any titles.' }
  }

  const associations = await client.getFeatures('table-52008', `ttl_title_no IN (${quoteList(titleNos)})`)
  const parcelIds = uniqueSortedNumbers(associations.map((row) => firstNumber(row.properties.par_id)).filter(isPresent))
  if (parcelIds.length === 0) {
    return { found: false, message: 'LINZ did not link this property title to any parcels.' }
  }

  const parcelRows = await client.getFeatures('layer-50772', `id IN (${parcelIds.join(',')})`)
  const parcels = parcelRows
    .map((row) => toParcel(row.properties))
    .filter(isPresent)
    .sort(compareParcels)

  if (parcels.length === 0) {
    return { found: false, message: 'LINZ did not return parcel details for this property.' }
  }

  const confidence: LinzLotDescriptionConfidence = titleNos.length === 1 ? 'high' : 'needs_confirmation'
  return {
    found: true,
    lotDescription: parcels.map(formatParcelDescription).join(', '),
    confidence,
    source: 'linz-property-title-parcels',
    warning: confidence === 'needs_confirmation' ? NEEDS_CONFIRMATION_WARNING : undefined,
    address: addressRecord,
    unitOfPropertyId,
    titleNos,
    parcels,
  }
}

function createLinzFeatureClient(): LinzFeatureClient {
  const apiKey = process.env.LINZ_API_KEY?.trim()
  if (!apiKey) throw new Error('LINZ_API_KEY is not configured')

  return {
    async getFeatures(typeName, cqlFilter, options) {
      const url = new URL(LINZ_WFS_URL)
      url.pathname = `/services;key=${encodeURIComponent(apiKey)}/wfs`
      url.searchParams.set('service', 'WFS')
      url.searchParams.set('version', '2.0.0')
      url.searchParams.set('request', 'GetFeature')
      url.searchParams.set('typeNames', typeName)
      url.searchParams.set('outputFormat', 'json')
      url.searchParams.set('CQL_FILTER', cqlFilter)
      if (options?.count) url.searchParams.set('count', String(options.count))

      const response = await fetch(url)
      if (!response.ok) throw new Error(`LINZ request failed with status ${response.status}`)

      const body = await response.json() as { features?: LinzFeature[] }
      return Array.isArray(body.features) ? body.features : []
    },
  }
}

async function findAddress(address: string, client: LinzFeatureClient) {
  for (const term of buildAddressSearchTerms(address)) {
    const rows = await client.getFeatures('layer-123113', `full_address ILIKE '${escapeCqlString(term)}%'`, { count: 10 })
    const match = rows
      .map((row) => ({
        addressId: firstNumber(row.properties.address_id),
        fullAddress: firstString(row.properties.full_address),
      }))
      .find((candidate): candidate is { addressId: number; fullAddress: string } => (
        typeof candidate.addressId === 'number' && Boolean(candidate.fullAddress)
      ))
    if (match) return match
  }

  return null
}

function buildAddressSearchTerms(address: string) {
  const cleaned = address
    .replace(/\bnew zealand\b/ig, '')
    .replace(/\b\d{4}\b/g, '')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/,\s*$/g, '')
    .trim()
  const streetPrefix = streetAddressPrefix(cleaned)
  const beforeComma = cleaned.split(',')[0]?.trim() ?? ''

  return uniqueSortedByInputOrder([cleaned, beforeComma, streetPrefix].filter(Boolean))
}

function streetAddressPrefix(address: string) {
  const roadTypes = new Set([
    'avenue',
    'close',
    'court',
    'crescent',
    'drive',
    'glade',
    'grove',
    'lane',
    'parade',
    'place',
    'road',
    'street',
    'terrace',
    'view',
    'way',
  ])
  const words = address.split(/[,\s]+/).filter(Boolean)
  const roadTypeIndex = words.findIndex((word, index) => index > 0 && roadTypes.has(word.toLowerCase()))
  if (roadTypeIndex >= 0) return words.slice(0, roadTypeIndex + 1).join(' ')
  return words.slice(0, 4).join(' ')
}

function toParcel(properties: Record<string, unknown>) {
  const id = firstNumber(properties.id)
  const appellation = firstString(properties.appellation)
  if (typeof id !== 'number' || !appellation) return null

  return {
    id,
    appellation,
    areaSquareMetres: firstNumber(properties.survey_area) ?? firstNumber(properties.calc_area) ?? null,
    titles: firstString(properties.titles) ?? null,
  }
}

function formatParcelDescription(parcel: { appellation: string; areaSquareMetres: number | null }) {
  const appellation = parcel.appellation.toUpperCase()
  if (!parcel.areaSquareMetres) return appellation
  return `${appellation} ${Math.round(parcel.areaSquareMetres)}M2`
}

function normalizeLotDescription(value: string) {
  return value.replace(/\s+/g, ' ').trim().toUpperCase()
}

function compareParcels(
  left: { appellation: string; id: number },
  right: { appellation: string; id: number },
) {
  const leftKey = parcelSortKey(left.appellation)
  const rightKey = parcelSortKey(right.appellation)
  if (leftKey.group !== rightKey.group) return leftKey.group - rightKey.group
  if (leftKey.number !== rightKey.number) return leftKey.number - rightKey.number
  if (leftKey.plan !== rightKey.plan) return leftKey.plan.localeCompare(rightKey.plan)
  return left.id - right.id
}

function parcelSortKey(appellation: string) {
  const match = /^(lot|section)\s+(\d+)\s+(.+)$/i.exec(appellation.trim())
  if (!match) return { group: 99, number: Number.MAX_SAFE_INTEGER, plan: appellation }

  return {
    group: match[1].toLowerCase() === 'lot' ? 0 : 1,
    number: Number(match[2]),
    plan: match[3].toUpperCase(),
  }
}

function quoteList(values: string[]) {
  return values.map((value) => `'${escapeCqlString(value)}'`).join(',')
}

function escapeCqlString(value: string) {
  return value.replace(/'/g, "''")
}

function firstString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function firstNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
}

function uniqueSortedNumbers(values: number[]) {
  return Array.from(new Set(values)).sort((left, right) => left - right)
}

function uniqueSortedByInputOrder(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) === index)
}
