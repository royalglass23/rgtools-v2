const ORIGIN = '13E Paul Matthews Rd, Auckland, New Zealand'

export type DistanceBand = 'within_30km' | '30km_to_80km' | 'over_80km'

export async function computeDistanceBand(destination: string): Promise<DistanceBand | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
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
    if (km <= 30) return 'within_30km'
    if (km <= 80) return '30km_to_80km'
    return 'over_80km'
  } catch {
    return null
  }
}
