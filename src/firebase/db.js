import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, setDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, onSnapshot, runTransaction,
} from 'firebase/firestore'
import { db } from './config'

// ── Owners (auth + identity) ───────────────────────────────────
// Doc ID = sanitized email so lookups are O(1) without a query index
function ownerDocId(email) {
  return email.toLowerCase().replace(/@/, '__').replace(/\./g, '_')
}

export async function createOwner({ email, name, phone, restaurantId, tempPassword }) {
  const id = ownerDocId(email)
  await setDoc(doc(db, 'owners', id), {
    email:              email.toLowerCase(),
    name:               name  || '',
    phone:              phone || '',
    restaurantId,
    password:           tempPassword,
    mustChangePassword: true,
    createdAt:          serverTimestamp(),
  })
  return { id, email, name, phone, restaurantId }
}

export async function loginOwner(email, password) {
  const snap = await getDoc(doc(db, 'owners', ownerDocId(email)))
  if (!snap.exists()) throw new Error('No account found for this email.')
  const owner = { id: snap.id, ...snap.data() }
  if (owner.password !== password) throw new Error('Incorrect password.')
  return owner
}

export async function setOwnerRestaurant(ownerDocId, restaurantId) {
  await updateDoc(doc(db, 'owners', ownerDocId), {
    restaurantId, updatedAt: serverTimestamp(),
  })
}

export async function changeOwnerPassword(email, newPassword) {
  await updateDoc(doc(db, 'owners', ownerDocId(email)), {
    password:           newPassword,
    mustChangePassword: false,
    updatedAt:          serverTimestamp(),
  })
}

// ── Restaurants ────────────────────────────────────────────────
export async function getRestaurants() {
  const snap = await getDocs(query(collection(db, 'restaurants'), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getRestaurant(id) {
  const snap = await getDoc(doc(db, 'restaurants', id))
  if (!snap.exists()) throw new Error('Restaurant not found')
  return { id: snap.id, ...snap.data() }
}

export async function registerRestaurant({ name, address, phone, ownerId, lat, lng, areaId }) {
  const ref = await addDoc(collection(db, 'restaurants'), {
    name, address, phone, ownerId,
    ...(lat    != null ? { lat, lng } : {}),
    ...(areaId != null ? { areaId }   : {}),
    active:    true,
    createdAt: serverTimestamp(),
  })
  return { id: ref.id, name, address, phone, ownerId, lat, lng, areaId }
}

export async function updateRestaurant(id, data) {
  await updateDoc(doc(db, 'restaurants', id), { ...data, updatedAt: serverTimestamp() })
}

// ── Global ingredient catalog ──────────────────────────────────
export async function getAllIngredients() {
  const snap = await getDocs(query(collection(db, 'ingredients'), orderBy('nameLower', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

function toTitleCase(str) {
  return str.trim().replace(/\b\w/g, c => c.toUpperCase())
}

export async function createGlobalIngredient(name) {
  const nameLower = name.trim().toLowerCase()
  const existing  = await getDocs(
    query(collection(db, 'ingredients'), where('nameLower', '==', nameLower))
  )
  if (!existing.empty) {
    const d = existing.docs[0]
    return { id: d.id, ...d.data() }
  }
  const titled = toTitleCase(name)
  const ref = await addDoc(collection(db, 'ingredients'), {
    name: titled, nameLower, createdAt: serverTimestamp(),
  })
  return { id: ref.id, name: titled, nameLower }
}

// ── Restaurant inventory (links restaurant → global ingredient) ─
export async function getInventory(restaurantId) {
  const snap = await getDocs(
    query(collection(db, 'restaurantIngredients'), where('restaurantId', '==', restaurantId))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addToInventory(restaurantId, ingredientId, ingredientName) {
  const ref = await addDoc(collection(db, 'restaurantIngredients'), {
    restaurantId, ingredientId, ingredientName,
    available: true, createdAt: serverTimestamp(),
  })
  return { id: ref.id, restaurantId, ingredientId, ingredientName, available: true }
}

export async function updateInventoryStatus(id, available) {
  await updateDoc(doc(db, 'restaurantIngredients', id), { available, updatedAt: serverTimestamp() })
}

// ── Menu Items ─────────────────────────────────────────────────
export async function getMenuItems(restaurantId) {
  const snap = await getDocs(
    query(collection(db, 'menuItems'), where('restaurantId', '==', restaurantId))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addMenuItem(data) {
  const ref = await addDoc(collection(db, 'menuItems'), {
    ...data, createdAt: serverTimestamp(),
  })
  return { id: ref.id, ...data }
}

export async function updateMenuItem(id, data) {
  await updateDoc(doc(db, 'menuItems', id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteMenuItem(id) {
  await deleteDoc(doc(db, 'menuItems', id))
}

export async function removeFromInventory(id) {
  await deleteDoc(doc(db, 'restaurantIngredients', id))
}

// ── Orders ─────────────────────────────────────────────────────
export async function getOrders() {
  const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getOrdersByCustomer(customerId) {
  const snap = await getDocs(
    query(collection(db, 'orders'), where('customerId', '==', customerId), orderBy('createdAt', 'desc'))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addOrder(data) {
  const ref = await addDoc(collection(db, 'orders'), {
    ...data, createdAt: serverTimestamp(),
  })
  return { id: ref.id, ...data }
}

export async function updateOrderStatus(id, status) {
  await updateDoc(doc(db, 'orders', id), { status, updatedAt: serverTimestamp() })
}

// ── Couriers ───────────────────────────────────────────────────
export async function getCouriers() {
  const snap = await getDocs(collection(db, 'couriers'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export function listenToCouriers(callback) {
  return onSnapshot(collection(db, 'couriers'), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export async function addCourier({ name, phone, areaId }) {
  const ref = await addDoc(collection(db, 'couriers'), {
    name, phone: phone || '', available: true,
    ...(areaId ? { areaId } : {}),
    createdAt: serverTimestamp(),
  })
  return { id: ref.id, name, phone: phone || '', available: true, ...(areaId ? { areaId } : {}) }
}

// ── Shifts ─────────────────────────────────────────────────────
export async function getShifts() {
  const snap = await getDocs(query(collection(db, 'shifts'), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function updateShiftStatus(id, status) {
  await updateDoc(doc(db, 'shifts', id), { status, updatedAt: serverTimestamp() })
}

// ── Customers ──────────────────────────────────────────────────
export async function getCustomers() {
  const snap = await getDocs(collection(db, 'customers'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addCustomer(data) {
  const ref = await addDoc(collection(db, 'customers'), {
    ...data, createdAt: serverTimestamp(),
  })
  return { id: ref.id, ...data }
}

// ── Dispatches ─────────────────────────────────────────────────
export async function addDispatch(data) {
  const ref = await addDoc(collection(db, 'dispatches'), {
    ...data, createdAt: serverTimestamp(),
  })
  return { id: ref.id, ...data }
}

export async function getDispatches(restaurantId) {
  const snap = await getDocs(
    query(collection(db, 'dispatches'), where('restaurantId', '==', restaurantId), orderBy('createdAt', 'desc'))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── Call Center operators ──────────────────────────────────────
export async function registerOperator(data) {
  const ref = await addDoc(collection(db, 'operators'), {
    ...data, online: true, createdAt: serverTimestamp(),
  })
  return { id: ref.id, ...data }
}

// ── Incoming calls queue ───────────────────────────────────────
export async function createIncomingCall(phone) {
  const ref = await addDoc(collection(db, 'incomingCalls'), {
    phone,
    status:       'ringing',
    operatorId:   null,
    operatorName: null,
    createdAt:    serverTimestamp(),
  })
  return { id: ref.id, phone, status: 'ringing' }
}

// Returns an unsubscribe function — call it on component unmount
export function listenToIncomingCalls(callback) {
  const q = query(
    collection(db, 'incomingCalls'),
    where('status', '==', 'ringing'),
    orderBy('createdAt', 'asc'),
  )
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export function listenToCall(callId, callback) {
  return onSnapshot(doc(db, 'incomingCalls', callId), snap => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() })
  })
}

// Atomically claim a call — throws if already claimed by another operator
export async function answerCall(callId, operatorId, operatorName) {
  const callRef = doc(db, 'incomingCalls', callId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(callRef)
    if (!snap.exists())               throw new Error('Call no longer in queue.')
    if (snap.data().operatorId !== null) throw new Error('Already answered by another operator.')
    tx.update(callRef, {
      operatorId,
      operatorName,
      status:     'answered',
      answeredAt: serverTimestamp(),
    })
  })
}

export async function endCall(callId) {
  await updateDoc(doc(db, 'incomingCalls', callId), {
    status:  'ended',
    endedAt: serverTimestamp(),
  })
}

// ── Shifts (extended) ─────────────────────────────────────────
export async function approveShift(id, approvedBy) {
  await updateDoc(doc(db, 'shifts', id), {
    status:     'APPROVED',
    approvedAt: serverTimestamp(),
    approvedBy: approvedBy || 'Delivery Ops Manager',
    updatedAt:  serverTimestamp(),
  })
}

export async function rejectShift(id) {
  await updateDoc(doc(db, 'shifts', id), {
    status:    'REJECTED',
    updatedAt: serverTimestamp(),
  })
}

export function listenToShifts(callback) {
  const q = query(collection(db, 'shifts'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

// ── Shift Requirements (demand config per area/shift/day) ──────
export async function getShiftRequirements(weekStart) {
  const snap = await getDocs(
    query(collection(db, 'shiftRequirements'), where('weekStart', '==', weekStart))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function upsertShiftRequirement(weekStart, day, shiftType, areaId, requiredCouriers) {
  const id = `${weekStart}_${day}_${shiftType}_${areaId}`
  await setDoc(doc(db, 'shiftRequirements', id), {
    weekStart, day, shiftType, areaId, requiredCouriers,
    updatedAt: serverTimestamp(),
  }, { merge: true })
  return { id, weekStart, day, shiftType, areaId, requiredCouriers }
}

// ── Notifications ──────────────────────────────────────────────
export async function addNotification(data) {
  const ref = await addDoc(collection(db, 'notifications'), {
    ...data, createdAt: serverTimestamp(),
  })
  return { id: ref.id, ...data }
}

// ── Schedule Publications (draft → publish lifecycle) ──────────
export async function getSchedulePublication(weekStart) {
  const snap = await getDoc(doc(db, 'schedulePublications', weekStart))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function setSchedulePublished(weekStart, publishedBy) {
  await setDoc(doc(db, 'schedulePublications', weekStart), {
    weekStart, publishedBy, publishedAt: serverTimestamp(), status: 'published',
  })
}

// Update the slot list on an existing shift doc (for post-publication edits)
export async function updateShiftSlots(id, slots) {
  await updateDoc(doc(db, 'shifts', id), { slots, updatedAt: serverTimestamp() })
}

// Create a manager-initiated APPROVED shift assignment (not courier-submitted)
export async function createShiftAssignment({ courierId, weekStart, slots }) {
  const ref = await addDoc(collection(db, 'shifts'), {
    courierId, weekStart, slots,
    status:     'APPROVED',
    assignedBy: 'Delivery Ops Manager',
    createdAt:  serverTimestamp(),
    updatedAt:  serverTimestamp(),
  })
  return { id: ref.id, courierId, weekStart, slots, status: 'APPROVED' }
}

// ── Service Areas ──────────────────────────────────────────────
export async function getAreas() {
  const snap = await getDocs(query(collection(db, 'areas'), orderBy('name', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function createArea({ name, minLat, maxLat, minLng, maxLng }) {
  const ref = await addDoc(collection(db, 'areas'), {
    name, minLat, maxLat, minLng, maxLng,
    active: true, createdAt: serverTimestamp(),
  })
  return { id: ref.id, name, minLat, maxLat, minLng, maxLng, active: true }
}

export async function updateArea(id, data) {
  await updateDoc(doc(db, 'areas', id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteArea(id) {
  await deleteDoc(doc(db, 'areas', id))
}
