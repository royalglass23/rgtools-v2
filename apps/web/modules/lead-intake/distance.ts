const ORIGIN = '13E Paul Matthews Rd, Auckland, New Zealand'

export type DistanceBand = 'within_30km' | '30km_to_80km' | 'over_80km'
export type MatrixDistanceBand = 'lt_15km' | '15_50km' | 'gt_50km'

export type DrivingDistanceResult = {
  band: MatrixDistanceBand
  rawKm: number
}

export async function computeDrivingDistance(destination: string): Promise<DrivingDistanceResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY
  if (!apiKey || !destination) return null

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
    url.searchParams.set('origins', ORIGIN)
    url.searchParams.set('destinations', destination)
    url.searchParams.set('mode', 'driving')
    url.searchParams.set('key', apiKey)

    const res = await fetch(url.toString())
    if (!res.ok) return null

    const data = await res.json()
    const element = data?.rows?.[0]?.elements?.[0]
    if (element?.status !== 'OK') return null

    const km = (element.distance?.value ?? 0) / 1000
    if (km < 15) return { band: 'lt_15km', rawKm: km }
    if (km <= 50) return { band: '15_50km', rawKm: km }
    return { band: 'gt_50km', rawKm: km }
  } catch {
    return null
  }
}

export async function computeDistanceBand(destination: string): Promise<MatrixDistanceBand | null> {
  return (await computeDrivingDistance(destination))?.band ?? null
}
