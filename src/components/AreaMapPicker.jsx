import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''
const ENABLED  = Boolean(API_KEY && API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE')
if (ENABLED) setOptions({ apiKey: API_KEY })

const RECT_STYLE = {
  fillColor: '#e85d04', fillOpacity: 0.15,
  strokeColor: '#e85d04', strokeWeight: 2,
  editable: true, draggable: true,
}

export const CITY_PRESETS = [
  { name: 'Tel Aviv Metro',  minLat: 31.97, maxLat: 32.14, minLng: 34.73, maxLng: 34.90 },
  { name: 'Jerusalem',       minLat: 31.72, maxLat: 31.85, minLng: 35.14, maxLng: 35.27 },
  { name: 'Haifa',           minLat: 32.74, maxLat: 32.84, minLng: 34.95, maxLng: 35.08 },
  { name: "Be'er Sheva",    minLat: 31.21, maxLat: 31.29, minLng: 34.76, maxLng: 34.84 },
  { name: 'Netanya',         minLat: 32.29, maxLat: 32.36, minLng: 34.84, maxLng: 34.92 },
  { name: 'Rishon LeZion',   minLat: 31.96, maxLat: 32.02, minLng: 34.77, maxLng: 34.86 },
  { name: 'Petah Tikva',     minLat: 32.07, maxLat: 32.12, minLng: 34.86, maxLng: 34.92 },
  { name: 'Ashdod',          minLat: 31.79, maxLat: 31.84, minLng: 34.63, maxLng: 34.68 },
]

export default function AreaMapPicker({ initialBounds, onChange }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const libRef       = useRef(null)   // { Map, Rectangle, LatLngBounds, DrawingManager }
  const rectRef      = useRef(null)
  const listenerRef  = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [bounds, setBounds]   = useState(initialBounds || null)

  function boundsFromRect(rect) {
    const b  = rect.getBounds()
    const ne = b.getNorthEast()
    const sw = b.getSouthWest()
    return { minLat: sw.lat(), maxLat: ne.lat(), minLng: sw.lng(), maxLng: ne.lng() }
  }

  function attachRect(rect) {
    if (listenerRef.current) listenerRef.current.remove()
    rectRef.current = rect
    listenerRef.current = rect.addListener('bounds_changed', () => {
      const b = boundsFromRect(rect)
      setBounds(b)
      onChange(b)
    })
  }

  function placeRect(boundsObj) {
    const { LatLngBounds, Rectangle } = libRef.current
    const llb = new LatLngBounds(
      { lat: boundsObj.minLat, lng: boundsObj.minLng },
      { lat: boundsObj.maxLat, lng: boundsObj.maxLng },
    )
    if (rectRef.current) {
      rectRef.current.setBounds(llb)
    } else {
      const rect = new Rectangle({ bounds: llb, map: mapRef.current, ...RECT_STYLE })
      attachRect(rect)
    }
    mapRef.current.fitBounds(llb, 40)
    setBounds(boundsObj)
    onChange(boundsObj)
  }

  useEffect(() => {
    if (!ENABLED) return
    Promise.all([
      importLibrary('maps'),
      importLibrary('drawing'),
      importLibrary('core'),
    ]).then(([mapsLib, drawingLib, coreLib]) => {
      libRef.current = {
        Map:            mapsLib.Map,
        Rectangle:      mapsLib.Rectangle,
        LatLngBounds:   coreLib.LatLngBounds,
        DrawingManager: drawingLib.DrawingManager,
      }

      const map = new mapsLib.Map(containerRef.current, {
        center:           { lat: 31.7, lng: 35.0 },
        zoom:             7,
        mapId:            'bf_area_picker',
        disableDefaultUI: true,
        zoomControl:      true,
        clickableIcons:   false,
      })
      mapRef.current = map

      const dm = new drawingLib.DrawingManager({
        drawingControl: false,
        rectangleOptions: RECT_STYLE,
      })
      dm.setMap(map)

      dm.addListener('rectanglecomplete', rect => {
        if (rectRef.current) rectRef.current.setMap(null)
        rect.setOptions(RECT_STYLE)
        dm.setDrawingMode(null)
        setDrawing(false)
        attachRect(rect)
        const b = boundsFromRect(rect)
        setBounds(b)
        onChange(b)
      })

      // Draw initial bounds if editing an existing area
      if (initialBounds) placeRect(initialBounds)
    })

    return () => {
      listenerRef.current?.remove()
      if (rectRef.current) rectRef.current.setMap(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePreset(preset) {
    if (!libRef.current) return
    placeRect(preset)
  }

  function handleDraw() {
    if (!libRef.current) return
    if (rectRef.current) { rectRef.current.setMap(null); rectRef.current = null }
    setBounds(null); onChange(null)
    // Access DrawingManager via the map's overlays — re-create it
    const { DrawingManager } = libRef.current
    const dm = new DrawingManager({ drawingControl: false, rectangleOptions: RECT_STYLE })
    dm.setMap(mapRef.current)
    dm.setDrawingMode('rectangle')
    setDrawing(true)
    dm.addListener('rectanglecomplete', rect => {
      if (rectRef.current) rectRef.current.setMap(null)
      rect.setOptions(RECT_STYLE)
      dm.setDrawingMode(null)
      dm.setMap(null)
      setDrawing(false)
      attachRect(rect)
      const b = boundsFromRect(rect)
      setBounds(b); onChange(b)
    })
  }

  if (!ENABLED) return (
    <div className="alert" style={{ color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: 12, fontSize: '0.85rem' }}>
      Google Maps API key not configured — map picker unavailable.
    </div>
  )

  return (
    <div>
      {/* Quick-pick cities */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {CITY_PRESETS.map(p => (
          <button key={p.name} type="button" onClick={() => handlePreset(p)}
            className="btn btn-ghost btn-sm" style={{ fontSize: '0.78rem' }}>
            {p.name}
          </button>
        ))}
        <button type="button" onClick={handleDraw}
          className={`btn btn-sm ${drawing ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.78rem' }}>
          {drawing ? '✏️ Click & drag on map…' : '✏️ Draw Custom'}
        </button>
      </div>

      <div ref={containerRef}
        style={{ width: '100%', height: 380, borderRadius: 10, border: '1px solid #e0e0e0', overflow: 'hidden',
          cursor: drawing ? 'crosshair' : 'default' }} />

      {bounds
        ? (
          <div style={{ fontSize: '0.72rem', color: '#888', marginTop: 6, fontFamily: 'monospace' }}>
            N {bounds.maxLat.toFixed(4)} &nbsp;S {bounds.minLat.toFixed(4)} &nbsp;
            E {bounds.maxLng.toFixed(4)} &nbsp;W {bounds.minLng.toFixed(4)}
          </div>
        )
        : (
          <div style={{ fontSize: '0.78rem', color: '#aaa', marginTop: 6 }}>
            Pick a city shortcut above, or click "Draw Custom" then drag a rectangle on the map.
          </div>
        )
      }
    </div>
  )
}
