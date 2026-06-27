import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { initializeApp } from 'firebase/app'
import {
  getFirestore, collection, addDoc, setDoc, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore'

// Load .env (same file used by Vite — VITE_* prefix)
try {
  const root = dirname(fileURLToPath(import.meta.url))
  for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^([^#\s][^=]*)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
} catch { /* no .env — fall back to already-set env vars */ }

const app = initializeApp({
  apiKey:            process.env.VITE_FIREBASE_API_KEY,
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.VITE_FIREBASE_APP_ID,
})
const db = getFirestore(app)

// Mirrors the ownerDocId() helper in db.js
function ownerDocId(email) {
  return email.toLowerCase().replace(/@/, '__').replace(/\./g, '_')
}

async function seed() {
  console.log('Seeding Firestore with clean schema…\n')

  // ── Step 1: Create restaurants (no owner data embedded) ──────
  const r1 = await addDoc(collection(db, 'restaurants'), {
    name: 'Burger Palace', address: '12 HaYarkon St, Tel Aviv',
    phone: '03-5551234', active: true, createdAt: serverTimestamp(),
  })
  const r2 = await addDoc(collection(db, 'restaurants'), {
    name: 'Pizza Roma', address: '7 Ben Gurion Blvd, Haifa',
    phone: '04-8889876', active: true, createdAt: serverTimestamp(),
  })
  console.log('restaurants:', r1.id, r2.id)

  // ── Step 2: Create owners referencing their restaurant ────────
  const pass1 = 'BiteFlow@BP01'
  const pass2 = 'BiteFlow@PR01'

  await setDoc(doc(db, 'owners', ownerDocId('burger@biteflow.app')), {
    email: 'burger@biteflow.app', name: 'Moshe Burger', phone: '0521000001',
    restaurantId: r1.id, password: pass1,
    mustChangePassword: true, createdAt: serverTimestamp(),
  })
  await setDoc(doc(db, 'owners', ownerDocId('pizza@biteflow.app')), {
    email: 'pizza@biteflow.app', name: 'Gino Roma', phone: '0521000002',
    restaurantId: r2.id, password: pass2,
    mustChangePassword: true, createdAt: serverTimestamp(),
  })
  console.log('owners created')

  // ── Step 3: Write ownerId back into each restaurant ───────────
  await updateDoc(doc(db, 'restaurants', r1.id), { ownerId: ownerDocId('burger@biteflow.app') })
  await updateDoc(doc(db, 'restaurants', r2.id), { ownerId: ownerDocId('pizza@biteflow.app') })
  console.log('restaurants updated with ownerId')

  // ── Global ingredient catalog ─────────────────────────────────
  const gi = {}
  for (const name of [
    'Beef Patty', 'Lettuce', 'Tomato', 'Cheddar Cheese', 'Pickles',
    'Pizza Dough', 'Tomato Sauce', 'Mozzarella', 'Pepperoni', 'Basil',
  ]) {
    const ref = await addDoc(collection(db, 'ingredients'), {
      name, nameLower: name.toLowerCase(), createdAt: serverTimestamp(),
    })
    gi[name] = ref.id
  }
  console.log('global ingredients seeded')

  // ── Restaurant inventory (restaurantIngredients) ───────────────
  const inv = {}
  for (const [name, restaurantId, available] of [
    ['Beef Patty',     r1.id, true ],
    ['Lettuce',        r1.id, true ],
    ['Tomato',         r1.id, true ],
    ['Cheddar Cheese', r1.id, true ],
    ['Pickles',        r1.id, false],
    ['Pizza Dough',    r2.id, true ],
    ['Tomato Sauce',   r2.id, true ],
    ['Mozzarella',     r2.id, true ],
    ['Pepperoni',      r2.id, true ],
    ['Basil',          r2.id, false],
  ]) {
    const ref = await addDoc(collection(db, 'restaurantIngredients'), {
      restaurantId, ingredientId: gi[name], ingredientName: name,
      available, createdAt: serverTimestamp(),
    })
    inv[`${restaurantId}:${name}`] = ref.id
  }
  console.log('restaurant inventory seeded')

  // ── Menu items (ingredientIds → global ingredient IDs) ────────
  await addDoc(collection(db, 'menuItems'), {
    restaurantId: r1.id, name: 'Classic Burger', price: 52,
    description: 'Beef patty, lettuce, tomato, pickles',
    ingredientIds: [gi['Beef Patty'], gi['Lettuce'], gi['Tomato'], gi['Pickles']],
    createdAt: serverTimestamp(),
  })
  await addDoc(collection(db, 'menuItems'), {
    restaurantId: r1.id, name: 'Cheese Burger', price: 58,
    description: 'Double cheddar, caramelised onions',
    ingredientIds: [gi['Beef Patty'], gi['Cheddar Cheese']],
    createdAt: serverTimestamp(),
  })
  await addDoc(collection(db, 'menuItems'), {
    restaurantId: r2.id, name: 'Margherita Pizza', price: 68,
    description: 'Tomato sauce, mozzarella, basil',
    ingredientIds: [gi['Pizza Dough'], gi['Tomato Sauce'], gi['Mozzarella'], gi['Basil']],
    createdAt: serverTimestamp(),
  })
  await addDoc(collection(db, 'menuItems'), {
    restaurantId: r2.id, name: 'Pepperoni Pizza', price: 78,
    description: 'Spicy pepperoni, extra cheese',
    ingredientIds: [gi['Pizza Dough'], gi['Tomato Sauce'], gi['Mozzarella'], gi['Pepperoni']],
    createdAt: serverTimestamp(),
  })
  console.log('menu items seeded')

  // ── Customers ─────────────────────────────────────────────────
  const c1 = await addDoc(collection(db, 'customers'), { name: 'Yossi Cohen', phone: '0521234567', createdAt: serverTimestamp() })
  const c2 = await addDoc(collection(db, 'customers'), { name: 'Dana Levi',   phone: '0537654321', createdAt: serverTimestamp() })
  const c3 = await addDoc(collection(db, 'customers'), { name: 'Avi Mizrahi', phone: '0549876543', createdAt: serverTimestamp() })
  console.log('customers seeded')

  // ── Couriers ──────────────────────────────────────────────────
  const cr1 = await addDoc(collection(db, 'couriers'), { name: 'Rami Peretz', phone: '0501112233', available: true })
  const cr2 = await addDoc(collection(db, 'couriers'), { name: 'Shira Katz',  phone: '0524445566', available: false })
  console.log('couriers seeded')

  // ── Shifts ────────────────────────────────────────────────────
  await addDoc(collection(db, 'shifts'), {
    courierId: cr1.id, date: '2026-06-25', startTime: '10:00', endTime: '18:00',
    status: 'PENDING', createdAt: serverTimestamp(),
  })
  await addDoc(collection(db, 'shifts'), {
    courierId: cr2.id, date: '2026-06-26', startTime: '14:00', endTime: '22:00',
    status: 'APPROVED', createdAt: serverTimestamp(),
  })
  console.log('shifts seeded')

  // ── Orders ────────────────────────────────────────────────────
  await addDoc(collection(db, 'orders'), {
    customerId: c1.id, customerName: 'Yossi Cohen',
    restaurantId: r1.id, restaurantName: 'Burger Palace',
    channel: 'APP', status: 'DELIVERED', total: 110, createdAt: serverTimestamp(),
  })
  await addDoc(collection(db, 'orders'), {
    customerId: c2.id, customerName: 'Dana Levi',
    restaurantId: r2.id, restaurantName: 'Pizza Roma',
    channel: 'PHONE', status: 'IN_PREP', total: 78, createdAt: serverTimestamp(),
  })
  await addDoc(collection(db, 'orders'), {
    customerId: c3.id, customerName: 'Avi Mizrahi',
    restaurantId: r1.id, restaurantName: 'Burger Palace',
    channel: 'APP', status: 'PENDING', total: 52, createdAt: serverTimestamp(),
  })
  console.log('orders seeded')

  console.log('\n✅ Done!')
  console.log('\nDemo logins (temp password — will be forced to change):')
  console.log(`  burger@biteflow.app  /  ${pass1}`)
  console.log(`  pizza@biteflow.app   /  ${pass2}`)
  process.exit(0)
}

seed().catch(e => { console.error(e); process.exit(1) })
