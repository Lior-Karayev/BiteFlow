import { useState, useEffect } from 'react'
import Modal from '../../components/Modal'
import AddressAutocomplete from '../../components/AddressAutocomplete'
import { registerRestaurant, createOwner, setOwnerRestaurant, getAreas } from '../../firebase/db'

const EMPTY = {
  name: '', ownerName: '', ownerEmail: '', ownerPhone: '', address: '', phone: '',
  lat: null, lng: null, addressVerified: false, areaId: '',
}

export default function RegisterBusinessForm({ onClose, onRegistered }) {
  const [form, setForm]       = useState(EMPTY)
  const [areas, setAreas]     = useState([])
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { getAreas().then(a => setAreas(a.filter(x => x.active))) }, [])

  const set = (field) => (val) => setForm(f => ({ ...f, [field]: val }))

  function handleAddressType(val) {
    // Typing invalidates a previously selected autocomplete result
    setForm(f => ({ ...f, address: val, lat: null, lng: null, addressVerified: false }))
  }

  function handlePlaceSelect({ formattedAddress, lat, lng }) {
    setForm(f => ({ ...f, address: formattedAddress, lat, lng, addressVerified: true }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim())       return setError('Restaurant name is required.')
    if (!form.ownerEmail.trim()) return setError('Owner email is required.')
    if (form.address.trim() && !form.addressVerified) {
      return setError('Please select the address from the autocomplete dropdown to validate the location.')
    }

    setLoading(true)
    try {
      const tempPassword = `BiteFlow@${Math.random().toString(36).slice(2, 6).toUpperCase()}`

      // 1. Create owner doc (ID derived from email)
      const owner = await createOwner({
        email:        form.ownerEmail,
        name:         form.ownerName,
        phone:        form.ownerPhone,
        restaurantId: null,
        tempPassword,
      })

      // 2. Create restaurant referencing owner
      const restaurant = await registerRestaurant({
        name:    form.name,
        address: form.address,
        phone:   form.phone,
        ownerId: owner.id,
        lat:     form.lat,
        lng:     form.lng,
        areaId:  form.areaId || null,
      })

      // 3. Write restaurantId back to owner
      await setOwnerRestaurant(owner.id, restaurant.id)

      onRegistered({
        ...restaurant,
        ownerName:  form.ownerName,
        ownerEmail: form.ownerEmail,
        ownerPhone: form.ownerPhone,
        tempPassword,
      })
    } catch (err) {
      setError(err.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Register New Business"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="submit" form="register-form" disabled={loading}>
            {loading ? 'Registering…' : 'Register & Generate Link'}
          </button>
        </>
      }
    >
      <form id="register-form" onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-row">
          <div className="form-group">
            <label>Restaurant Name *</label>
            <input value={form.name} onChange={e => set('name')(e.target.value)} placeholder="e.g. Sushi Shack" autoFocus />
          </div>
          <div className="form-group">
            <label>Restaurant Phone</label>
            <input value={form.phone} onChange={e => set('phone')(e.target.value)} placeholder="03-XXXXXXX" />
          </div>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Restaurant Address
            {form.addressVerified && (
              <span style={{ fontSize: '0.72rem', background: '#d1fae5', color: '#065f46', padding: '1px 7px', borderRadius: 10, fontWeight: 500 }}>
                ✓ Verified
              </span>
            )}
          </label>
          <AddressAutocomplete
            value={form.address}
            onChange={handleAddressType}
            onPlaceSelect={handlePlaceSelect}
            disabled={loading}
          />
          {form.lat && (
            <div style={{ fontSize: '0.72rem', color: '#888', marginTop: 4 }}>
              {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Service Area</label>
          <select
            value={form.areaId}
            onChange={e => setForm(f => ({ ...f, areaId: e.target.value }))}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: '0.9rem' }}
          >
            <option value=''>— Unassigned —</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {areas.length === 0 && (
            <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: 4 }}>
              No active service areas yet. Create one in Ops Manager → Service Areas.
            </div>
          )}
        </div>

        <hr className="divider" />

        <div className="form-row">
          <div className="form-group">
            <label>Owner Full Name</label>
            <input value={form.ownerName} onChange={e => set('ownerName')(e.target.value)} placeholder="e.g. Yossi Cohen" />
          </div>
          <div className="form-group">
            <label>Owner Phone</label>
            <input value={form.ownerPhone} onChange={e => set('ownerPhone')(e.target.value)} placeholder="05X-XXXXXXX" />
          </div>
        </div>

        <div className="form-group">
          <label>Owner Email *</label>
          <input type="email" value={form.ownerEmail} onChange={e => set('ownerEmail')(e.target.value)} placeholder="owner@restaurant.com" />
        </div>
      </form>
    </Modal>
  )
}
