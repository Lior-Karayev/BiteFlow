import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import {
  listenToShifts, listenToCouriers, approveShift, rejectShift, addNotification,
  getShiftRequirements, upsertShiftRequirement,
  getSchedulePublication, setSchedulePublished,
  updateShiftSlots, createShiftAssignment,
  getAreas, getOrders, getRestaurants,
} from '../../firebase/db'
import { SHIFT_TYPES, DAYS_OF_WEEK, weekMonday } from '../../constants/shifts'

const OpsSchedulerContext = createContext(null)

function computeAreaLoad(couriers, areas, orders, restaurants) {
  const restToArea = Object.fromEntries(restaurants.map(r => [r.id, r.areaId]).filter(([, a]) => a))
  const ACTIVE = new Set([
    'PENDING', 'PAID', 'IN_PREP', 'READY', 'IN_DELIVERY',
    'pending', 'approved', 'in_preparation', 'ready', 'picked_up',
  ])

  const result = {}
  for (const a of areas) result[a.id] = { name: a.name, couriers: 0, orders: 0, ratio: 0 }

  for (const c of couriers) {
    if (c.currentLat == null || c.currentLng == null) continue
    const area = areas.find(a =>
      c.currentLat >= a.minLat && c.currentLat <= a.maxLat &&
      c.currentLng >= a.minLng && c.currentLng <= a.maxLng
    )
    if (area && result[area.id]) result[area.id].couriers++
  }

  for (const o of orders) {
    if (!ACTIVE.has(o.status)) continue
    const rids = o.restaurantIds || (o.restaurantId ? [o.restaurantId] : [])
    for (const rid of rids) {
      const aId = restToArea[rid]
      if (aId && result[aId]) result[aId].orders++
    }
  }

  for (const id of Object.keys(result)) {
    const { couriers: c, orders: o } = result[id]
    result[id].ratio = c === 0 ? (o > 0 ? 3 : 0) : o / c
  }

  return result
}

// OpsScheduler: data + logic layer for the Delivery Ops Manager PC node.
// Provides the <<assembly>> interface consumed by DeliveryOpsClient (DOC).
export function OpsScheduler({ children }) {
  const [shifts, setShifts]           = useState([])
  const [couriers, setCouriers]       = useState([])
  const [areas, setAreas]             = useState([])
  const [orders, setOrders]           = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [areaLoad, setAreaLoad]       = useState({})
  const [requirements, setRequirements] = useState([])
  const [publication, setPublication]  = useState(null)
  const [loading, setLoading]         = useState(true)

  // Shared week state: DOC reads/sets this through context
  const [selectedWeek, setSelectedWeek] = useState(() => weekMonday(0))

  // Real-time listeners: shifts (SUC-10 submissions) + couriers
  useEffect(() => {
    const unsubShifts   = listenToShifts(setShifts)
    const unsubCouriers = listenToCouriers(setCouriers)
    return () => { unsubShifts(); unsubCouriers() }
  }, [])

  // Static data: areas, orders, restaurants
  useEffect(() => {
    Promise.all([getAreas(), getOrders(), getRestaurants()])
      .then(([as, os, rs]) => {
        setAreas(as)
        setOrders(os)
        setRestaurants(rs)
        setLoading(false)
      })
  }, [])

  // Recompute heatmap load whenever couriers or static data change
  useEffect(() => {
    if (areas.length > 0) setAreaLoad(computeAreaLoad(couriers, areas, orders, restaurants))
  }, [couriers, areas, orders, restaurants])

  // Reload demand requirements + publication status when week changes
  useEffect(() => {
    getShiftRequirements(selectedWeek).then(setRequirements)
    getSchedulePublication(selectedWeek).then(setPublication)
  }, [selectedWeek])

  // ── Coverage matrix ──────────────────────────────────────────
  // coverage[day][shiftType][areaId] = { required, approved, pending }
  const coverage = useMemo(() => {
    const result = {}
    for (const day of DAYS_OF_WEEK) {
      result[day] = {}
      for (const { key: st } of SHIFT_TYPES) {
        result[day][st] = {}
        for (const area of areas) {
          const req = requirements.find(r =>
            r.day === day && r.shiftType === st && r.areaId === area.id
          )
          const matching = shifts.filter(s =>
            s.weekStart === selectedWeek &&
            s.slots?.some(sl => sl.day === day && sl.shiftType === st && sl.areaId === area.id)
          )
          result[day][st][area.id] = {
            required: req?.requiredCouriers ?? 0,
            approved: matching.filter(s => (s.status || '').toUpperCase() === 'APPROVED').length,
            pending:  matching.filter(s => (s.status || '').toUpperCase() === 'PENDING').length,
          }
        }
      }
    }
    return result
  }, [shifts, requirements, areas, selectedWeek])

  // ── Actions ──────────────────────────────────────────────────

  // SUC-6 MSS 3-5: approve shift + push notification to courier
  const handleApprove = useCallback(async (id) => {
    const shift = shifts.find(s => s.id === id)
    await approveShift(id, 'Delivery Ops Manager')
    if (shift?.courierId) {
      await addNotification({
        targetId: shift.courierId, targetType: 'courier',
        message:  'Your shift submission has been approved.',
        type:     'shift_approved', orderId: null, read: false,
      })
    }
  }, [shifts])

  const handleReject = useCallback(async (id) => {
    await rejectShift(id)
  }, [])

  const handleApproveAll = useCallback(async (ids) => {
    await Promise.all(ids.map(id => handleApprove(id)))
  }, [handleApprove])

  // SUC-6 MSS 2 opt: push zone rebalance notification to couriers
  const handleRebalance = useCallback(async (areaId) => {
    const area = areas.find(a => a.id === areaId)
    await addNotification({
      targetId: 'all_couriers', targetType: 'courier',
      message:  `Zone rebalance: more couriers needed in ${area?.name || 'target zone'}.`,
      type:     'zone_rebalance', orderId: null, read: false,
    })
  }, [areas])

  // Demand config: Ops Manager sets required couriers per slot
  const handleSetRequirement = useCallback(async (day, shiftType, areaId, count) => {
    const updated = await upsertShiftRequirement(selectedWeek, day, shiftType, areaId, count)
    setRequirements(prev => {
      const idx = prev.findIndex(r => r.id === updated.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n }
      return [...prev, updated]
    })
  }, [selectedWeek])

  // Auto-assign: greedy algorithm — fills highest-deficit slots first
  // from pending submissions, then approves the selected set.
  const handleAutoAssign = useCallback(async () => {
    const toApprove = new Set()

    // Build deficit list sorted by largest gap first
    const deficits = []
    for (const day of DAYS_OF_WEEK) {
      for (const { key: st } of SHIFT_TYPES) {
        for (const area of areas) {
          const slot = coverage[day]?.[st]?.[area.id]
          if (!slot || slot.required === 0) continue
          const deficit = slot.required - slot.approved
          if (deficit > 0) deficits.push({ day, shiftType: st, areaId: area.id, deficit })
        }
      }
    }
    deficits.sort((a, b) => b.deficit - a.deficit)

    for (const { day, shiftType, areaId, deficit } of deficits) {
      const candidates = shifts.filter(s =>
        s.weekStart === selectedWeek &&
        (s.status || '').toUpperCase() === 'PENDING' &&
        !toApprove.has(s.id) &&
        s.slots?.some(sl => sl.day === day && sl.shiftType === shiftType && sl.areaId === areaId)
      )
      candidates.slice(0, deficit).forEach(s => toApprove.add(s.id))
    }

    if (toApprove.size > 0) {
      await Promise.all([...toApprove].map(id => handleApprove(id)))
    }
    return toApprove.size
  }, [shifts, coverage, areas, selectedWeek, handleApprove])

  // SUC-6 MSS 3-5: publish the whole week — approve all pending, then lock
  const handlePublish = useCallback(async () => {
    const pending = shifts.filter(s =>
      s.weekStart === selectedWeek && (s.status || '').toUpperCase() === 'PENDING'
    )
    await Promise.all(pending.map(s => handleApprove(s.id)))
    await setSchedulePublished(selectedWeek, 'Delivery Ops Manager')
    setPublication({ weekStart: selectedWeek, publishedBy: 'Delivery Ops Manager', status: 'published' })
  }, [shifts, selectedWeek, handleApprove])

  // SUC-6 Opt: update shift after publication — saves new slots + notifies courier
  const handleUpdateAssignment = useCallback(async (shiftId, newSlots) => {
    const shift = shifts.find(s => s.id === shiftId)
    if (newSlots.length === 0) {
      await rejectShift(shiftId)
    } else {
      await updateShiftSlots(shiftId, newSlots)
    }
    if (shift?.courierId) {
      await addNotification({
        targetId: shift.courierId, targetType: 'courier',
        message:  newSlots.length === 0
          ? 'Your shift assignment has been removed.'
          : 'Your shift assignment has been updated.',
        type: 'shift_changed', orderId: null, read: false,
      })
    }
  }, [shifts])

  // Manually assign any courier to a slot (creates an APPROVED shift doc)
  const handleManualAssign = useCallback(async (courierId, day, shiftType, areaId) => {
    const alreadyIn = shifts.some(s =>
      s.courierId === courierId &&
      s.weekStart === selectedWeek &&
      (s.status || '').toUpperCase() !== 'REJECTED' &&
      s.slots?.some(sl => sl.day === day && sl.shiftType === shiftType && sl.areaId === areaId)
    )
    if (alreadyIn) return
    await createShiftAssignment({ courierId, weekStart: selectedWeek, slots: [{ day, shiftType, areaId }] })
    await addNotification({
      targetId: courierId, targetType: 'courier',
      message:  publication
        ? 'Your shift assignment has been updated.'
        : 'You have been assigned to a shift.',
      type: publication ? 'shift_changed' : 'shift_approved', orderId: null, read: false,
    })
  }, [shifts, selectedWeek, publication])

  // Remove a courier from one slot; notify if post-publication
  const handleRemoveFromSlot = useCallback(async (shiftId, day, shiftType, areaId) => {
    const shift = shifts.find(s => s.id === shiftId)
    if (!shift) return
    const newSlots = (shift.slots || []).filter(sl =>
      !(sl.day === day && sl.shiftType === shiftType && sl.areaId === areaId)
    )
    if (publication) {
      await handleUpdateAssignment(shiftId, newSlots)
    } else if (newSlots.length === 0) {
      await rejectShift(shiftId)
    } else {
      await updateShiftSlots(shiftId, newSlots)
    }
  }, [shifts, publication, handleUpdateAssignment])

  const pendingCount = shifts.filter(s =>
    s.weekStart === selectedWeek && (s.status || '').toUpperCase() === 'PENDING'
  ).length

  return (
    <OpsSchedulerContext.Provider value={{
      shifts, couriers, areas, areaLoad, requirements, coverage,
      selectedWeek, setSelectedWeek,
      publication,
      pendingCount, loading,
      approveShift:      handleApprove,
      rejectShift:       handleReject,
      approveAll:        handleApproveAll,
      rebalanceZone:     handleRebalance,
      setRequirement:    handleSetRequirement,
      autoAssign:        handleAutoAssign,
      publishSchedule:   handlePublish,
      updateAssignment:  handleUpdateAssignment,
      manualAssign:      handleManualAssign,
      removeFromSlot:    handleRemoveFromSlot,
    }}>
      {children}
    </OpsSchedulerContext.Provider>
  )
}

export function useOpsScheduler() {
  return useContext(OpsSchedulerContext)
}
