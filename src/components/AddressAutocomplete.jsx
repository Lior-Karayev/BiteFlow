import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

if (API_KEY && API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
  setOptions({ apiKey: API_KEY })
}

export default function AddressAutocomplete({ value, onChange, onPlaceSelect, disabled }) {
  const inputRef    = useRef(null)
  const acRef       = useRef(null)
  const listenerRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(!API_KEY || API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE')

  useEffect(() => {
    if (error) return
    importLibrary('places')
      .then((places) => {
        if (!inputRef.current) return
        acRef.current = new places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'il' },
          fields: ['formatted_address', 'geometry', 'address_components'],
        })
        listenerRef.current = acRef.current.addListener('place_changed', () => {
          const place = acRef.current.getPlace()
          if (!place.geometry) return
          const cityComp = place.address_components?.find(c =>
            c.types.includes('locality') || c.types.includes('administrative_area_level_2')
          )
          onPlaceSelect({
            formattedAddress: place.formatted_address,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            city: cityComp?.long_name || '',
          })
        })
        setReady(true)
      })
      .catch(() => setError(true))

    return () => listenerRef.current?.remove()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Street, City (autocomplete unavailable)"
          disabled={disabled}
        />
        <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: 4 }}>
          Google Maps API key not configured — free-text only, no coordinate validation.
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={ready ? 'Start typing an address…' : 'Loading autocomplete…'}
        disabled={disabled}
      />
      {ready && (
        <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: 4 }}>
          Select an address from the dropdown to validate location.
        </div>
      )}
    </div>
  )
}
