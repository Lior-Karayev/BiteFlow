import { useState, useEffect, useCallback } from 'react'
import BusinessTable from './BusinessTable'
import RegisterBusinessForm from './RegisterBusinessForm'
import OnboardingResult from './OnboardingResult'
import DispatchTechnicianForm from './DispatchTechnicianForm'
import Modal from '../../components/Modal'
import { getRestaurants, getAreas, updateRestaurant, getDispatches } from '../../firebase/db'

function DispatchHistoryModal({ business, onClose }) {
  const [dispatches, setDispatches] = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    getDispatches(business.id).then(d => { setDispatches(d); setLoading(false) })
  }, [business.id])

  return (
    <Modal
      title={`Dispatch History — ${business.name}`}
      onClose={onClose}
      footer={<button className="btn btn-primary" onClick={onClose}>Close</button>}
    >
      {loading
        ? <p style={{ color: '#aaa', textAlign: 'center', padding: 20 }}>Loading…</p>
        : dispatches.length === 0
          ? <p style={{ color: '#aaa', textAlign: 'center', padding: 20 }}>No dispatch tickets for this restaurant yet.</p>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dispatches.map(d => (
                <div key={d.id} style={{ padding: '10px 14px', background: '#fafafa', borderRadius: 8, fontSize: '0.88rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontFamily: 'monospace', color: '#e85d04' }}>{d.ticketId}</span>
                    <span style={{ fontSize: '0.75rem', color: '#aaa' }}>
                      {d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString('he-IL') : ''}
                    </span>
                  </div>
                  <div style={{ color: '#555' }}>Technician: <strong>{d.technician}</strong></div>
                  <div style={{ color: '#555' }}>Scheduled: {d.date} at {d.time}</div>
                  {d.notes && <div style={{ color: '#888', marginTop: 4, fontStyle: 'italic' }}>{d.notes}</div>}
                </div>
              ))}
            </div>
          )
      }
    </Modal>
  )
}

function AssignAreaModal({ business, areas, onClose, onSaved }) {
  const [areaId, setAreaId] = useState(business.areaId || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await updateRestaurant(business.id, { areaId: areaId || null })
    onSaved({ ...business, areaId: areaId || null })
    onClose()
  }

  const currentArea = areas.find(a => a.id === (areaId || business.areaId))

  return (
    <Modal
      title={`Assign Area — ${business.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label>Service Area</label>
        <select
          value={areaId}
          onChange={e => setAreaId(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: '0.9rem' }}
        >
          <option value=''>— Unassigned —</option>
          {areas.filter(a => a.active).map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        {areas.length === 0 && (
          <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: 4 }}>
            No active service areas yet. Create one in Ops Manager → Service Areas.
          </div>
        )}
        {currentArea && (
          <div style={{ fontSize: '0.72rem', color: '#888', marginTop: 6, fontFamily: 'monospace' }}>
            N {currentArea.maxLat?.toFixed(4)} · S {currentArea.minLat?.toFixed(4)} · E {currentArea.maxLng?.toFixed(4)} · W {currentArea.minLng?.toFixed(4)}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function AccountManager() {
  const [businesses, setBusinesses]         = useState([])
  const [areas, setAreas]                   = useState([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState('')
  const [showRegister, setShowRegister]     = useState(false)
  const [onboarding, setOnboarding]         = useState(null)
  const [dispatchTarget, setDispatchTarget]         = useState(null)
  const [areaTarget, setAreaTarget]                 = useState(null)
  const [dispatchHistoryTarget, setDispatchHistoryTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [data, areaData] = await Promise.all([getRestaurants(), getAreas()])
      setBusinesses(data)
      setAreas(areaData)
    } catch {
      setError('Failed to load businesses from Firestore.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleRegistered(newBusiness) {
    setShowRegister(false)
    setOnboarding(newBusiness)
    load()
  }

  async function handleToggleActive(business) {
    const newActive = business.active === false ? true : false
    await updateRestaurant(business.id, { active: newActive })
    setBusinesses(prev => prev.map(b => b.id === business.id ? { ...b, active: newActive } : b))
  }

  return (
    <>
      <div className="page">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 2 }}>Registered Businesses</h2>
              {!loading && (
                <span style={{ fontSize: '0.82rem', color: '#999' }}>
                  {businesses.length} {businesses.length === 1 ? 'business' : 'businesses'} in the system
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={load} disabled={loading}>
                {loading ? '…' : '↻ Refresh'}
              </button>
              <button className="btn btn-primary" onClick={() => setShowRegister(true)}>
                + Add New Business
              </button>
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {loading
            ? <p style={{ color: '#aaa', textAlign: 'center', padding: '40px 0' }}>Loading…</p>
            : <BusinessTable
                businesses={businesses}
                areas={areas}
                onResend={setOnboarding}
                onDispatch={setDispatchTarget}
                onAssignArea={setAreaTarget}
                onToggleActive={handleToggleActive}
                onViewDispatches={setDispatchHistoryTarget}
              />
          }
        </div>
      </div>

      {showRegister && (
        <RegisterBusinessForm
          onClose={() => setShowRegister(false)}
          onRegistered={handleRegistered}
        />
      )}

      {onboarding && (
        <OnboardingResult
          business={onboarding}
          onClose={() => setOnboarding(null)}
          onDispatch={(b) => { setOnboarding(null); setDispatchTarget(b) }}
        />
      )}

      {dispatchTarget && (
        <DispatchTechnicianForm
          business={dispatchTarget}
          onClose={() => setDispatchTarget(null)}
        />
      )}

      {dispatchHistoryTarget && (
        <DispatchHistoryModal
          business={dispatchHistoryTarget}
          onClose={() => setDispatchHistoryTarget(null)}
        />
      )}

      {areaTarget && (
        <AssignAreaModal
          business={areaTarget}
          areas={areas}
          onClose={() => setAreaTarget(null)}
          onSaved={updated => {
            setBusinesses(prev => prev.map(b => b.id === updated.id ? updated : b))
            setAreaTarget(null)
          }}
        />
      )}
    </>
  )
}
