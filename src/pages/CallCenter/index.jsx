import { useState, useEffect, useRef } from 'react'
import AddressAutocomplete from '../../components/AddressAutocomplete'
import {
  registerOperator, listenToIncomingCalls, listenToCall, answerCall, endCall,
  getCustomers, addCustomer, getRestaurants, getMenuItems, getInventory, addOrder, getAreas,
  getOrdersByCustomer,
} from '../../firebase/db'

const LS_KEY      = 'biteflow_operator'
const LS_CALL_KEY = 'biteflow_active_call'

const STATUS_COLORS = {
  PENDING: '#f59e0b', PAID: '#3b82f6', IN_PREP: '#8b5cf6',
  READY: '#10b981', IN_DELIVERY: '#f97316', DELIVERED: '#22c55e', CANCELLED: '#ef4444',
}

function findArea(areas, lat, lng) {
  if (lat == null || lng == null) return null
  return areas.find(a =>
    a.active &&
    lat >= a.minLat && lat <= a.maxLat &&
    lng >= a.minLng && lng <= a.maxLng
  ) || null
}



// ── Operator Registration ──────────────────────────────────────
function OperatorRegistration({ onRegistered }) {
  const [form, setForm]       = useState({ name: '', email: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Name is required.')
    setLoading(true)
    try {
      const op = await registerOperator({ name: form.name, email: form.email })
      localStorage.setItem(LS_KEY, JSON.stringify(op))
      onRegistered(op)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <div className="card" style={{ width: 360 }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: 6 }}>Call Center — Register as Operator</h2>
        <p style={{ fontSize: '0.82rem', color: '#999', marginBottom: 20 }}>
          Your name will be shown to the customer when you answer their call.
        </p>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label>Full Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Shira Cohen" autoFocus required />
          </div>
          <div className="form-group">
            <label>Email (optional)</label>
            <input type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="operator@biteflow.app" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Registering…' : 'Start My Shift'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Ringing Banner ─────────────────────────────────────────────
function RingingBanner({ call, onAnswer, onDismiss, claiming }) {
  return (
    <div style={{
      position: 'fixed', top: 62, left: '50%', transform: 'translateX(-50%)',
      background: '#1c1c1e', color: 'white', borderRadius: 16,
      padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16,
      boxShadow: '0 8px 40px rgba(0,0,0,0.35)', zIndex: 100,
      animation: 'slideDown 0.25s ease', minWidth: 320,
    }}>
      <div style={{ fontSize: '1.6rem', animation: 'ring 0.6s ease infinite alternate' }}>📞</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.72rem', color: '#aaa', marginBottom: 2 }}>Incoming Call</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '0.04em' }}>{call.phone}</div>
      </div>
      <button onClick={() => onAnswer(call)} disabled={claiming} style={{
        background: '#34c759', color: 'white', border: 'none', borderRadius: 20,
        padding: '8px 18px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
      }}>
        {claiming ? '…' : 'Answer'}
      </button>
      <button onClick={onDismiss} style={{
        background: '#ff3b30', color: 'white', border: 'none', borderRadius: 20,
        padding: '8px 14px', cursor: 'pointer', fontSize: '0.85rem',
      }}>
        Decline
      </button>
      <style>{`
        @keyframes slideDown {
          from { opacity:0; transform:translateX(-50%) translateY(-12px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0); }
        }
        @keyframes ring {
          from { transform: rotate(-15deg); }
          to   { transform: rotate(15deg); }
        }
      `}</style>
    </div>
  )
}

// ── Menu Panel (right side when restaurant is selected) ────────
function MenuPanel({ restaurant, onBack, customer, deliveryAddress, onOrderPlaced }) {
  const [menu, setMenu]           = useState([])
  const [inventory, setInventory] = useState([])
  const [loading, setLoading]     = useState(true)
  const [cart, setCart]           = useState([])
  const [placing, setPlacing]     = useState(false)
  const [success, setSuccess]     = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([getMenuItems(restaurant.id), getInventory(restaurant.id)])
      .then(([m, inv]) => { setMenu(m); setInventory(inv); setLoading(false) })
  }, [restaurant.id])

  // ingredientId → { ingredientName, available }
  const inventoryMap = Object.fromEntries(inventory.map(i => [i.ingredientId, i]))

  function getDishIngredients(dish) {
    const requiredIds = dish.requiredIngredientIds || []
    return (dish.ingredientIds || []).map(id => ({
      id,
      name:      inventoryMap[id]?.ingredientName || 'Unknown',
      available: inventoryMap[id]?.available ?? true,
      required:  requiredIds.includes(id),
    }))
  }

  function addToCart(dish) {
    const ings    = getDishIngredients(dish)
    const missing = ings.filter(i => !i.available).map(i => i.name)
    setCart(prev => [...prev, { dish, missing }])
  }

  function removeFromCart(idx) {
    setCart(prev => prev.filter((_, i) => i !== idx))
  }

  async function placeOrder() {
    if (!cart.length) return
    setPlacing(true)
    const total = cart.reduce((s, { dish }) => s + Number(dish.price), 0)
    const order = await addOrder({
      customerId:      customer?.id   || null,
      customerName:    customer?.name || 'Guest',
      restaurantId:    restaurant.id,
      restaurantName:  restaurant.name,
      deliveryAddress: deliveryAddress || '',
      channel:         'PHONE',
      status:          'PENDING',
      total,
      items: cart.map(({ dish, missing }) => ({
        dishId:             dish.id,
        dishName:           dish.name,
        price:              dish.price,
        missingIngredients: missing,
      })),
    })
    setSuccess(`Order #${order.id.slice(0, 8)} placed`)
    onOrderPlaced(order, customer?.name || 'Guest', restaurant.name)
    setCart([])
    setPlacing(false)
    setTimeout(() => setSuccess(''), 3000)
  }

  const cartTotal = cart.reduce((s, { dish }) => s + Number(dish.price), 0)

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ padding: '4px 10px' }}>← Back</button>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{restaurant.name}</div>
          {restaurant.address && <div style={{ fontSize: '0.75rem', color: '#999' }}>{restaurant.address}</div>}
        </div>
      </div>

      {loading
        ? <p style={{ color: '#aaa', padding: '20px 0' }}>Loading menu…</p>
        : menu.length === 0
          ? <div className="empty-state"><div className="empty-icon">🍽️</div><p>No dishes on the menu yet.</p></div>
          : (
            <>
              {/* Dish grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10, marginBottom: 20 }}>
                {menu.map(dish => {
                  const ings           = getDishIngredients(dish)
                  const missingReq     = ings.filter(i => i.required && !i.available)
                  const missingOpt     = ings.filter(i => !i.required && !i.available)
                  const isBlocked      = missingReq.length > 0
                  return (
                    <div key={dish.id} style={{
                      border: '1px solid #e8e8e8', borderRadius: 10, padding: 12,
                      background: isBlocked ? '#f5f5f5' : missingOpt.length ? '#fffbf0' : '#fff',
                      opacity: isBlocked ? 0.65 : 1,
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isBlocked ? '#999' : '#222' }}>{dish.name}</div>
                        <div style={{ fontWeight: 700, color: isBlocked ? '#bbb' : '#e85d04', fontSize: '0.9rem', whiteSpace: 'nowrap', marginLeft: 6 }}>
                          ₪{Number(dish.price).toFixed(0)}
                        </div>
                      </div>

                      {dish.description && (
                        <div style={{ fontSize: '0.75rem', color: '#999' }}>{dish.description}</div>
                      )}

                      {ings.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                          {ings.map(ing => (
                            <span key={ing.id} style={{
                              fontSize: '0.68rem', padding: '2px 7px', borderRadius: 10, fontWeight: 500,
                              background: ing.available ? '#d1fae5' : '#fee2e2',
                              color:      ing.available ? '#065f46' : '#991b1b',
                              textDecoration: ing.available ? 'none' : 'line-through',
                            }}>
                              {ing.required && '★ '}{ing.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {isBlocked && (
                        <div style={{ fontSize: '0.72rem', color: '#991b1b', background: '#fee2e2', borderRadius: 6, padding: '4px 8px', marginTop: 2 }}>
                          ⊘ Unavailable — missing required ingredient{missingReq.length > 1 ? 's' : ''}: {missingReq.map(i => i.name).join(', ')}
                        </div>
                      )}
                      {!isBlocked && missingOpt.length > 0 && (
                        <div style={{ fontSize: '0.72rem', color: '#b45309', background: '#fef3c7', borderRadius: 6, padding: '4px 8px', marginTop: 2 }}>
                          ⚠ Missing optional: {missingOpt.map(i => i.name).join(', ')}
                        </div>
                      )}

                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => addToCart(dish)}
                        disabled={isBlocked}
                        style={{ marginTop: 'auto', paddingTop: 6, paddingBottom: 6 }}
                      >
                        {isBlocked ? 'Unavailable' : '+ Add to Order'}
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Cart */}
              {cart.length > 0 && (
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 10 }}>
                    Cart ({cart.length} item{cart.length > 1 ? 's' : ''})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                    {cart.map(({ dish, missing }, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                        padding: '8px 10px', background: '#fafafa', borderRadius: 8,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>
                            {dish.name}
                            <span style={{ color: '#e85d04', marginLeft: 8 }}>₪{Number(dish.price).toFixed(0)}</span>
                          </div>
                          {missing.length > 0 && (
                            <div style={{ fontSize: '0.72rem', color: '#b45309', marginTop: 2 }}>
                              ⚠ Missing: {missing.join(', ')} — customer informed
                            </div>
                          )}
                        </div>
                        <button onClick={() => removeFromCart(idx)} style={{
                          background: 'none', border: 'none', color: '#ccc',
                          cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 2,
                        }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                      Total: <span style={{ color: '#e85d04' }}>₪{cartTotal.toFixed(0)}</span>
                    </div>
                    <button className="btn btn-primary" onClick={placeOrder} disabled={placing}>
                      {placing ? 'Placing…' : 'Place Phone Order'}
                    </button>
                  </div>
                  {success && (
                    <div className="alert alert-success" style={{ marginTop: 10 }}>{success}</div>
                  )}
                </div>
              )}
            </>
          )
      }
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function CallCenter() {
  const [operator, setOperator]     = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) } catch { return null }
  })
  const [queue, setQueue]           = useState([])
  const [activeCall, setActiveCall] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_CALL_KEY)) } catch { return null }
  })
  const [claiming, setClaiming]     = useState(false)
  const [claimError, setClaimError] = useState('')
  const [dismissed, setDismissed]   = useState(new Set())

  const [phone, setPhone]           = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_CALL_KEY))?.phone || '' } catch { return '' }
  })
  const [customer, setCustomer]     = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_CALL_KEY))?.customer || null } catch { return null }
  })
  const [notFound, setNotFound]     = useState(false)
  const [guestName, setGuestName]   = useState('')

  // Delivery address + restaurant selection
  const [deliveryAddr, setDeliveryAddr]             = useState('')
  const [deliveryLat, setDeliveryLat]               = useState(null)
  const [deliveryLng, setDeliveryLng]               = useState(null)
  const [customerArea, setCustomerArea]             = useState(null)
  const [allRestaurants, setAllRestaurants]         = useState([])
  const [areas, setAreas]                           = useState([])
  const [nearbyRestaurants, setNearbyRestaurants]   = useState([])
  const [selectedRestaurant, setSelectedRestaurant] = useState(null)

  const [orders, setOrders]           = useState([])
  const [customerOrders, setCustomerOrders] = useState([])
  const [success, setSuccess]         = useState('')

  const unsubRef     = useRef(null)
  const callUnsubRef = useRef(null)

  useEffect(() => {
    getRestaurants().then(setAllRestaurants)
    getAreas().then(setAreas)
  }, [])

  useEffect(() => {
    if (!operator) return
    unsubRef.current = listenToIncomingCalls(setQueue)
    return () => unsubRef.current?.()
  }, [operator])

  // Persist active call; detect remote hang-up
  useEffect(() => {
    callUnsubRef.current?.()
    callUnsubRef.current = null
    if (!activeCall) { localStorage.removeItem(LS_CALL_KEY); return }
    localStorage.setItem(LS_CALL_KEY, JSON.stringify(activeCall))
    callUnsubRef.current = listenToCall(activeCall.id, updated => {
      if (updated.status === 'ended') {
        setActiveCall(null); setPhone(''); setCustomer(null); setNotFound(false)
      }
    })
    return () => callUnsubRef.current?.()
  }, [activeCall?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load order history when customer is identified; also seed right-panel session orders on refresh
  useEffect(() => {
    if (!customer?.id) { setCustomerOrders([]); return }
    getOrdersByCustomer(customer.id).then(hist => {
      setCustomerOrders(hist.slice(0, 3))
      setOrders(prev => prev.length === 0 ? hist.slice(0, 15) : prev)
    })
  }, [customer?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync customer into localStorage
  useEffect(() => {
    const raw = localStorage.getItem(LS_CALL_KEY)
    if (!raw) return
    try {
      const data = JSON.parse(raw)
      localStorage.setItem(LS_CALL_KEY, JSON.stringify({ ...data, customer }))
    } catch {}
  }, [customer])

  const ringing = queue.filter(c => !dismissed.has(c.id))
  const nextCall = activeCall ? null : (ringing[0] || null)

  async function handleAnswer(call) {
    setClaiming(true); setClaimError('')
    try {
      await answerCall(call.id, operator.id, operator.name)
      setDismissed(prev => new Set([...prev, call.id]))
      setActiveCall({ ...call, phone: call.phone })
      setPhone(call.phone)
      const all   = await getCustomers()
      const found = all.find(c => c.phone === call.phone)
      if (found) { setCustomer(found); setNotFound(false) }
      else       { setCustomer(null);  setNotFound(true) }
      setSuccess('')
    } catch (err) {
      setClaimError(err.message)
    } finally {
      setClaiming(false)
    }
  }

  async function handleEndCall() {
    if (activeCall) await endCall(activeCall.id)
    setActiveCall(null); setPhone(''); setCustomer(null); setNotFound(false)
  }

  async function lookup() {
    setCustomer(null); setNotFound(false); setSuccess('')
    const all   = await getCustomers()
    const found = all.find(c => c.phone === phone.trim())
    if (found) setCustomer(found)
    else       setNotFound(true)
  }

  async function registerGuest() {
    if (!guestName.trim()) return
    const c = await addCustomer({ name: guestName, phone: phone.trim(), guest: true })
    setCustomer(c); setNotFound(false)
  }

  function findNearbyRestaurants(lat, lng) {
    if (!lat || !lng) {
      setCustomerArea(null)
      setNearbyRestaurants([])
      setSelectedRestaurant(null)
      return
    }
    const area = findArea(areas, lat, lng)
    setCustomerArea(area)
    let filtered
    if (area) {
      // Inside a known area — show area restaurants first, then unassigned
      filtered = allRestaurants
        .filter(r => r.areaId === area.id || !r.areaId)
        .map(r => ({ ...r, _unassigned: !r.areaId, _inArea: r.areaId === area.id }))
        .sort((a, b) => (b._inArea ? 1 : 0) - (a._inArea ? 1 : 0))
    } else {
      // Outside all service areas — show every restaurant with a warning, area restaurants labelled
      filtered = allRestaurants.map(r => ({ ...r, _unassigned: !r.areaId, _inArea: false }))
    }
    setNearbyRestaurants(filtered)
    setSelectedRestaurant(null)
  }

  function handleAddressSelect({ formattedAddress, lat, lng }) {
    setDeliveryAddr(formattedAddress)
    setDeliveryLat(lat)
    setDeliveryLng(lng)
    findNearbyRestaurants(lat, lng)
  }

  function handleAddressType(val) {
    setDeliveryAddr(val)
    setDeliveryLat(null)
    setDeliveryLng(null)
    setCustomerArea(null)
    if (!val.trim()) setNearbyRestaurants([])
    setSelectedRestaurant(null)
  }

  function handleOrderPlaced(order, customerName, restaurantName) {
    setOrders(prev => [{ ...order, customerName, restaurantName }, ...prev])
  }

  function signOut() {
    localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_CALL_KEY)
    unsubRef.current?.(); callUnsubRef.current?.()
    setOperator(null); setQueue([]); setActiveCall(null)
    setPhone(''); setCustomer(null)
  }

  if (!operator) return <OperatorRegistration onRegistered={setOperator} />

  return (
    <>
      {nextCall && (
        <RingingBanner
          call={nextCall}
          onAnswer={handleAnswer}
          onDismiss={() => setDismissed(prev => new Set([...prev, nextCall.id]))}
          claiming={claiming}
        />
      )}

      <div className="page">
        {/* Operator bar */}
        <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: '#e85d04',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
          }}>
            {operator.name[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{operator.name}</div>
            <div style={{ fontSize: '0.75rem', color: activeCall ? '#f59e0b' : '#34c759' }}>
              {activeCall ? '● Busy' : '● Available'}
            </div>
          </div>
          {activeCall && (
            <div style={{ marginLeft: 16, padding: '4px 12px', background: '#fff4ee', borderRadius: 20, fontSize: '0.8rem', color: '#e85d04', fontWeight: 600 }}>
              📞 Active call: {activeCall.phone}
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {ringing.length > 0 && (
              <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600 }}>
                {activeCall
                  ? `${ringing.length} call${ringing.length > 1 ? 's' : ''} in queue — finish current call`
                  : `${ringing.length} call${ringing.length > 1 ? 's' : ''} waiting`
                }
              </span>
            )}
            {activeCall && (
              <button className="btn btn-ghost btn-sm" style={{ color: '#ff3b30' }} onClick={handleEndCall}>
                End Call
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign Out</button>
          </div>
        </div>

        {claimError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{claimError}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }}>
          {/* ── Left panel ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Customer Lookup */}
            <div className="card">
              <h3 style={{ fontSize: '1rem', marginBottom: 14 }}>Customer Lookup</h3>
              {activeCall && (
                <div style={{ fontSize: '0.8rem', color: '#f59e0b', marginBottom: 10, padding: '6px 10px', background: '#fff8ee', borderRadius: 6 }}>
                  Lookup locked — finish current call first.
                </div>
              )}
              <div className="form-group">
                <label>Phone Number</label>
                <div className="copy-row">
                  <input
                    value={phone}
                    onChange={e => !activeCall && setPhone(e.target.value)}
                    onKeyDown={e => !activeCall && e.key === 'Enter' && lookup()}
                    placeholder="05X-XXXXXXX"
                    disabled={!!activeCall}
                    style={activeCall ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                  />
                  <button className="btn btn-primary btn-sm" onClick={lookup} disabled={!!activeCall}>Search</button>
                </div>
              </div>

              {customer && (
                <div style={{ marginTop: 10, fontSize: '0.88rem' }}>
                  <div style={{ padding: 10, background: '#f0fdf4', borderRadius: 8, marginBottom: customerOrders.length ? 8 : 0 }}>
                    <div style={{ fontWeight: 600 }}>{customer.name}</div>
                    <div style={{ color: '#666' }}>{customer.phone}</div>
                    {customer.guest && <span className="badge badge-pending" style={{ marginTop: 4 }}>Guest</span>}
                  </div>
                  {customerOrders.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: 4, paddingLeft: 2 }}>Recent orders</div>
                      {customerOrders.map(o => (
                        <div key={o.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '5px 8px', background: '#fafafa', borderRadius: 6, marginBottom: 4, fontSize: '0.8rem',
                        }}>
                          <div>
                            <div style={{ fontWeight: 500 }}>{o.restaurantName || '—'}</div>
                            <div style={{ color: '#aaa', fontSize: '0.72rem' }}>
                              {o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString('he-IL') : ''}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#e85d04', fontWeight: 600 }}>₪{Number(o.total || 0).toFixed(0)}</div>
                            <div style={{ color: STATUS_COLORS[o.status] || '#aaa', fontSize: '0.72rem' }}>{o.status}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {notFound && (
                <div style={{ marginTop: 10 }}>
                  <div className="alert alert-error" style={{ marginBottom: 10 }}>Phone not found</div>
                  <div className="form-group">
                    <label>Register as Guest</label>
                    <div className="copy-row">
                      <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Customer name" />
                      <button className="btn btn-secondary btn-sm" onClick={registerGuest}>Add</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Delivery Address + Restaurant */}
            <div className="card">
              <h3 style={{ fontSize: '1rem', marginBottom: 14 }}>Delivery Address</h3>
              <div className="form-group" style={{ marginBottom: 4 }}>
                <AddressAutocomplete
                  value={deliveryAddr}
                  onChange={handleAddressType}
                  onPlaceSelect={handleAddressSelect}
                />
                {deliveryLat && (
                  <div style={{ fontSize: '0.68rem', color: '#bbb', marginTop: 3, fontFamily: 'monospace' }}>
                    {deliveryLat.toFixed(5)}, {deliveryLng.toFixed(5)}
                  </div>
                )}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', marginBottom: nearbyRestaurants.length ? 14 : 0, marginTop: 4 }}
                disabled={!deliveryAddr.trim()}
                onClick={() => findNearbyRestaurants(deliveryLat, deliveryLng)}
              >
                {deliveryLat ? 'Find Restaurants in Area' : 'Find Restaurants'}
              </button>

              {deliveryAddr && !deliveryLat && nearbyRestaurants.length === 0 && (
                <div style={{ fontSize: '0.78rem', color: '#aaa', marginTop: 8, textAlign: 'center' }}>
                  Select an address from the dropdown to detect coordinates.
                </div>
              )}

              {nearbyRestaurants.length > 0 && (
                <>
                  {!customerArea && deliveryLat && (
                    <div style={{ fontSize: '0.75rem', color: '#b45309', background: '#fef3c7', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
                      ⚠ No service area found for this location — showing all restaurants.
                    </div>
                  )}
                  <div style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: 8 }}>
                    {customerArea
                      ? <><strong style={{ color: '#e85d04' }}>{customerArea.name}</strong> — {nearbyRestaurants.filter(r => r._inArea).length} restaurant{nearbyRestaurants.filter(r => r._inArea).length !== 1 ? 's' : ''} in area</>
                      : `${nearbyRestaurants.length} restaurant${nearbyRestaurants.length !== 1 ? 's' : ''}`
                    }
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {nearbyRestaurants.map(r => {
                      const isSelected = selectedRestaurant?.id === r.id
                      return (
                        <button
                          key={r.id}
                          onClick={() => setSelectedRestaurant(r)}
                          style={{
                            textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: '1px solid',
                            borderColor: isSelected ? '#e85d04' : '#e8e8e8',
                            background:  isSelected ? '#fff4ee' : '#fafafa',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: isSelected ? '#e85d04' : '#222' }}>
                              {r.name}
                            </div>
                            {r._unassigned && (
                              <span style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 500 }}>
                                📍 unassigned
                              </span>
                            )}
                          </div>
                          {r.address && (
                            <div style={{ fontSize: '0.72rem', color: '#999', marginTop: 2 }}>{r.address}</div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Right panel ── */}
          {selectedRestaurant
            ? (
              <MenuPanel
                restaurant={selectedRestaurant}
                onBack={() => setSelectedRestaurant(null)}
                customer={customer}
                deliveryAddress={deliveryAddr}
                onOrderPlaced={handleOrderPlaced}
              />
            )
            : (
              <div className="card">
                <h3 style={{ fontSize: '1rem', marginBottom: 14 }}>Orders — This Session</h3>
                {orders.length === 0
                  ? (
                    <div className="empty-state">
                      <div className="empty-icon">📞</div>
                      <p>No orders placed yet.</p>
                      <p style={{ fontSize: '0.8rem', color: '#bbb', marginTop: 4 }}>
                        Look up a customer, enter a delivery address, then select a restaurant.
                      </p>
                    </div>
                  )
                  : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr><th>Order ID</th><th>Customer</th><th>Restaurant</th><th>Total</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {orders.map(o => (
                            <tr key={o.id}>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{o.id.slice(0, 8)}</td>
                              <td>{o.customerName}</td>
                              <td>{o.restaurantName}</td>
                              <td>₪{Number(o.total).toFixed(0)}</td>
                              <td>
                                <span style={{ color: STATUS_COLORS[o.status] || '#666', fontWeight: 600, fontSize: '0.8rem' }}>
                                  {o.status}
                                </span>
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
        </div>
      </div>
    </>
  )
}
