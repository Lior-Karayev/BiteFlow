import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore'

const app = initializeApp({
  apiKey:            'AIzaSyB-wisPJFwq7AH2ixMy8fHN9_L_LsLOzoE',
  authDomain:        'biteflow-46d12.firebaseapp.com',
  projectId:         'biteflow-46d12',
  storageBucket:     'biteflow-46d12.firebasestorage.app',
  messagingSenderId: '924442096212',
  appId:             '1:924442096212:web:3267922839bfe6c90fb3c1',
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
