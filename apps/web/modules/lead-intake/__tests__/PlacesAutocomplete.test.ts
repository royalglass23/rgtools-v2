import { addressFromGeocodeResult, extractSuburb } from '../PlacesAutocomplete'

type Component = { types: string[]; short_name: string }

it('extracts locality from address components', () => {
  const components: Component[] = [
    { types: ['street_number'], short_name: '10' },
    { types: ['route'], short_name: 'Queen St' },
    { types: ['locality', 'political'], short_name: 'Auckland' },
    { types: ['country', 'political'], short_name: 'NZ' },
  ]
  expect(extractSuburb(components)).toBe('Auckland')
})

it('prefers a specific suburb over the broader locality', () => {
  const components: Component[] = [
    { types: ['locality', 'political'], short_name: 'Auckland' },
    { types: ['sublocality_level_1', 'political'], short_name: 'Parnell' },
  ]
  expect(extractSuburb(components)).toBe('Parnell')
})

it('falls back to sublocality_level_1 when no locality', () => {
  const components: Component[] = [
    { types: ['sublocality_level_1', 'political'], short_name: 'Parnell' },
    { types: ['country', 'political'], short_name: 'NZ' },
  ]
  expect(extractSuburb(components)).toBe('Parnell')
})

it('falls back to sublocality when no locality or sublocality_level_1', () => {
  const components: Component[] = [
    { types: ['sublocality'], short_name: 'Grey Lynn' },
  ]
  expect(extractSuburb(components)).toBe('Grey Lynn')
})

it('returns empty string when no suburb-like component found', () => {
  const components: Component[] = [
    { types: ['country', 'political'], short_name: 'NZ' },
  ]
  expect(extractSuburb(components)).toBe('')
})

it('returns empty string for empty array', () => {
  expect(extractSuburb([])).toBe('')
})

it('shapes geocoded full addresses with suburb data', () => {
  const result = {
    formatted_address: '22 Queen Street, Auckland CBD, Auckland 1010, New Zealand',
    address_components: [
      { types: ['locality', 'political'], short_name: 'Auckland' },
      { types: ['sublocality_level_1', 'political'], short_name: 'Auckland CBD' },
    ],
  } as google.maps.GeocoderResult

  expect(addressFromGeocodeResult(result)).toEqual({
    address: '22 Queen Street, Auckland CBD, Auckland 1010, New Zealand',
    suburb: 'Auckland CBD',
  })
})
