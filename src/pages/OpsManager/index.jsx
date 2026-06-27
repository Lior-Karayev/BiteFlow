import { useState, useEffect } from 'react'
import Modal from '../../components/Modal'
import AreaMapPicker from '../../components/AreaMapPicker'
import { getOrders, getRestaurants, getCouriers, getAreas, getShifts, createArea, updateArea, deleteArea } from '../../firebase/db'
import { SHIFT_TYPES, DAYS_OF_WEEK, weekMonday, formatWeekLabel } from '../../constants/shifts'

// ── Service Areas tab ──────────────────────────────────────────
function AreaModal({ area, onClose, onSaved }) {
  const [name, setName]     = useState(area?.name || '')
  const [bounds, setBounds] = useState(
    area ? { minLat: area.minLat, maxLat: area.maxLat, minLng: area.minLng, maxLng: area.maxLng } : null
  )
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSave() {
    if (!name.trim()) return setError('Area name is required.')
    if (!bounds)      return setError('Define the area on the map first.')
    setSaving(true); setError('')
    try {
      if (area) {
        await updateArea(area.id, { name: name.trim(), ...bounds })
        onSaved({ ...area, name: name.trim(), ...bounds })
      } else {
        const created = await createArea({ name: name.trim(), ...bounds })
        onSaved(created)
      }
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={area ? 'Edit Service Area' : 'New Service Area'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !bounds}>
            {saving ? 'Saving…' : area ? 'Save Changes' : 'Create Area'}
          </button>
        </>
      }
    >
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label>Area Name *</label>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Tel Aviv Metro" autoFocus />
      </div>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      <AreaMapPicker initialBounds={bounds} onChange={setBounds} />
    </Modal>
  )
}

function AreasTab() {
  const [areas, setAreas]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState(null)

  useEffect(() => {
    getAreas().then(a => { setAreas(a); setLoading(false) })
  }, [])

  async function handleToggle(area) {
    await updateArea(area.id, { active: !area.active })
    setAreas(prev => prev.map(a => a.id === area.id ? { ...a, active: !a.active } : a))
  }

  async function handleDelete(area) {
    if (!window.confirm(`Delete "${area.name}"? Restaurants assigned to this area will become unassigned.`)) return
    await deleteArea(area.id)
    setAreas(prev => prev.filter(a => a.id !== area.id))
  }

  function handleSaved(saved) {
    setAreas(prev => {
      const idx = prev.findIndex(a => a.id === saved.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n }
      return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New Area</button>
      </div>

      {loading
        ? <p style={{ color: '#aaa', textAlign: 'center', padding: 40 }}>Loading…</p>
        : areas.length === 0
          ? (
            <div className="empty-state">
              <div className="empty-icon">🗺️</div>
              <p>No service areas defined yet.</p>
              <p style={{ fontSize: '0.82rem', color: '#bbb', marginTop: 4 }}>
                Create an area to define where BiteFlow operates. Restaurants and customers will be matched within the same area.
              </p>
            </div>
          )
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {areas.map(area => (
                <div key={area.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{area.name}</span>
                      <span className={`badge ${area.active ? 'badge-active' : 'badge-danger'}`}>
                        {area.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#aaa', fontFamily: 'monospace', marginTop: 4 }}>
                      N {area.maxLat?.toFixed(4)} · S {area.minLat?.toFixed(4)} · E {area.maxLng?.toFixed(4)} · W {area.minLng?.toFixed(4)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditTarget(area)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleToggle(area)}>
                      {area.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => handleDelete(area)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
      }

      {(showCreate || editTarget) && (
        <AreaModal
          area={editTarget}
          onClose={() => { setShowCreate(false); setEditTarget(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

const DATE_FILTERS = [
  { key: 'all', label: 'All Time' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '7d',  label: 'Last 7 Days' },
]

function exportOrdersCSV(orders, restaurants) {
  const restMap = Object.fromEntries(restaurants.map(r => [r.id, r.name]))
  const rows = [
    ['Order ID', 'Date', 'Customer', 'Restaurant', 'Channel', 'Status', 'Total (₪)'],
    ...orders.map(o => [
      o.id,
      o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString('he-IL') : '',
      o.customerName  || '',
      o.restaurantName || restMap[o.restaurantId] || '',
      o.channel || '',
      o.status  || '',
      Number(o.total || 0).toFixed(2),
    ]),
  ]
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `biteflow-orders-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Dashboard tab ──────────────────────────────────────────────
function DashboardTab() {
  const [allOrders, setAllOrders]     = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [couriers, setCouriers]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [dateFilter, setDateFilter]   = useState('all')

  useEffect(() => {
    Promise.all([getOrders(), getRestaurants(), getCouriers()]).then(([o, r, c]) => {
      setAllOrders(o); setRestaurants(r); setCouriers(c); setLoading(false)
    })
  }, [])

  const orders = (() => {
    if (dateFilter === 'all') return allOrders
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - (dateFilter === '7d' ? 7 : 30))
    return allOrders.filter(o => !o.createdAt?.toDate || o.createdAt.toDate() >= cutoff)
  })()

  const total     = orders.length
  const delivered = orders.filter(o => o.status === 'DELIVERED').length
  const cancelled = orders.filter(o => o.status === 'CANCELLED').length
  const revenue   = orders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + (o.total || 0), 0)

  const STATUS_COLOR = {
    PENDING: '#f59e0b', PAID: '#3b82f6', IN_PREP: '#8b5cf6',
    READY: '#10b981', IN_DELIVERY: '#f97316', DELIVERED: '#22c55e', CANCELLED: '#ef4444',
  }
  const statusGroups = ['PENDING','PAID','IN_PREP','READY','IN_DELIVERY','DELIVERED','CANCELLED']
    .map(s => ({ status: s, count: orders.filter(o => o.status === s).length }))
    .filter(g => g.count > 0)
  const maxCount = Math.max(...statusGroups.map(g => g.count), 1)

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {DATE_FILTERS.map(f => (
            <button key={f.key}
              className={`btn btn-sm ${dateFilter === f.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setDateFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <button
          className="btn btn-secondary btn-sm"
          disabled={loading || orders.length === 0}
          onClick={() => exportOrdersCSV(orders, restaurants)}
        >
          ↓ Export CSV
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Total Orders',    value: loading ? '…' : total },
          { label: 'Delivered',       value: loading ? '…' : delivered },
          { label: 'Cancelled',       value: loading ? '…' : cancelled },
          { label: 'Revenue',         value: loading ? '…' : `₪${revenue.toFixed(0)}` },
          { label: 'Restaurants',     value: loading ? '…' : restaurants.length },
          { label: 'Active Couriers', value: loading ? '…' : couriers.filter(c => c.available).length },
          { label: 'Delivery Rate',   value: loading ? '…' : total ? `${((delivered/total)*100).toFixed(0)}%` : '—' },
          { label: 'Cancel Rate',     value: loading ? '…' : total ? `${((cancelled/total)*100).toFixed(0)}%` : '—' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>{kpi.value}</div>
            <div style={{ fontSize: '0.78rem', color: '#999' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1rem', marginBottom: 20 }}>Orders by Status</h3>
        {loading
          ? <p style={{ color: '#aaa', textAlign: 'center', padding: 40 }}>Loading…</p>
          : statusGroups.length === 0
            ? <div className="empty-state"><div className="empty-icon">📊</div><p>No order data yet.</p></div>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {statusGroups.map(g => (
                  <div key={g.status} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 100, fontSize: '0.8rem', color: '#666', textAlign: 'right', flexShrink: 0 }}>{g.status}</div>
                    <div style={{ flex: 1, background: '#f5f5f5', borderRadius: 4, height: 24, overflow: 'hidden' }}>
                      <div style={{ width: `${(g.count / maxCount) * 100}%`, background: STATUS_COLOR[g.status] || '#999', height: '100%', borderRadius: 4, transition: 'width 0.4s ease' }} />
                    </div>
                    <div style={{ width: 28, fontSize: '0.85rem', fontWeight: 600 }}>{g.count}</div>
                  </div>
                ))}
              </div>
            )
        }
      </div>
    </>
  )
}

// ── SUC-6 MSS 1: Staffing summary tab (read-only for Ops Manager) ─
function StaffingTab() {
  const [weekOffset, setWeekOffset] = useState(1) // default: next week
  const [shifts, setShifts]         = useState([])
  const [couriers, setCouriers]     = useState([])
  const [areas, setAreas]           = useState([])
  const [loading, setLoading]       = useState(true)

  const selectedWeek = weekMonday(weekOffset)

  useEffect(() => {
    Promise.all([getShifts(), getCouriers(), getAreas()]).then(([s, c, a]) => {
      setShifts(s); setCouriers(c); setAreas(a); setLoading(false)
    })
  }, [])

  const weekShifts = shifts.filter(s =>
    s.weekStart === selectedWeek || (!s.weekStart && weekOffset === 0)
  )
  const submitted  = weekShifts.length
  const approved   = weekShifts.filter(s => (s.status || '').toUpperCase() === 'APPROVED').length
  const pending    = weekShifts.filter(s => (s.status || '').toUpperCase() === 'PENDING').length
  const areaName   = id => areas.find(a => a.id === id)?.name || id?.slice(0, 6) || '?'

  // Count available slots per shift type across all submissions
  const slotCounts = Object.fromEntries(SHIFT_TYPES.map(st => [
    st.key,
    weekShifts.reduce((n, s) => n + (s.slots?.filter(sl => sl.shiftType === st.key).length || 0), 0),
  ]))

  const STATUS_BADGE = { PENDING: 'badge-pending', APPROVED: 'badge-active', REJECTED: 'badge-danger' }

  return (
    <div>
      {/* Week selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w - 1)}>‹ Prev</button>
        <span style={{ fontWeight: 600, fontSize: '0.9rem', minWidth: 220, textAlign: 'center' }}>
          {formatWeekLabel(selectedWeek)}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w + 1)}>Next ›</button>
        {weekOffset !== 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(0)}>Current</button>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Couriers Submitted', value: loading ? '…' : submitted },
          { label: 'Approved',           value: loading ? '…' : approved  },
          { label: 'Pending Approval',   value: loading ? '…' : pending   },
        ].map(k => (
          <div key={k.label} className="card" style={{ textAlign: 'center', padding: '16px 12px', margin: 0 }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 4 }}>{k.value}</div>
            <div style={{ fontSize: '0.78rem', color: '#999' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Shift type coverage summary */}
      {!loading && submitted > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {SHIFT_TYPES.map(st => (
            <div key={st.key} style={{ flex: 1, background: '#f8f8f8', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{slotCounts[st.key]}</div>
              <div style={{ fontSize: '0.78rem', color: '#666' }}>{st.label} slots</div>
              <div style={{ fontSize: '0.72rem', color: '#aaa' }}>{st.hours}</div>
            </div>
          ))}
        </div>
      )}

      {/* Per-courier breakdown */}
      {loading ? (
        <p style={{ color: '#aaa', textAlign: 'center', padding: 40 }}>Loading…</p>
      ) : couriers.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🛵</div><p>No couriers in the system.</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Courier</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Morning</th>
                <th style={{ textAlign: 'center' }}>Evening</th>
                <th style={{ textAlign: 'center' }}>Night</th>
                <th>Areas</th>
              </tr>
            </thead>
            <tbody>
              {couriers.map(courier => {
                const shift = weekShifts.find(s => s.courierId === courier.id)
                if (!shift) return (
                  <tr key={courier.id} style={{ opacity: 0.45 }}>
                    <td style={{ fontWeight: 600 }}>{courier.name}</td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-danger">Not submitted</span></td>
                    <td colSpan={3} style={{ textAlign: 'center', color: '#ccc' }}>—</td>
                    <td style={{ color: '#ccc' }}>—</td>
                  </tr>
                )
                const slotsByType = Object.fromEntries(
                  SHIFT_TYPES.map(st => [st.key, shift.slots?.filter(sl => sl.shiftType === st.key).length || 0])
                )
                const uniqueAreas = [...new Set(shift.slots?.map(sl => sl.areaId).filter(Boolean) || [])]
                const st = (shift.status || 'PENDING').toUpperCase()
                return (
                  <tr key={courier.id}>
                    <td style={{ fontWeight: 600 }}>{courier.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${STATUS_BADGE[st] || 'badge-pending'}`}>{st}</span>
                    </td>
                    {SHIFT_TYPES.map(({ key }) => (
                      <td key={key} style={{ textAlign: 'center', fontWeight: slotsByType[key] ? 600 : 400, color: slotsByType[key] ? '#166534' : '#ccc' }}>
                        {slotsByType[key] || '—'}
                      </td>
                    ))}
                    <td style={{ fontSize: '0.82rem', color: '#666' }}>
                      {uniqueAreas.map(areaName).join(', ') || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function OpsManager() {
  const [tab, setTab] = useState('dashboard')

  const TABS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'staffing',  label: 'Staffing' },
    { key: 'areas',     label: 'Service Areas' },
  ]

  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.key}
            className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'staffing'  && <StaffingTab />}
      {tab === 'areas'     && <AreasTab />}
    </div>
  )
}
