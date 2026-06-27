const ACTIVE_STATUSES = new Set([
  'PENDING', 'PAID', 'IN_PREP', 'READY', 'IN_DELIVERY',
  'pending', 'approved', 'in_preparation', 'ready', 'picked_up',
])

export function computeAreaLoad(couriers, areas, orders, restaurants) {
  const restToArea = Object.fromEntries(
    restaurants.map(r => [r.id, r.areaId]).filter(([, a]) => a)
  )

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
    if (!ACTIVE_STATUSES.has(o.status)) continue
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

export function buildCoverage(shifts, requirements, areas, weekStart) {
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const SHIFT_TYPES = ['morning', 'evening', 'night']

  const result = {}
  for (const day of DAYS) {
    result[day] = {}
    for (const st of SHIFT_TYPES) {
      result[day][st] = {}
      for (const area of areas) {
        const req = requirements.find(r =>
          r.day === day && r.shiftType === st && r.areaId === area.id
        )
        const matching = shifts.filter(s =>
          s.weekStart === weekStart &&
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
}

export function greedyAutoAssign(shifts, coverage, areas, weekStart) {
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const SHIFT_TYPES = ['morning', 'evening', 'night']

  const toApprove = new Set()

  const deficits = []
  for (const day of DAYS) {
    for (const st of SHIFT_TYPES) {
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
      s.weekStart === weekStart &&
      (s.status || '').toUpperCase() === 'PENDING' &&
      !toApprove.has(s.id) &&
      s.slots?.some(sl => sl.day === day && sl.shiftType === shiftType && sl.areaId === areaId)
    )
    candidates.slice(0, deficit).forEach(s => toApprove.add(s.id))
  }

  return [...toApprove]
}
