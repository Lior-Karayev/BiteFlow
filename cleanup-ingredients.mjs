import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore'

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

async function cleanup() {
  const snap = await getDocs(collection(db, 'ingredients'))
  const old  = snap.docs.filter(d => d.data().restaurantId !== undefined)
  console.log(`Found ${old.length} legacy ingredient doc(s) to delete`)
  for (const d of old) {
    await deleteDoc(doc(db, 'ingredients', d.id))
    console.log(`  Deleted: "${d.data().name}" (${d.id})`)
  }
  console.log('\nDone!')
  process.exit(0)
}

cleanup().catch(e => { console.error(e); process.exit(1) })
