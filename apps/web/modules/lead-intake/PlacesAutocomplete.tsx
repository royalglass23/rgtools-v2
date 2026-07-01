'use client'

import { useEffect, useRef } from 'react'

type AddressComponent = { types: string[]; short_name: string }

type Props = {
  value: string
  onChange: (address: string, suburb: string) => void
  label?: string
  required?: boolean
  updateOnInput?: boolean
}

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY

let mapsConfigured = false

export function extractSuburb(components: AddressComponent[]): string {
  for (const type of ['locality', 'sublocality_level_1', 'sublocality']) {
    const match = components.find((c) => c.types.includes(type))
    if (match) return match.short_name
  }
  return ''
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
  useEffect(() => { onChangeRef.current = onChange })

  useEffect(() => {
    if (!updateOnInput && inputRef.current) inputRef.current.value = value
  }, [updateOnInput, value])

  useEffect(() => {
    if (!apiKey || !inputRef.current) return

    let cancelled = false
    let listener: google.maps.MapsEventListener | undefined

    import('@googlemaps/js-api-loader').then(({ setOptions, importLibrary }) => {
      if (!mapsConfigured) {
        setOptions({ key: apiKey, v: 'weekly' })
        mapsConfigured = true
      }
      return importLibrary('places')
    }).then((placesLib) => {
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
        onChangeRef.current(address, suburb)
      })
    })

    return () => {
      cancelled = true
      if (listener) google.maps.event.removeListener(listener)
    }
  }, [])

  function handleManualInput(nextValue: string) {
    if (updateOnInput || !nextValue) {
      onChangeRef.current(nextValue, '')
    }
  }

  return (
    <label className="block">
      <span className="flex items-center gap-2 text-xs font-medium text-gray-600">
        {label}
        {required ? <span aria-hidden="true" className="text-red-600">*</span> : null}
      </span>
      <input
        ref={inputRef}
        type="text"
        aria-label={label}
        value={updateOnInput ? value : undefined}
        defaultValue={updateOnInput ? undefined : value}
        required={required}
        onChange={(event) => handleManualInput(event.target.value)}
        autoComplete="off"
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Start typing an address..."
      />
    </label>
  )
}
