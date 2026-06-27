import { useEffect, useRef } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''
const ENABLED  = Boolean(API_KEY && API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE')
if (ENABLED) setOptions({ apiKey: API_KEY })

const DEFAULT_CENTER = { lat: 32.0853, lng: 34.7818 } // Tel Aviv

export default function MapPicker({ lat, lng, onChange }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const markerRef    = useRef(null)

  useEffect(() => {
    if (!ENABLED) return

    const hasCoords = lat != null && lng != null
    const center    = hasCoords ? { lat, lng } : DEFAULT_CENTER

    Promise.all([importLibrary('maps'), importLibrary('marker')])
      .then(([{ Map }, { AdvancedMarkerElement }]) => {
        if (!containerRef.current) return

        mapRef.current = new Map(containerRef.current, {
          center,
          zoom:             hasCoords ? 16 : 12,
          mapId:            'bf_location_picker',
          disableDefaultUI: true,
          zoomControl:      true,
          clickableIcons:   false,
        })

        markerRef.current = new AdvancedMarkerElement({
          map:          mapRef.current,
          position:     center,
          gmpDraggable: true,
          title:        'Drag to set exact location',
        })

        markerRef.current.addListener('dragend', (e) => {
          onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() })
        })
      })

    return () => {
      if (markerRef.current) markerRef.current.map = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync pin when parent pushes new coords (e.g. address autocomplete)
  useEffect(() => {
    if (!markerRef.current || lat == null || lng == null) return
    const pos = { lat, lng }
    markerRef.current.position = pos
    mapRef.current?.panTo(pos)
    if ((mapRef.current?.getZoom() ?? 0) < 15) mapRef.current.setZoom(15)
  }, [lat, lng])

  if (!ENABLED) return null

  return (
    <div style={{ marginTop: 16 }}>
      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#444', display: 'block', marginBottom: 6 }}>
        Exact Location{' '}
        <span style={{ fontWeight: 400, color: '#aaa' }}>— drag the pin to fine-tune</span>
        {lat != null && (
          <span style={{ fontWeight: 400, color: '#10b981', marginLeft: 8, fontSize: '0.72rem' }}>
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        )}
      </label>
      <div
        ref={containerRef}
        style={{ width: '100%', height: 280, borderRadius: 10, border: '1px solid #e0e0e0', overflow: 'hidden' }}
      />
    </div>
  )
}
