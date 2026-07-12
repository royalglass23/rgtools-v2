'use client'

import { useEffect, useRef } from 'react'

type AddressComponent = { types: string[]; short_name: string; long_name?: string }
type AddressChangeSource = 'input' | 'place' | 'manual'
type GeocodedAddress = { address: string; suburb: string }

type Props = {
  value: string
  onChange: (address: string, suburb: string, source?: AddressChangeSource) => void
  label?: string
  required?: boolean
  updateOnInput?: boolean
}

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY

let mapsConfigured = false

const FIELD_LABEL_CLASS = 'inline-flex h-4 items-center gap-2 text-xs font-medium text-gray-600'
const FIELD_CONTROL_CLASS = 'mt-1 h-[38px] w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500'

async function importGoogleLibrary(library: 'places'): Promise<google.maps.PlacesLibrary>
async function importGoogleLibrary(library: 'geocoding'): Promise<google.maps.GeocodingLibrary>
async function importGoogleLibrary(library: 'places' | 'geocoding') {
  const { setOptions, importLibrary } = await import('@googlemaps/js-api-loader')
  if (!mapsConfigured) {
    setOptions({ key: apiKey, v: 'weekly' })
    mapsConfigured = true
  }
  return importLibrary(library)
}

export function extractSuburb(components: AddressComponent[]): string {
  for (const type of ['sublocality_level_1', 'sublocality', 'locality']) {
    const match = components.find((c) => c.types.includes(type))
    if (match) return match.short_name
  }
  return ''
}

export function addressFromGeocodeResult(result: google.maps.GeocoderResult | null | undefined): GeocodedAddress | null {
  if (!result) return null
  const address = result.formatted_address?.trim()
  if (!address) return null
  return {
    address,
    suburb: extractSuburb(result.address_components ?? []),
  }
}

export function PlacesAutocomplete({
  value,
  onChange,
  label = 'Job Address',
  required = true,
  updateOnInput = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  const lastPlaceValueRef = useRef('')
  const lastManualCommitRef = useRef('')
  useEffect(() => { onChangeRef.current = onChange })

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) inputRef.current.value = value
  }, [value])

  useEffect(() => {
    if (!apiKey || !inputRef.current) return

    let cancelled = false
    let listener: google.maps.MapsEventListener | undefined

    importGoogleLibrary('places').then((placesLib) => {
      if (cancelled || !inputRef.current) return
      const { Autocomplete } = placesLib as google.maps.PlacesLibrary
      const autocomplete = new Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'nz' },
        fields: ['formatted_address', 'address_components'],
      })
      listener = autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        const address = place.formatted_address ?? inputRef.current?.value ?? ''
        const suburb = extractSuburb(place.address_components ?? [])
        lastPlaceValueRef.current = address.trim()
        lastManualCommitRef.current = ''
        onChangeRef.current(address, suburb, 'place')
      })
    })

    return () => {
      cancelled = true
      if (listener) google.maps.event.removeListener(listener)
    }
  }, [])

  function handleManualInput(nextValue: string) {
    if (nextValue.trim() !== lastPlaceValueRef.current) {
      lastPlaceValueRef.current = ''
    }
    if (updateOnInput || !nextValue) {
      onChangeRef.current(nextValue, '', 'input')
    }
  }

  function commitManualInput(nextValue = inputRef.current?.value ?? '') {
    const committedValue = nextValue.trim()
    if (committedValue === lastPlaceValueRef.current || committedValue === lastManualCommitRef.current) return

    lastManualCommitRef.current = committedValue
    void commitGeocodedManualInput(nextValue)
  }

  async function commitGeocodedManualInput(nextValue: string) {
    const fallbackValue = nextValue.trim()
    if (!fallbackValue || !apiKey) {
      onChangeRef.current(nextValue, '', 'manual')
      return
    }

    try {
      const { Geocoder } = await importGoogleLibrary('geocoding')
      const geocoder = new Geocoder()
      const { results } = await geocoder.geocode({
        address: fallbackValue,
        componentRestrictions: { country: 'NZ' },
      })
      const geocoded = addressFromGeocodeResult(results[0])
      if (!geocoded) {
        onChangeRef.current(nextValue, '', 'manual')
        return
      }

      lastManualCommitRef.current = geocoded.address.trim()
      onChangeRef.current(geocoded.address, geocoded.suburb, 'manual')
    } catch {
      onChangeRef.current(nextValue, '', 'manual')
    }
  }

  return (
    <label className="block">
      <span className={FIELD_LABEL_CLASS}>
        {label}
        {required ? <span aria-hidden="true" className="text-red-600">*</span> : null}
      </span>
      <input
        ref={inputRef}
        type="text"
        aria-label={label}
        defaultValue={value}
        required={required}
        onChange={(event) => handleManualInput(event.target.value)}
        onBlur={(event) => commitManualInput(event.target.value)}
        onPaste={() => {
          window.setTimeout(() => commitManualInput(), 0)
        }}
        autoComplete="off"
        className={FIELD_CONTROL_CLASS}
        placeholder="Start typing an address..."
      />
    </label>
  )
}
