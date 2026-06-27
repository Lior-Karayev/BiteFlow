/**
 * BiteFlow — Firestore Schema Migration
 * Adds 4 new collections: deliveryRoutes, courierLocations, notifications, kpiSnapshots
 * Does NOT modify or delete existing documents.
 * Run: node migrate.mjs
 */
import { initializeApp } from 'firebase/app'
import {
  getFirestore, collection, addDoc, getDocs, query,
  orderBy, limit, serverTimestamp, Timestamp,
} from 'firebase/firestore'

const app = initializeApp({
  apiKey:            'AIzaSyB-wisPJFwq7AH2ixMy8fHN9_L_LsLOzoE',
  authDomain:        'biteflow-46d12.firebaseapp.com',
  projectId:         'biteflow-46d12',
  storageBucket:     'biteflow-46d12.firebasestorage.app',
  messagingSenderId: '924442096212',
  appId:             '1:924442096212:web:3267922839bfe6c90fb3c1',
})
const db = getFirestore(app)

async function getFirst(col) {
  const snap = await getDocs(query(collection(db, col), orderBy('createdAt', 'asc'), limit(1)))
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
}

async function migrate() {
  console.log('BiteFlow Firestore Migration — adding new collections\n')

  // Pull existing references
  const courier = await getFirst('couriers')
  const order   = await getFirst('orders')
  const customer = await getFirst('customers')

  if (!courier) { console.warn('⚠ No couriers found — skipping route/location seeding'); }
  if (!order)   { console.warn('⚠ No orders found — skipping route/notification seeding'); }

  // ── 1. deliveryRoutes ─────────────────────────────────────────
  console.log('Adding deliveryRoutes...')
  const routeRef = await addDoc(collection(db, 'deliveryRoutes'), {
    courierId:             courier?.id  ?? 'sample_courier_id',
    orderIds:              [order?.id   ?? 'sample_order_id'],
    stops: [
      {
        orderId:  order?.id ?? 'sample_order_id',
        address:  order?.deliveryAddress ?? '12 HaYarkon St, Tel Aviv',
        lat:      32.0853,
        lng:      34.7818,
        status:   'pending',
        eta:      Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000)),
      },
    ],
    currentStopIndex:      0,
    totalEstimatedMinutes: 30,
    status:                'active',
    createdAt:             serverTimestamp(),
    updatedAt:             serverTimestamp(),
  })
  console.log(`  ✓ deliveryRoutes/${routeRef.id}`)

  // ── 2. courierLocations ───────────────────────────────────────
  console.log('Adding courierLocations...')
  for (const [lat, lng] of [[32.0853, 34.7818], [32.0860, 34.7825], [32.0870, 34.7833]]) {
    const locRef = await addDoc(collection(db, 'courierLocations'), {
      courierId:  courier?.id ?? 'sample_courier_id',
      lat,
      lng,
      orderId:    order?.id ?? 'sample_order_id',
      recordedAt: serverTimestamp(),
    })
    console.log(`  ✓ courierLocations/${locRef.id}`)
  }

  // ── 3. notifications ──────────────────────────────────────────
  console.log('Adding notifications...')
  const notifSamples = [
    {
      targetId:   customer?.phone ?? '0521234567',
      targetType: 'customer',
      message:    'Your order has been picked up by the courier.',
      type:       'order_ready',
      orderId:    order?.id ?? 'sample_order_id',
      read:       false,
    },
    {
      targetId:   courier?.id ?? 'sample_courier_id',
      targetType: 'courier',
      message:    'Your shift for Sunday 08:00–16:00 has been approved.',
      type:       'shift_approved',
      orderId:    null,
      read:       false,
    },
    {
      targetId:   customer?.phone ?? '0521234567',
      targetType: 'customer',
      message:    'We are missing an ingredient in your order. A credit of ₪15 has been applied.',
      type:       'shortage_alert',
      orderId:    order?.id ?? 'sample_order_id',
      read:       false,
    },
  ]
  for (const n of notifSamples) {
    const nRef = await addDoc(collection(db, 'notifications'), {
      ...n, createdAt: serverTimestamp(),
    })
    console.log(`  ✓ notifications/${nRef.id} [${n.type}]`)
  }

  // ── 4. kpiSnapshots ───────────────────────────────────────────
  console.log('Adding kpiSnapshots...')
  const kpiSamples = [
    {
      type:   'daily',
      period: '2026-06-25',
      data: {
        totalOrders:         47,
        avgPrepTimeMin:      18,
        avgDeliveryTimeMin:  34,
        lateDeliveries:      3,
        cancelledOrders:     2,
        totalRevenue:        3820,
        avgRating:           4.3,
      },
    },
    {
      type:   'weekly',
      period: '2026-W26',
      data: {
        totalOrders:         312,
        avgPrepTimeMin:      17,
        avgDeliveryTimeMin:  32,
        lateDeliveries:      19,
        cancelledOrders:     11,
        totalRevenue:        24580,
        avgRating:           4.4,
      },
    },
  ]
  for (const k of kpiSamples) {
    const kRef = await addDoc(collection(db, 'kpiSnapshots'), {
      ...k, generatedAt: serverTimestamp(),
    })
    console.log(`  ✓ kpiSnapshots/${kRef.id} [${k.type} ${k.period}]`)
  }

  console.log('\n✅ Migration complete. New collections added:')
  console.log('   deliveryRoutes, courierLocations, notifications, kpiSnapshots')
  process.exit(0)
}

migrate().catch(e => { console.error('Migration failed:', e); process.exit(1) })
