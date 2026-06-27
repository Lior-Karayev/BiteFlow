# BiteFlow — Staff Web Portal

Smart food delivery platform — management web portal for SE322 (Software Intensive Systems Engineering), Kinneret College, Semester B 5786.

**Live demo:** https://biteflow-46d12.web.app

## Team

| Name | ID |
|---|---|
| Lior Karayev | — |
| Adir Adri | — |
| Daniel Ben-Nafushi | — |

## What this covers

Four staff portals, each mapped to a System Use Case (SUC):

| Portal | SUC | Actor |
|---|---|---|
| Call Center | SUC-1 | Call Center Agent |
| Delivery Ops | SUC-6, SUC-10 | Delivery Ops Manager |
| Business Management | SUC-7 | Business Manager |
| Account Manager | SUC-8 | Account Manager |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router 7 |
| Database | Firebase Firestore (real-time) |
| Hosting | Firebase Hosting |
| Maps | Google Maps JavaScript API v2 |
| Tests | Vitest |

## Run locally

### Prerequisites

- Node.js 18+
- A Firebase project — use the live demo at https://biteflow-46d12.web.app, or set up your own (see `.env.example`)
- *(Optional)* A Google Maps API key for the Delivery Ops heatmap

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/Lior-Karayev/BiteFlow.git
cd BiteFlow

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and fill in your Firebase project values and (optionally) Google Maps key

# 4. Start the dev server
npm run dev
```

The app runs at `http://localhost:5173`.

## Run unit tests

```bash
npx vitest run
```

Tests are in `src/lib/scheduleAlgorithms.test.js` and cover the three pure scheduling algorithm functions (`computeAreaLoad`, `buildCoverage`, `greedyAutoAssign`).

## Build & deploy

```bash
npm run build          # produces dist/
firebase deploy --only hosting
```

## Project structure

```
src/
├── constants/         # Shared shift types, days, week helpers
├── firebase/
│   ├── config.js      # Firebase project config
│   ├── db.js          # All Firestore read/write functions
│   └── seed.js        # Demo data seeder
├── lib/
│   ├── scheduleAlgorithms.js       # Pure scheduling logic (unit-tested)
│   └── scheduleAlgorithms.test.js  # Vitest unit tests
├── pages/
│   ├── CallCenter/    # SUC-1: Phone order portal
│   ├── DeliveryOps/   # SUC-6 + SUC-10: Shift scheduling + heatmap
│   │   ├── OS.jsx     # OpsScheduler — data & logic layer (<<assembly>>)
│   │   └── DOC.jsx    # DeliveryOpsClient — UI layer
│   ├── BusinessManagement/  # SUC-7: Menu & profile management
│   └── AccountManager/      # SUC-8: Business onboarding
└── styles/            # Global CSS
```

## Notes

- All credentials are loaded from `.env` (gitignored). Copy `.env.example` → `.env` and fill in your values to run locally.
- Security is enforced via Firestore Rules (`firestore.rules`) — not by keeping Firebase config secret.
- The live demo at https://biteflow-46d12.web.app uses the project's own Firebase instance. No local setup is needed to view it.
