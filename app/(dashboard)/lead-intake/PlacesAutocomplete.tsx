'use client'

import { useEffect, useRef } from 'react'
import { Loader } from '@googlemaps/js-api-loader'

type AddressComponent = { types: string[]; short_name: string }

type Props = {
  value: string
  onChange: (address: string, suburb: string) => void
}

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY

export function extractSuburb(components: AddressComponent[]): string {
  for (const type of ['locality', 'sublocality_level_1', 'sublocality']) {
    const match = components.find((c) => c.types.includes(type))
    if (match) return match.short_name
  }
  return ''
}

export function PlacesAutocomplete({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  useEffect(() => {
    if (inputRef.current) inputRef.current.value = value
  }, [value])

  useEffect(() => {
    if (!apiKey || !inputRef.current) return

    const loader = new Loader({ apiKey, version: 'weekly', libraries: ['places'] })
    let cleanup: (() => void) | undefined

    loader.load().then(() => {
      if (!inputRef.current) return
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'nz' },
        fields: ['formatted_address', 'address_components'],
      })
      const listener = autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        const address = place.formatted_address ?? inputRef.current?.value ?? ''
        const suburb = extractSuburb(place.address_components ?? [])
        onChangeRef.current(address, suburb)
      })
      cleanup = () => google.maps.event.removeListener(listener)
    })

    return () => cleanup?.()
  }, [])

  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">Location *</span>
      <input
        ref={inputRef}
        type="text"
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Start typing an address..."
      />
    </label>
  )
}
