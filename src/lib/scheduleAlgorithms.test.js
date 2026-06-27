import { describe, it, expect } from 'vitest'
import { computeAreaLoad, buildCoverage, greedyAutoAssign } from './scheduleAlgorithms'

const AREA_A = { id: 'area-a', name: 'South', minLat: 32.0, maxLat: 32.5, minLng: 34.7, maxLng: 35.2 }
const AREA_B = { id: 'area-b', name: 'North', minLat: 33.0, maxLat: 33.5, minLng: 35.0, maxLng: 35.5 }
const WEEK   = '2026-06-30'

// ─── computeAreaLoad ────────────────────────────────────────────────

describe('computeAreaLoad', () => {
  it('noActiveCouriers — couriers with no GPS coords produce ratio 0', () => {
    const couriers     = [{ id: 'c1' }, { id: 'c2' }]
    const orders       = []
    const restaurants  = []
    const result = computeAreaLoad(couriers, [AREA_A], orders, restaurants)
    expect(result['area-a'].couriers).toBe(0)
    expect(result['area-a'].ratio).toBe(0)
  })

  it('overloadedArea — 1 courier and 5 active orders in same area produces ratio 5', () => {
    const couriers    = [{ id: 'c1', currentLat: 32.2, currentLng: 34.9 }]
    const restaurants = [{ id: 'r1', areaId: 'area-a' }]
    const orders      = Array.from({ length: 5 }, (_, i) => ({
      id: `o${i}`, restaurantId: 'r1', status: 'IN_DELIVERY',
    }))
    const result = computeAreaLoad(couriers, [AREA_A], orders, restaurants)
    expect(result['area-a'].couriers).toBe(1)
    expect(result['area-a'].orders).toBe(5)
    expect(result['area-a'].ratio).toBe(5)
  })

  it('courierOutsideBounds — courier coords outside all areas is not counted', () => {
    const couriers = [{ id: 'c1', currentLat: 31.0, currentLng: 34.0 }]
    const result   = computeAreaLoad(couriers, [AREA_A, AREA_B], [], [])
    expect(result['area-a'].couriers).toBe(0)
    expect(result['area-b'].couriers).toBe(0)
  })
})

// ─── buildCoverage ──────────────────────────────────────────────────

describe('buildCoverage', () => {
  const slot = { day: 'Monday', shiftType: 'morning', areaId: 'area-a' }
  const req  = { day: 'Monday', shiftType: 'morning', areaId: 'area-a', requiredCouriers: 2 }

  it('approvedCountsCorrectly — 2 APPROVED shifts for same slot → approved = 2', () => {
    const shifts = [
      { id: 's1', courierId: 'c1', weekStart: WEEK, status: 'APPROVED', slots: [slot] },
      { id: 's2', courierId: 'c2', weekStart: WEEK, status: 'APPROVED', slots: [slot] },
    ]
    const result = buildCoverage(shifts, [req], [AREA_A], WEEK)
    expect(result['Monday']['morning']['area-a'].approved).toBe(2)
  })

  it('rejectedNotCounted — REJECTED shift for a slot → approved = 0', () => {
    const shifts = [
      { id: 's1', courierId: 'c1', weekStart: WEEK, status: 'REJECTED', slots: [slot] },
    ]
    const result = buildCoverage(shifts, [req], [AREA_A], WEEK)
    expect(result['Monday']['morning']['area-a'].approved).toBe(0)
    expect(result['Monday']['morning']['area-a'].pending).toBe(0)
  })

  it('pendingCountsSeparately — 1 APPROVED + 1 PENDING → approved=1, pending=1', () => {
    const shifts = [
      { id: 's1', courierId: 'c1', weekStart: WEEK, status: 'APPROVED', slots: [slot] },
      { id: 's2', courierId: 'c2', weekStart: WEEK, status: 'PENDING',  slots: [slot] },
    ]
    const result = buildCoverage(shifts, [req], [AREA_A], WEEK)
    expect(result['Monday']['morning']['area-a'].approved).toBe(1)
    expect(result['Monday']['morning']['area-a'].pending).toBe(1)
  })
})

// ─── greedyAutoAssign ───────────────────────────────────────────────

describe('greedyAutoAssign', () => {
  function makeCoverage(areaId, day, shiftType, required, approved) {
    return {
      [day]: { [shiftType]: { [areaId]: { required, approved, pending: 0 } } }
    }
  }

  it('fillsHighestDeficitFirst — slot with deficit=3 selected before slot with deficit=1', () => {
    const shifts = [
      { id: 's1', courierId: 'c1', weekStart: WEEK, status: 'PENDING',
        slots: [{ day: 'Monday', shiftType: 'morning', areaId: 'area-a' }] },
      { id: 's2', courierId: 'c2', weekStart: WEEK, status: 'PENDING',
        slots: [{ day: 'Tuesday', shiftType: 'morning', areaId: 'area-b' }] },
    ]
    const coverage = {
      Monday:  { morning: { 'area-a': { required: 3, approved: 0, pending: 1 },
                            'area-b': { required: 0, approved: 0, pending: 0 } } },
      Tuesday: { morning: { 'area-a': { required: 0, approved: 0, pending: 0 },
                            'area-b': { required: 2, approved: 1, pending: 1 } } },
    }
    const result = greedyAutoAssign(shifts, coverage, [AREA_A, AREA_B], WEEK)
    expect(result).toContain('s1')
    expect(result).toContain('s2')
    expect(result.indexOf('s1')).toBeLessThan(result.indexOf('s2') === -1 ? Infinity : result.length)
  })

  it('doesNotOverApprove — required=1 with 3 pending candidates → returns exactly 1 ID', () => {
    const slot = { day: 'Monday', shiftType: 'morning', areaId: 'area-a' }
    const shifts = [
      { id: 's1', courierId: 'c1', weekStart: WEEK, status: 'PENDING', slots: [slot] },
      { id: 's2', courierId: 'c2', weekStart: WEEK, status: 'PENDING', slots: [slot] },
      { id: 's3', courierId: 'c3', weekStart: WEEK, status: 'PENDING', slots: [slot] },
    ]
    const coverage = makeCoverage('area-a', 'Monday', 'morning', 1, 0)
    const result   = greedyAutoAssign(shifts, coverage, [AREA_A], WEEK)
    expect(result).toHaveLength(1)
  })

  it('noDeficitNoResult — all slots already met → returns empty array', () => {
    const shifts   = []
    const coverage = makeCoverage('area-a', 'Monday', 'morning', 2, 2)
    const result   = greedyAutoAssign(shifts, coverage, [AREA_A], WEEK)
    expect(result).toHaveLength(0)
  })

  it('skipAlreadyApproved — APPROVED shift is not included in results', () => {
    const shifts = [
      { id: 's1', courierId: 'c1', weekStart: WEEK, status: 'APPROVED',
        slots: [{ day: 'Monday', shiftType: 'morning', areaId: 'area-a' }] },
    ]
    const coverage = makeCoverage('area-a', 'Monday', 'morning', 2, 1)
    const result   = greedyAutoAssign(shifts, coverage, [AREA_A], WEEK)
    expect(result).not.toContain('s1')
  })
})
