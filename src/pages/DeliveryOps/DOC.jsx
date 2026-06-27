import { useState, useEffect, useRef } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { useOpsScheduler } from './OS'
import { addCourier } from '../../firebase/db'
import { seedDeliveryOpsData } from '../../firebase/seed'
import { SHIFT_TYPES, DAYS_OF_WEEK, weekMonday, formatWeekLabel } from '../../constants/shifts'

const API_KEY      = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''
const MAPS_ENABLED = Boolean(API_KEY && API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE')
if (MAPS_ENABLED) setOptions({ apiKey: API_KEY })

const STATUS_BADGE = { PENDING: 'badge-pending', APPROVED: 'badge-active', REJECTED: 'badge-danger' }
function shiftStatus(s) { return (s.status || 'PENDING').toUpperCase() }

function loadColor(ratio) {
  if (ratio > 2.5) return '#dc2626'
  if (ratio > 1.5) return '#f97316'
  if (ratio > 0.8) return '#eab308'
  return '#22c55e'
}

// Color for coverage cells: green = met, yellow = partial, red = none, grey = no requirement
function coverageColor(approved, required) {
  if (required === 0) return { bg: '#f5f5f5', text: '#bbb' }
  if (approved >= required) return { bg: '#dcfce7', text: '#166534' }
  if (approved > 0)         return { bg: '#fef9c3', text: '#854d0e' }
  return                           { bg: '#fee2e2', text: '#991b1b' }
}

function coverageIcon(approved, required) {
  if (required === 0) return '—'
  if (approved >= required) return '✓'
  if (approved > 0)         return '⚠'
  return '✗'
}

// Inline courier picker: shows "Add" button → expands to a <select>
// justAdded: optimistically hides the last-selected courier so it can't be
// picked twice during the window between selection and the Firestore snapshot
// updating the parent's shifts state.
function AddCourierPicker({ couriers, onAdd, acting }) {
  const [open, setOpen]           = useState(false)
  const [justAdded, setJustAdded] = useState(null)

  const available = couriers.filter(c => c.id !== justAdded)

  if (!open || available.length === 0) return (
    <button
      onClick={() => setOpen(true)}
      disabled={!!acting || available.length === 0}
      style={{
        marginTop: 4, width: '100%', fontSize: '0.72rem', color: '#6b7280',
        background: 'none', border: '1px dashed #d1d5db', borderRadius: 8,
        padding: '2px 4px', cursor: 'pointer',
      }}
    >+ Add</button>
  )
  return (
    <select
      autoFocus
      defaultValue=""
      onChange={e => {
        if (e.target.value) {
          setJustAdded(e.target.value)
          onAdd(e.target.value)
          setOpen(false)
        }
      }}
      onBlur={() => setOpen(false)}
      style={{ marginTop: 4, width: '100%', fontSize: '0.78rem', padding: '3px', borderRadius: 4, border: '1px solid #d1d5db' }}
    >
      <option value="" disabled>Pick courier…</option>
      {available.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  )
}

const miniBtn = {
  width: 20, height: 20, border: '1px solid #e5e7eb', borderRadius: 3,
  cursor: 'pointer', background: 'white', fontSize: '0.8rem', lineHeight: 1,
  color: '#6b7280', padding: 0, flexShrink: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}

// ── SUC-6 MSS 1 + MSS 3-5 + Opt (update after publication) ───────
function ScheduleTab() {
  const {
    shifts, couriers, areas, coverage,
    selectedWeek, setSelectedWeek, publication,
    loading, approveShift, autoAssign, setRequirement,
    publishSchedule, manualAssign, removeFromSlot,
  } = useOpsScheduler()

  const [weekOffset, setWeekOffset]             = useState(0)
  const [selectedDay, setSelectedDay]           = useState(DAYS_OF_WEEK[0])
  const [acting, setActing]                     = useState(null)
  const [autoWorking, setAutoWorking]           = useState(false)
  const [autoResult, setAutoResult]             = useState(null)
  const [publishing, setPublishing]             = useState(false)
  const [editAfterPublish, setEditAfterPublish] = useState(false)

  useEffect(() => { setSelectedWeek(weekMonday(weekOffset)) }, [weekOffset, setSelectedWeek])
  useEffect(() => { setEditAfterPublish(false) }, [selectedWeek])

  const courierName = id => couriers.find(c => c.id === id)?.name || id?.slice(0, 8) || '?'

  const weekShifts    = shifts.filter(s => s.weekStart === selectedWeek || (!s.weekStart && weekOffset === 0))
  const pendingInWeek = weekShifts.filter(s => (s.status || '').toUpperCase() === 'PENDING')
  const hasApproved   = weekShifts.some(s => (s.status || '').toUpperCase() === 'APPROVED')

  const isPublished = Boolean(publication)
  const canEdit     = !isPublished || editAfterPublish

  // Couriers currently in a specific day × shiftType × area slot
  function slotCouriers(day, shiftType, areaId) {
    const approved = [], pending = []
    for (const s of weekShifts) {
      if (!s.slots?.some(sl => sl.day === day && sl.shiftType === shiftType && sl.areaId === areaId)) continue
      const status = (s.status || '').toUpperCase()
      if (status === 'APPROVED') approved.push({ shiftId: s.id, courierId: s.courierId })
      else if (status === 'PENDING') pending.push({ shiftId: s.id, courierId: s.courierId })
    }
    return { approved, pending }
  }

  // Couriers not yet in this exact slot, filtered to this area (or unassigned)
  function availableCouriers(day, shiftType, areaId) {
    const { approved, pending } = slotCouriers(day, shiftType, areaId)
    const taken = new Set([...approved, ...pending].map(x => x.courierId))
    return couriers.filter(c => !taken.has(c.id) && (!c.areaId || c.areaId === areaId))
  }

  async function handleAutoAssign() {
    setAutoWorking(true); setAutoResult(null)
    try {
      const n = await autoAssign()
      setAutoResult(n > 0 ? `${n} courier(s) auto-assigned.` : 'No deficit to fill.')
      setTimeout(() => setAutoResult(null), 4000)
    } finally { setAutoWorking(false) }
  }

  async function handlePublish() {
    setPublishing(true)
    try { await publishSchedule() } finally { setPublishing(false) }
  }

  async function handleAdd(courierId, day, shiftType, areaId) {
    setActing(`add-${courierId}-${areaId}`)
    try { await manualAssign(courierId, day, shiftType, areaId) } finally { setActing(null) }
  }

  async function handleApproveSlot(shiftId) {
    setActing(shiftId)
    try { await approveShift(shiftId) } finally { setActing(null) }
  }

  async function handleRemove(shiftId, day, shiftType, areaId) {
    setActing(`rm-${shiftId}`)
    try { await removeFromSlot(shiftId, day, shiftType, areaId) } finally { setActing(null) }
  }

  async function handleRequirement(shiftType, areaId, delta) {
    const cur = coverage[selectedDay]?.[shiftType]?.[areaId]?.required ?? 0
    await setRequirement(selectedDay, shiftType, areaId, Math.max(0, cur + delta))
  }

  return (
    <div>
      {/* Header: week nav + publish controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w - 1)}>‹ Prev</button>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', minWidth: 220, textAlign: 'center' }}>
            {formatWeekLabel(selectedWeek)}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w + 1)}>Next ›</button>
          {weekOffset !== 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(0)}>Today</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {autoResult && <span style={{ fontSize: '0.82rem', color: '#555' }}>{autoResult}</span>}
          {!isPublished && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleAutoAssign}
              disabled={autoWorking || pendingInWeek.length === 0}
            >
              {autoWorking ? 'Assigning…' : 'Auto-Assign'}
            </button>
          )}
          {!isPublished ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={handlePublish}
              disabled={publishing || (!hasApproved && pendingInWeek.length === 0)}
            >
              {publishing
                ? 'Publishing…'
                : `Publish Schedule${pendingInWeek.length > 0 ? ` (${pendingInWeek.length} pending)` : ''}`}
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 20, padding: '4px 12px', fontSize: '0.82rem', fontWeight: 600 }}>
                ✓ Published
              </span>
              {!editAfterPublish ? (
                <button className="btn btn-ghost btn-sm" onClick={() => setEditAfterPublish(true)}>
                  Edit after publication
                </button>
              ) : (
                <span style={{ fontSize: '0.78rem', color: '#d97706', background: '#fef3c7', padding: '4px 10px', borderRadius: 8, fontWeight: 600 }}>
                  Edit mode — couriers notified of changes
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Day tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {DAYS_OF_WEEK.map(day => {
          const hasActivity = weekShifts.some(s => s.slots?.some(sl => sl.day === day))
          return (
            <button
              key={day}
              className={`btn btn-sm ${selectedDay === day ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setSelectedDay(day)}
              style={{ position: 'relative' }}
            >
              {day.slice(0, 3)}
              {hasActivity && selectedDay !== day && (
                <span style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: '50%', background: '#e85d04' }} />
              )}
            </button>
          )
        })}
      </div>

      {loading ? (
        <p style={{ color: '#aaa', textAlign: 'center', padding: 40 }}>Loading…</p>
      ) : areas.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📋</div><p>No service areas configured.</p></div>
      ) : (
        <div className="table-wrap">
          <table style={{ fontSize: '0.83rem' }}>
            <thead>
              <tr>
                <th style={{ minWidth: 110 }}>Area</th>
                {SHIFT_TYPES.map(st => (
                  <th key={st.key} style={{ minWidth: 195, verticalAlign: 'top' }}>
                    {st.label}
                    <div style={{ fontWeight: 400, color: '#aaa', fontSize: '0.72rem' }}>{st.hours}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {areas.map(area => (
                <tr key={area.id}>
                  <td style={{ fontWeight: 600, verticalAlign: 'top', paddingTop: 10 }}>{area.name}</td>
                  {SHIFT_TYPES.map(st => {
                    const slot = coverage[selectedDay]?.[st.key]?.[area.id] || { required: 0, approved: 0, pending: 0 }
                    const { approved: appList, pending: pendList } = slotCouriers(selectedDay, st.key, area.id)
                    const { bg, text } = coverageColor(slot.approved, slot.required)
                    const avail = canEdit ? availableCouriers(selectedDay, st.key, area.id) : []
                    return (
                      <td key={st.key} style={{ verticalAlign: 'top', padding: '8px 10px', background: bg }}>
                        {/* Req badge + demand controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                          <span style={{ flex: 1, fontSize: '0.71rem', fontWeight: 700, color: text }}>
                            {coverageIcon(slot.approved, slot.required)}&nbsp;{slot.approved}/{slot.required} req
                          </span>
                          {canEdit && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <button onClick={() => handleRequirement(st.key, area.id, -1)} style={miniBtn}>−</button>
                              <span style={{ fontSize: '0.7rem', color: '#9ca3af', minWidth: 14, textAlign: 'center' }}>{slot.required}</span>
                              <button onClick={() => handleRequirement(st.key, area.id, 1)} style={miniBtn}>+</button>
                            </div>
                          )}
                        </div>
                        {/* Approved courier chips */}
                        {appList.map(({ shiftId, courierId }) => (
                          <div key={shiftId} style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3 }}>
                            <span style={{ flex: 1, background: '#dcfce7', color: '#166534', borderRadius: 10, padding: '2px 7px', fontSize: '0.77rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              ● {courierName(courierId)}
                            </span>
                            {canEdit && (
                              <button
                                onClick={() => handleRemove(shiftId, selectedDay, st.key, area.id)}
                                disabled={!!acting}
                                title="Remove"
                                style={{ ...miniBtn, color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2' }}
                              >×</button>
                            )}
                          </div>
                        ))}
                        {/* Pending courier chips */}
                        {pendList.map(({ shiftId, courierId }) => (
                          <div key={shiftId} style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3 }}>
                            <span style={{ flex: 1, background: '#fef9c3', color: '#854d0e', borderRadius: 10, padding: '2px 7px', fontSize: '0.77rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              ▷ {courierName(courierId)}
                            </span>
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => handleApproveSlot(shiftId)}
                                  disabled={!!acting}
                                  title="Approve"
                                  style={{ ...miniBtn, color: '#166534', borderColor: '#86efac', background: '#f0fdf4' }}
                                >✓</button>
                                <button
                                  onClick={() => handleRemove(shiftId, selectedDay, st.key, area.id)}
                                  disabled={!!acting}
                                  title="Remove"
                                  style={{ ...miniBtn, color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2' }}
                                >×</button>
                              </>
                            )}
                          </div>
                        ))}
                        {canEdit && avail.length > 0 && (
                          <AddCourierPicker
                            couriers={avail}
                            onAdd={cid => handleAdd(cid, selectedDay, st.key, area.id)}
                            acting={acting}
                          />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── SUC-6 MSS 2 + opt: Heatmap + Zone Rebalancing ────────────────
function HeatmapTab() {
  const { areas, couriers, areaLoad, rebalanceZone, loading } = useOpsScheduler()
  const containerRef  = useRef(null)
  const mapRef        = useRef(null)
  const overlaysRef   = useRef([])
  const [rebalancing, setRebalancing] = useState(null)
  const [rebalanced, setRebalanced]   = useState(null)

  useEffect(() => {
    if (!MAPS_ENABLED) return
    let cancelled = false

    async function drawMap() {
      if (!containerRef.current) return
      const [{ Map, Rectangle }, { AdvancedMarkerElement }] = await Promise.all([
        importLibrary('maps'), importLibrary('marker'),
      ])
      if (cancelled) return

      if (!mapRef.current) {
        mapRef.current = new Map(containerRef.current, {
          center: { lat: 32.0, lng: 34.9 }, zoom: 10,
          mapId: 'bf_delivery_ops', disableDefaultUI: true, zoomControl: true,
        })
      }

      overlaysRef.current.forEach(o => { try { o.setMap ? o.setMap(null) : (o.map = null) } catch {} })
      overlaysRef.current = []

      for (const area of areas) {
        if (area.minLat == null) continue
        const load  = areaLoad[area.id] || {}
        const color = loadColor(load.ratio || 0)
        overlaysRef.current.push(new Rectangle({
          bounds: { north: area.maxLat, south: area.minLat, east: area.maxLng, west: area.minLng },
          map: mapRef.current, fillColor: color, fillOpacity: 0.35,
          strokeColor: color, strokeOpacity: 0.9, strokeWeight: 2, clickable: false,
        }))
      }

      for (const c of couriers) {
        if (c.currentLat == null || c.currentLng == null) continue
        overlaysRef.current.push(new AdvancedMarkerElement({
          map: mapRef.current,
          position: { lat: c.currentLat, lng: c.currentLng },
          title: c.name,
        }))
      }
    }

    drawMap()
    return () => { cancelled = true }
  }, [areas, couriers, areaLoad])

  async function handleRebalance(areaId) {
    setRebalancing(areaId)
    try {
      await rebalanceZone(areaId)
      setRebalanced(areaId)
      setTimeout(() => setRebalanced(null), 3000)
    } finally { setRebalancing(null) }
  }

  const sortedAreas = [...areas].sort((a, b) => (areaLoad[b.id]?.ratio || 0) - (areaLoad[a.id]?.ratio || 0))

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ width: 260, flexShrink: 0 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Live Order Load
        </div>
        {loading ? (
          <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Loading…</p>
        ) : areas.length === 0 ? (
          <p style={{ color: '#aaa', fontSize: '0.85rem' }}>No service areas configured.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedAreas.map(area => {
              const load  = areaLoad[area.id] || {}
              const color = loadColor(load.ratio || 0)
              const overloaded = (load.ratio || 0) > 1.5
              return (
                <div key={area.id} style={{ padding: '10px 12px', background: `${color}18`, borderLeft: `3px solid ${color}`, borderRadius: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 2 }}>{area.name}</div>
                  <div style={{ fontSize: '0.76rem', color: '#777' }}>
                    {load.orders || 0} active orders · {load.couriers || 0} couriers
                  </div>
                  {overloaded && (
                    <button
                      className="btn btn-sm"
                      style={{ marginTop: 6, background: rebalanced === area.id ? '#22c55e' : color, color: 'white', fontSize: '0.74rem', padding: '3px 8px' }}
                      onClick={() => handleRebalance(area.id)}
                      disabled={!!rebalancing}
                    >
                      {rebalancing === area.id ? 'Sending…' : rebalanced === area.id ? 'Sent!' : 'Rebalance Zone'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <div style={{ marginTop: 16, padding: '10px 12px', background: '#f8f8f8', borderRadius: 6, fontSize: '0.76rem', color: '#555' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Load Legend</div>
          {[['#22c55e','Low / Clear'], ['#eab308','Moderate'], ['#f97316','High'], ['#dc2626','Overloaded']].map(([c, l]) => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <div style={{ width: 12, height: 12, background: c, borderRadius: 2, flexShrink: 0 }} />
              {l}
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1 }}>
        {!MAPS_ENABLED ? (
          <div className="empty-state">
            <div className="empty-icon">🗺️</div>
            <p>Google Maps API key not configured.</p>
          </div>
        ) : (
          <div ref={containerRef} style={{ width: '100%', height: 440, borderRadius: 10, border: '1px solid #e0e0e0', overflow: 'hidden' }} />
        )}
      </div>
    </div>
  )
}

// ── Couriers Management ───────────────────────────────────────────
function CouriersTab() {
  // couriers is now reactive (listenToCouriers in OS), no local copy needed
  const { couriers, areas, loading } = useOpsScheduler()
  const [showAdd, setShowAdd]       = useState(false)
  const [form, setForm]             = useState({ name: '', phone: '', areaId: '' })
  const [adding, setAdding]         = useState(false)
  const [seeding, setSeeding]       = useState(false)
  const [seedMsg, setSeedMsg]       = useState(null)

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setAdding(true)
    await addCourier({ name: form.name.trim(), phone: form.phone.trim(), areaId: form.areaId || null })
    // listenToCouriers fires automatically — no manual state update needed
    setForm({ name: '', phone: '', areaId: '' }); setShowAdd(false); setAdding(false)
  }

  async function handleSeed() {
    setSeeding(true); setSeedMsg(null)
    try {
      const r = await seedDeliveryOpsData()
      setSeedMsg(`Created ${r.couriersCreated} couriers + shift submissions for week of ${r.weekStart}.`)
    } catch (err) {
      setSeedMsg(`Error: ${err.message}`)
    } finally { setSeeding(false) }
  }

  const areaName   = id => areas.find(a => a.id === id)?.name
  const statusBadge = c => c.status === 'delivering' ? 'badge-active' : c.status === 'on_shift' ? 'badge-pending' : c.available ? 'badge-pending' : 'badge-danger'
  const statusLabel = c => c.status || (c.available ? 'Available' : 'Off shift')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: '0.9rem', color: '#666' }}>
          {couriers.length} registered · {couriers.filter(c => c.available).length} available
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleSeed}
            disabled={seeding}
            title="Seed 8 demo couriers + shift submissions for next week"
          >
            {seeding ? 'Seeding…' : 'Seed Demo Data'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(s => !s)}>
            {showAdd ? 'Cancel' : '+ Add Courier'}
          </button>
        </div>
      </div>
      {seedMsg && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f0fdf4', borderRadius: 6, fontSize: '0.83rem', color: '#166534', border: '1px solid #bbf7d0' }}>
          {seedMsg}
        </div>
      )}
      {showAdd && (
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, flex: '1 1 150px' }}>
            <label style={{ fontSize: '0.8rem' }}>Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Yossi Ben-David" autoFocus required />
          </div>
          <div className="form-group" style={{ margin: 0, flex: '1 1 130px' }}>
            <label style={{ fontSize: '0.8rem' }}>Phone</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="05X-XXXXXXX" />
          </div>
          <div className="form-group" style={{ margin: 0, flex: '1 1 130px' }}>
            <label style={{ fontSize: '0.8rem' }}>Assigned Area</label>
            <select value={form.areaId} onChange={e => setForm(f => ({ ...f, areaId: e.target.value }))} style={{ height: 34 }}>
              <option value="">Any area</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" type="submit" disabled={adding} style={{ marginBottom: 1 }}>{adding ? 'Adding…' : 'Add'}</button>
        </form>
      )}
      {loading ? (
        <p style={{ color: '#aaa', textAlign: 'center', padding: 40 }}>Loading…</p>
      ) : couriers.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🛵</div><p>No couriers yet. Use "Seed Demo Data" or add one manually.</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Area</th><th>Status</th><th>Load</th></tr></thead>
            <tbody>
              {couriers.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td style={{ color: '#666' }}>{c.phone || '—'}</td>
                  <td style={{ color: '#666' }}>{areaName(c.areaId) || <span style={{ color: '#ccc' }}>Any</span>}</td>
                  <td><span className={`badge ${statusBadge(c)}`}>{statusLabel(c)}</span></td>
                  <td style={{ fontSize: '0.85rem', color: '#666', fontFamily: 'monospace' }}>
                    {c.currentLoad != null ? `${c.currentLoad} / ${c.maxCapacity || '?'}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── DeliveryOpsClient (DOC) — main view ───────────────────────────
export default function DeliveryOpsClient() {
  const { pendingCount } = useOpsScheduler()
  const [tab, setTab]    = useState('schedule')

  const TABS = [
    { key: 'schedule', label: pendingCount > 0 ? `Schedule (${pendingCount})` : 'Schedule' },
    { key: 'heatmap',  label: 'Heatmap' },
    { key: 'couriers', label: 'Couriers' },
  ]

  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.key} className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="card">
        {tab === 'schedule' && <ScheduleTab />}
        {tab === 'heatmap'  && <HeatmapTab />}
        {tab === 'couriers' && <CouriersTab />}
      </div>
    </div>
  )
}
