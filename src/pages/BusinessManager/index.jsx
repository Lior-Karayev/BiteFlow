import { useState, useEffect } from 'react'
import Modal from '../../components/Modal'
import MapPicker from '../../components/MapPicker'
import AddressAutocomplete from '../../components/AddressAutocomplete'
import {
  loginOwner, changeOwnerPassword,
  getRestaurant, updateRestaurant,
  getAllIngredients, createGlobalIngredient, getInventory, addToInventory, updateInventoryStatus, removeFromInventory,
  getMenuItems, addMenuItem, updateMenuItem, deleteMenuItem, getAreas,
} from '../../firebase/db'

const STEP = { LOGIN: 'login', CHANGE_PASS: 'change-password', DASHBOARD: 'dashboard' }

// ── Login ──────────────────────────────────────────────────────
function LoginForm({ onLogin }) {
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await loginOwner(email.trim(), password)
      onLogin(user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <div className="card" style={{ width: 380 }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 6 }}>Business Manager Login</h2>
        <p style={{ fontSize: '0.82rem', color: '#999', marginBottom: 20 }}>
          Use the email and temporary password provided by your account manager.
        </p>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="owner@restaurant.com" autoFocus required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPass(e.target.value)}
              placeholder="BiteFlow@…" required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Change Password ────────────────────────────────────────────
function ChangePasswordForm({ user, onDone }) {
  const [newPass, setNewPass]     = useState('')
  const [confirm, setConfirm]     = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (newPass.length < 8)       return setError('Password must be at least 8 characters.')
    if (newPass !== confirm)       return setError('Passwords do not match.')
    if (newPass === user.password) return setError('New password must be different from the temporary password.')
    setLoading(true)
    try {
      await changeOwnerPassword(user.email, newPass)
      onDone(newPass)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <div className="card" style={{ width: 380 }}>
        <div className="alert" style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', marginBottom: 20, borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem' }}>
          You are using a temporary password. Please set a new password to continue.
        </div>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 20 }}>Set New Password</h2>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label>New Password</label>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
              placeholder="Minimum 8 characters" autoFocus required />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat new password" required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Saving…' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Profile Tab ────────────────────────────────────────────────
function ProfileTab({ restaurant, onSaved }) {
  const [form, setForm]     = useState({
    name:            restaurant.name    || '',
    address:         restaurant.address || '',
    phone:           restaurant.phone   || '',
    lat:             restaurant.lat  ?? null,
    lng:             restaurant.lng  ?? null,
    addressVerified: restaurant.lat != null,
    active:          restaurant.active  !== false,
  })
  const [areaName, setAreaName] = useState('')
  useEffect(() => {
    if (!restaurant.areaId) return
    getAreas().then(areas => {
      const a = areas.find(x => x.id === restaurant.areaId)
      if (a) setAreaName(a.name)
    })
  }, [restaurant.areaId])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  function handleAddressType(val) {
    setForm(f => ({ ...f, address: val, lat: null, lng: null, addressVerified: false }))
  }

  function handlePlaceSelect({ formattedAddress, lat, lng }) {
    setForm(f => ({ ...f, address: formattedAddress, lat, lng, addressVerified: true }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name:    form.name,
      address: form.address,
      phone:   form.phone,
      active:  form.active,
      ...(form.lat != null ? { lat: form.lat, lng: form.lng } : {}),
    }
    await updateRestaurant(restaurant.id, payload)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved(payload)
    setSaving(false)
  }

  return (
    <form onSubmit={handleSave} style={{ maxWidth: 560 }}>
      <div className="form-group">
        <label>Restaurant Name</label>
        <input value={form.name} onChange={set('name')} required />
      </div>
      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Address
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
          disabled={saving}
        />
      </div>
      <div className="form-group">
        <label>Phone</label>
        <input value={form.phone} onChange={set('phone')} placeholder="03-XXXXXXX" />
      </div>

      {(restaurant.areaId || areaName) && (
        <div className="form-group">
          <label>Service Area</label>
          <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 6, fontSize: '0.88rem', color: '#555' }}>
            {areaName || restaurant.areaId}
          </div>
        </div>
      )}

      <MapPicker
        lat={form.lat}
        lng={form.lng}
        onChange={({ lat, lng }) => setForm(f => ({ ...f, lat, lng }))}
      />

      <div className="form-group" style={{ marginTop: 20 }}>
        <label>Restaurant Status</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, active: !f.active }))}
            style={{
              padding: '6px 16px', borderRadius: 20, border: '1px solid',
              borderColor: form.active ? '#16a34a' : '#d1d5db',
              background:  form.active ? '#dcfce7' : '#f3f4f6',
              color:       form.active ? '#15803d' : '#6b7280',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
            }}
          >
            {form.active ? '● Open' : '○ Closed'}
          </button>
          <span style={{ fontSize: '0.78rem', color: '#aaa' }}>
            {form.active ? 'Restaurant is accepting orders.' : 'Restaurant is not accepting orders.'}
          </span>
        </div>
      </div>

      <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginTop: 20 }}>
        {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Profile'}
      </button>
    </form>
  )
}

// ── Ingredient search autocomplete ─────────────────────────────
function IngredientSearch({ globalIngredients, alreadyAdded, onSelect }) {
  const [query, setQuery]   = useState('')
  const [open, setOpen]     = useState(false)
  const [adding, setAdding] = useState(false)

  const lower    = query.trim().toLowerCase()
  const filtered = lower
    ? globalIngredients.filter(g => g.nameLower.includes(lower) && !alreadyAdded.has(g.ingredientId ?? g.id))
    : []
  const exactMatch = globalIngredients.some(g => g.nameLower === lower)
  const showCreate = lower.length > 0 && !exactMatch

  async function pick(ing) {
    setQuery(''); setOpen(false); setAdding(true)
    await onSelect({ ingredientId: ing.id, ingredientName: ing.name, create: false })
    setAdding(false)
  }

  async function createNew() {
    const name = query.trim(); setQuery(''); setOpen(false); setAdding(true)
    await onSelect({ ingredientName: name, create: true })
    setAdding(false)
  }

  const hasDropdown = open && lower && (filtered.length > 0 || showCreate)

  return (
    <div style={{ position: 'relative', maxWidth: 420 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search ingredients to add…"
          disabled={adding}
          style={{ flex: 1 }}
        />
        {adding && <span style={{ alignSelf: 'center', color: '#aaa', fontSize: '0.85rem' }}>Adding…</span>}
      </div>

      {hasDropdown && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'white', border: '1px solid #e0e0e0', borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 50,
          maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.map(ing => (
            <div key={ing.id} onMouseDown={() => pick(ing)} style={{
              padding: '9px 14px', cursor: 'pointer', fontSize: '0.88rem',
              borderBottom: '1px solid #f5f5f5',
              transition: 'background 0.1s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              {ing.name}
            </div>
          ))}
          {showCreate && (
            <div onMouseDown={createNew} style={{
              padding: '9px 14px', cursor: 'pointer', fontSize: '0.88rem',
              color: '#e85d04', fontWeight: 500,
              borderTop: filtered.length ? '1px solid #f0f0f0' : 'none',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#fff4ee'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              ➕ Create new ingredient: "{query.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Inventory Tab ──────────────────────────────────────────────
function InventoryTab({ restaurantId }) {
  const [inventory, setInventory]           = useState([])
  const [globalIngredients, setGlobal]      = useState([])
  const [loading, setLoading]               = useState(true)

  useEffect(() => {
    Promise.all([getInventory(restaurantId), getAllIngredients()]).then(([inv, global]) => {
      setInventory(inv); setGlobal(global); setLoading(false)
    })
  }, [restaurantId])

  async function handleSelect({ ingredientId, ingredientName, create }) {
    let gid = ingredientId
    let gname = ingredientName
    if (create) {
      const created = await createGlobalIngredient(ingredientName)
      gid = created.id; gname = created.name
      setGlobal(prev => prev.some(g => g.id === gid) ? prev : [...prev, created])
    }
    const item = await addToInventory(restaurantId, gid, gname)
    setInventory(prev => [...prev, item])
  }

  async function toggleStatus(item) {
    await updateInventoryStatus(item.id, !item.available)
    setInventory(prev => prev.map(i => i.id === item.id ? { ...i, available: !i.available } : i))
  }

  async function handleRemove(item) {
    await removeFromInventory(item.id)
    setInventory(prev => prev.filter(i => i.id !== item.id))
  }

  const alreadyAdded = new Set(inventory.map(i => i.ingredientId))

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <IngredientSearch
          globalIngredients={globalIngredients}
          alreadyAdded={alreadyAdded}
          onSelect={handleSelect}
        />
      </div>

      {loading
        ? <p style={{ color: '#aaa', padding: '20px 0' }}>Loading…</p>
        : inventory.length === 0
          ? <div className="empty-state"><div className="empty-icon">🥦</div><p>No ingredients yet. Search above to add your first one.</p></div>
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Ingredient</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {inventory.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{item.ingredientName}</td>
                      <td>
                        <span className={`badge ${item.available ? 'badge-active' : 'badge-danger'}`}>
                          {item.available ? 'Available' : 'Unavailable'}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(item)}>
                          {item.available ? 'Mark Unavailable' : 'Mark Available'}
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }}
                          onClick={() => handleRemove(item)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      }
    </div>
  )
}

// ── Menu Tab ───────────────────────────────────────────────────
const EMPTY_DISH = { name: '', price: '', description: '' }

// Cycles through: none → required → optional → none
const ING_STATE = { NONE: 'none', REQUIRED: 'required', OPTIONAL: 'optional' }
const ING_STYLE = {
  none:     { border: '#e0e0e0', bg: '#fafafa', color: '#666',    label: '' },
  required: { border: '#e85d04', bg: '#fff4ee', color: '#c2410c', label: '★ ' },
  optional: { border: '#fb923c', bg: '#fff8f0', color: '#ea580c', label: '○ ' },
}

function MenuTab({ restaurantId }) {
  const [menu, setMenu]               = useState([])
  const [ingredients, setIngredients] = useState([])
  const [globalIngs, setGlobalIngs]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [editTarget, setEditTarget]   = useState(null)
  const [dish, setDish]               = useState(EMPTY_DISH)
  const [requiredIngIds, setRequiredIngIds] = useState([])
  const [optionalIngIds, setOptionalIngIds] = useState([])
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    Promise.all([getMenuItems(restaurantId), getInventory(restaurantId), getAllIngredients()]).then(([m, inv, global]) => {
      setMenu(m); setIngredients(inv); setGlobalIngs(global); setLoading(false)
    })
  }, [restaurantId])

  function openAdd() {
    setDish(EMPTY_DISH); setRequiredIngIds([]); setOptionalIngIds([]); setEditTarget({})
  }

  function openEdit(item) {
    setDish({ name: item.name, price: String(item.price), description: item.description || '' })
    const reqIds = item.requiredIngredientIds || []
    const optIds = item.optionalIngredientIds ||
      (item.ingredientIds || []).filter(id => !reqIds.includes(id))
    setRequiredIngIds(reqIds)
    setOptionalIngIds(optIds)
    setEditTarget(item)
  }

  function closeModal() {
    setEditTarget(null); setDish(EMPTY_DISH); setRequiredIngIds([]); setOptionalIngIds([])
  }

  function getIngState(id) {
    if (requiredIngIds.includes(id)) return ING_STATE.REQUIRED
    if (optionalIngIds.includes(id)) return ING_STATE.OPTIONAL
    return ING_STATE.NONE
  }

  function cycleIng(id) {
    const state = getIngState(id)
    if (state === ING_STATE.NONE) {
      setRequiredIngIds(prev => [...prev, id])
    } else if (state === ING_STATE.REQUIRED) {
      setRequiredIngIds(prev => prev.filter(x => x !== id))
      setOptionalIngIds(prev => [...prev, id])
    } else {
      setOptionalIngIds(prev => prev.filter(x => x !== id))
    }
  }

  async function handleSaveDish(e) {
    e.preventDefault()
    if (!dish.name || !dish.price) return
    setSaving(true)
    const payload = {
      name:                  dish.name.trim(),
      price:                 parseFloat(dish.price),
      description:           dish.description.trim(),
      ingredientIds:         [...requiredIngIds, ...optionalIngIds],
      requiredIngredientIds: requiredIngIds,
      optionalIngredientIds: optionalIngIds,
    }
    if (editTarget.id) {
      await updateMenuItem(editTarget.id, payload)
      setMenu(prev => prev.map(m => m.id === editTarget.id ? { ...m, ...payload } : m))
    } else {
      const item = await addMenuItem({ restaurantId, ...payload })
      setMenu(prev => [...prev, item])
    }
    closeModal()
    setSaving(false)
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    await deleteMenuItem(item.id)
    setMenu(prev => prev.filter(m => m.id !== item.id))
  }

  const invNameMap    = Object.fromEntries(ingredients.map(i => [i.ingredientId, i.ingredientName]))
  const globalNameMap = Object.fromEntries(globalIngs.map(g => [g.id, g.name]))
  const ingName = id => invNameMap[id] || globalNameMap[id] || id
  const isEditing = editTarget && editTarget.id

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Dish</button>
      </div>

      {loading
        ? <p style={{ color: '#aaa' }}>Loading…</p>
        : menu.length === 0
          ? <div className="empty-state"><div className="empty-icon">🍽️</div><p>No dishes yet.</p></div>
          : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Dish</th><th>Price</th><th>Ingredients</th><th>Actions</th></tr></thead>
                <tbody>
                  {menu.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        {item.description && <div style={{ fontSize: '0.78rem', color: '#999' }}>{item.description}</div>}
                      </td>
                      <td>₪{Number(item.price).toFixed(2)}</td>
                      <td style={{ fontSize: '0.82rem', color: '#666' }}>
                        {(item.ingredientIds || []).length === 0
                          ? <span style={{ color: '#ccc' }}>—</span>
                          : (item.ingredientIds || []).map(id => {
                              const isReq = (item.requiredIngredientIds || []).includes(id)
                              return (
                                <span key={id} style={{ marginRight: 6 }}>
                                  {isReq && <span style={{ color: '#e85d04', fontSize: '0.72rem' }}>★</span>}
                                  {ingName(id)}
                                </span>
                              )
                            })
                        }
                      </td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>Edit</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }}
                          onClick={() => handleDelete(item)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      }

      {editTarget !== null && (
        <Modal
          title={isEditing ? `Edit — ${editTarget.name}` : 'Add Dish'}
          onClose={closeModal}
          footer={
            <>
              <button className="btn btn-secondary" type="button" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" type="submit" form="dish-form" disabled={saving}>
                {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Dish'}
              </button>
            </>
          }
        >
          <form id="dish-form" onSubmit={handleSaveDish}>
            <div className="form-row">
              <div className="form-group">
                <label>Dish Name *</label>
                <input value={dish.name} onChange={e => setDish(d => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Margherita Pizza" autoFocus required />
              </div>
              <div className="form-group">
                <label>Price (₪) *</label>
                <input type="number" step="0.01" min="0" value={dish.price}
                  onChange={e => setDish(d => ({ ...d, price: e.target.value }))}
                  placeholder="49.90" required />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <input value={dish.description} onChange={e => setDish(d => ({ ...d, description: e.target.value }))}
                placeholder="Short description (optional)" />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Ingredients
                <span style={{ fontSize: '0.72rem', color: '#aaa', fontWeight: 400 }}>
                  click to cycle: none → <span style={{ color: '#c2410c' }}>★ required</span> → <span style={{ color: '#ea580c' }}>○ optional</span>
                </span>
              </label>
              {ingredients.length === 0
                ? <p style={{ fontSize: '0.82rem', color: '#aaa' }}>No ingredients in inventory yet. Add them in the Inventory tab first.</p>
                : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {ingredients.map(inv => {
                      const state = getIngState(inv.ingredientId)
                      const s = ING_STYLE[state]
                      return (
                        <button
                          key={inv.id}
                          type="button"
                          onClick={() => cycleIng(inv.ingredientId)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '5px 12px', borderRadius: 20,
                            border: `1px solid ${s.border}`,
                            background: s.bg, color: s.color,
                            cursor: 'pointer', fontSize: '0.85rem',
                            transition: 'all 0.15s', fontWeight: state !== 'none' ? 600 : 400,
                          }}
                        >
                          {s.label}{inv.ingredientName}
                          {!inv.available && <span style={{ color: '#bbb', fontSize: '0.72rem', fontWeight: 400 }}> (unavail.)</span>}
                        </button>
                      )
                    })}
                  </div>
                )
              }
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function BusinessManager() {
  const [step, setStep]             = useState(STEP.LOGIN)
  const [user, setUser]             = useState(null)
  const [restaurant, setRestaurant] = useState(null)
  const [tab, setTab]               = useState('profile')
  const [loadingRest, setLoadingRest] = useState(false)

  async function handleLogin(loggedInUser) {
    setUser(loggedInUser)
    if (loggedInUser.mustChangePassword) {
      setStep(STEP.CHANGE_PASS)
    } else {
      await loadRestaurant(loggedInUser.restaurantId)
      setStep(STEP.DASHBOARD)
    }
  }

  async function handlePasswordChanged(newPass) {
    setUser(u => ({ ...u, password: newPass, mustChangePassword: false }))
    await loadRestaurant(user.restaurantId)
    setStep(STEP.DASHBOARD)
  }

  async function loadRestaurant(id) {
    setLoadingRest(true)
    try {
      const r = await getRestaurant(id)
      setRestaurant(r)
    } finally {
      setLoadingRest(false)
    }
  }

  function handleSignOut() {
    setUser(null); setRestaurant(null); setStep(STEP.LOGIN); setTab('profile')
  }

  if (step === STEP.LOGIN)       return <LoginForm onLogin={handleLogin} />
  if (step === STEP.CHANGE_PASS) return <ChangePasswordForm user={user} onDone={handlePasswordChanged} />

  if (loadingRest) {
    return <div className="page" style={{ textAlign: 'center', paddingTop: 80, color: '#aaa' }}>Loading restaurant…</div>
  }

  const TABS = [
    { key: 'profile',   label: 'Profile' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'menu',      label: 'Menu' },
  ]

  return (
    <div className="page">
      <div className="card">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 2 }}>{restaurant?.name}</h2>
            <span style={{ fontSize: '0.8rem', color: '#999' }}>{user?.email}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>Sign Out</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #f0f0f0', marginBottom: 24, paddingBottom: 12 }}>
          {TABS.map(t => (
            <button key={t.key}
              className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'profile'   && <ProfileTab   restaurant={restaurant} onSaved={updates => setRestaurant(r => ({ ...r, ...updates }))} />}
        {tab === 'inventory' && <InventoryTab restaurantId={restaurant?.id} />}
        {tab === 'menu'      && <MenuTab      restaurantId={restaurant?.id} />}
      </div>
    </div>
  )
}
