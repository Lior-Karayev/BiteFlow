import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from './config'

const DEMO_COURIERS = [
  { name: 'Yossi Cohen',    phone: '050-1234567' },
  { name: 'Dana Levi',      phone: '052-7654321' },
  { name: 'Ahmed Hassan',   phone: '054-9876543' },
  { name: 'Rina Shapiro',   phone: '050-1111222' },
  { name: 'Moshe Ben-David',phone: '052-3334444' },
  { name: 'Noa Mizrahi',    phone: '054-5556666' },
  { name: 'Eli Peretz',     phone: '050-7778888' },
  { name: 'Sara Klein',     phone: '052-9990000' },
]

function nextMonday() {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? 1 : 8 - day))
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export async function seedDeliveryOpsData() {
  const areaSnap = await getDocs(collection(db, 'areas'))
  const areas = areaSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  if (areas.length === 0) throw new Error('No service areas found. Add areas in the Heatmap tab first.')

  const DAYS   = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  const SHIFTS = ['morning', 'evening']
  const weekStart = nextMonday()

  // Create couriers distributed evenly across areas
  const couriers = []
  for (let i = 0; i < DEMO_COURIERS.length; i++) {
    const area = areas[i % areas.length]
    const ref  = await addDoc(collection(db, 'couriers'), {
      ...DEMO_COURIERS[i],
      available: true,
      areaId:    area.id,
      createdAt: serverTimestamp(),
    })
    couriers.push({ id: ref.id, areaId: area.id })
  }

  // Each courier submits 2-3 pending slots for next week
  for (const courier of couriers) {
    const target = 2 + Math.floor(Math.random() * 2)
    const seen   = new Set()
    const slots  = []
    let tries    = 0
    while (slots.length < target && tries++ < 20) {
      const day       = DAYS[Math.floor(Math.random() * DAYS.length)]
      const shiftType = SHIFTS[Math.floor(Math.random() * SHIFTS.length)]
      const key       = `${day}-${shiftType}`
      if (!seen.has(key)) {
        seen.add(key)
        slots.push({ day, shiftType, areaId: courier.areaId })
      }
    }
    if (slots.length > 0) {
      await addDoc(collection(db, 'shifts'), {
        courierId: courier.id,
        weekStart,
        slots,
        status:    'PENDING',
        createdAt: serverTimestamp(),
      })
    }
  }

  return { couriersCreated: couriers.length, weekStart }
}
