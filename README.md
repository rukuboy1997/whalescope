# 🐋 WhaleScope Radar

A real-time whale trade monitoring and visualization dashboard for the [Pacifica](https://pacifica.fi) perpetuals exchange. Detects large-scale BTC trades ("whales") via WebSocket streaming and visualizes them live in a high-performance Vue 3 dashboard.

---

## 🚀 Live Demo

- **Frontend (Vercel):** _Deploy the `/frontend` folder to Vercel_
- **Backend (Render/Railway):** _Deploy the root folder as a Node.js service_

---

## 🏗️ Architecture

```
whalescope-radar/
├── index.js              # Express API + WebSocket client (backend)
├── package.json          # Backend dependencies
└── frontend/             # Vue 3 + Vite + TypeScript dashboard
    ├── src/
    │   ├── App.vue                          # Root component + layout
    │   ├── main.ts                          # App entry, ECharts registration
    │   ├── assets/main.css                  # Tailwind + custom styles
    │   ├── types/index.ts                   # TypeScript interfaces
    │   ├── stores/whaleStore.ts             # Pinia state management
    │   ├── composables/useWhaleStream.ts    # SSE connection + reconnection
    │   ├── utils/
    │   │   ├── formatters.ts               # Currency, time, severity helpers
    │   │   └── validators.ts               # Payload schema validation
    │   └── components/
    │       ├── layout/AppHeader.vue
    │       ├── dashboard/
    │       │   ├── MetricCard.vue
    │       │   ├── ActivityFeed.vue
    │       │   ├── DashboardControls.vue
    │       │   └── WindowStatsCard.vue
    │       └── charts/
    │           ├── PriceLineChart.vue       # BTC price over time (line)
    │           ├── VolumeAreaChart.vue      # Long vs Short volume (area)
    │           ├── WhaleBarChart.vue        # Whale count per bucket (bar)
    │           └── SentimentRadarChart.vue  # Market metrics (radar)
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.js
    └── vercel.json
```

---

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+
- npm 9+

### Backend

```bash
# Install dependencies
npm install

# Start the server (connects to wss://ws.pacifica.fi/ws automatically)
npm start
```

The API will be available at `http://localhost:5000`.

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env and set VITE_API_URL to your backend URL

# Start dev server
npm run dev
```

The dashboard will be available at `http://localhost:5173`.

### Production build

```bash
cd frontend
npm run build
# Output is in frontend/dist/
```

---

## 🌐 Deployment

### Frontend → Vercel

1. Push the repository to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your repository
4. Set **Root Directory** to `frontend`
5. Add environment variable: `VITE_API_URL=https://your-backend.railway.app`
6. Deploy

### Backend → Railway / Render

**Railway:**
```
Start command: npm start
```

**Render:**
```
Build command: npm install
Start command: npm start
```

Set `PORT` environment variable if needed (defaults to 5000).

---

## 📡 Data Streaming Approach

The system uses a two-layer streaming architecture:

1. **Backend ← Pacifica**: WebSocket (`wss://ws.pacifica.fi/ws`) subscribes to the `trades` channel for BTC. All trade messages are processed server-side.

2. **Backend → Frontend**: Server-Sent Events (SSE) via `GET /stream`. The backend maintains a list of connected SSE clients and broadcasts three event types:
   - `init` — full snapshot on connection (stats + last 50 whales + price history)
   - `whale` — emitted whenever a trade ≥ $10,000 is detected
   - `price` — throttled BTC price tick (every 10th trade)
   - `heartbeat` — keep-alive ping every 25s

SSE was chosen over WebSockets for the client-server connection because:
- It works seamlessly with Vercel's Edge Network
- Native browser reconnection support
- Simpler mental model for one-directional push

---

## 🗂️ State Management Strategy

**Pinia** is used as the centralized state store (`src/stores/whaleStore.ts`).

The store is divided into:
- **Raw state**: `whales[]`, `priceHistory[]`, `stats`, `connectionStatus`
- **UI state**: `timeRange`, `isDarkMode`, `isPaused`, `sideFilter`, `minValueFilter`
- **Computed/derived**: `filteredWhales`, `windowStats`, `timeBuckets`, `radarData`, `priceChartData`

All chart data is computed from the raw whale/price history based on the selected time range, preventing redundant data copies. State mutations only happen through store actions, never directly in components.

---

## ⚡ Rendering Optimization Decisions

| Technique | Implementation |
|-----------|---------------|
| **Tree-shaking** | ECharts modules imported individually (`use([LineChart, BarChart, ...])`), reducing bundle by ~60% |
| **Code splitting** | Vite `manualChunks` splits `echarts` and `vue/pinia` into separate chunks for caching |
| **Throttled updates** | Price broadcasts fire every 10th trade tick, not every tick |
| **Data sampling** | Price chart caps at 200 rendered points regardless of history size (LTTB-style) |
| **`animation: false`** | Line chart skips entrance animation on data updates for perceived smoothness |
| **SSE over polling** | Push-based eliminates wasteful polling intervals |
| **Computed memoization** | All derived chart data uses Vue's `computed()` — only recalculates when dependencies change |
| **`TransitionGroup`** | Activity feed uses Vue's FLIP-based list transitions instead of JS animation loops |
| **Memory limits** | Backend caps whale history at 200 items, price history at 500; store mirrors these caps |
| **Cleanup** | `onUnmounted` in `useWhaleStream` closes EventSource and clears all timers |

---

## 🔒 Security & Resilience

- **Payload validation**: All incoming SSE data is validated via `validators.ts` before touching the store
- **Schema checks**: `isValidWhale`, `isValidStats`, `isValidPricePoint` verify types and value ranges
- **String sanitization**: `sanitizeString()` escapes HTML entities to prevent XSS
- **Reconnection backoff**: Exponential backoff (1s → 2s → 4s … → 30s max, 10 attempts)
- **Memory leak prevention**: EventSource, heartbeat intervals, and reconnect timers all cleaned up on component unmount
- **Error boundaries**: WebSocket parse errors are caught server-side; SSE parse errors return `null` and are ignored

---

## ⚖️ Trade-offs Made

| Decision | Trade-off |
|----------|-----------|
| SSE instead of WebSocket (client) | Simpler, Vercel-compatible, but one-directional only |
| ECharts over Recharts/D3 | Better performance for real-time, but larger bundle |
| Pinia over Zustand/Redux | Vue-native, simpler DX; not React-portable |
| Time buckets computed client-side | Reduces API complexity; re-computed on every time-range change |
| No virtualization on activity feed | Capped at 80 rendered rows — acceptable for this dataset size |
| Single WebSocket subscription (BTC only) | Simpler; multi-symbol would require a subscription manager |

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vue 3 (Composition API) |
| Language | TypeScript |
| Build | Vite 6 |
| State | Pinia |
| Charts | Apache ECharts + vue-echarts |
| Styling | Tailwind CSS v3 |
| Backend | Node.js + Express 5 |
| Streaming | WebSocket (ws) ↔ Server-Sent Events |
