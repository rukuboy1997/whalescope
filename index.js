import express from "express";
import WebSocket from "ws";
import cors from "cors";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

/* =========================
   CONSTANTS
========================= */

const WHALE_THRESHOLD = 10000;
const MAX_WHALE_AGE_MS = 24 * 60 * 60 * 1000;   // 24 hours
const MAX_PRICE_AGE_MS = 24 * 60 * 60 * 1000;   // 24 hours
const MAX_WHALES = 10000;
const MAX_PRICES = 5000;
const PRICE_SAMPLE_INTERVAL_MS = 30_000;          // store 1 price point per 30s
const DATA_DIR = "./data";
const DATA_FILE = `${DATA_DIR}/history.json`;

/* =========================
   STATE
========================= */

let whaleHistory = [];
let priceHistory = [];
let whaleLongVolume = 0;
let whaleShortVolume = 0;
let whaleCount = 0;
let biggestWhale = 0;
let currentPrice = 0;
let lastSavedPriceTime = 0;

/* =========================
   FILE PERSISTENCE (FIFO)
========================= */

function ensureDataDir() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function recalcStatsFromHistory() {
    whaleLongVolume = 0;
    whaleShortVolume = 0;
    biggestWhale = 0;
    whaleCount = whaleHistory.length;
    for (const w of whaleHistory) {
        if (w.side === "LONG") whaleLongVolume += w.value;
        if (w.side === "SHORT") whaleShortVolume += w.value;
        if (w.value > biggestWhale) biggestWhale = w.value;
    }
}

function evictOldEntries() {
    const cutoff = Date.now() - MAX_WHALE_AGE_MS;
    // FIFO: whaleHistory is newest-first, so trim from the tail
    while (whaleHistory.length > 0 && whaleHistory[whaleHistory.length - 1].time < cutoff) {
        whaleHistory.pop();
    }
    // priceHistory is oldest-first
    while (priceHistory.length > 0 && priceHistory[0].time < cutoff) {
        priceHistory.shift();
    }
    // Hard caps
    if (whaleHistory.length > MAX_WHALES) whaleHistory.length = MAX_WHALES;
    if (priceHistory.length > MAX_PRICES) priceHistory.shift();
}

function loadHistory() {
    try {
        ensureDataDir();
        if (!existsSync(DATA_FILE)) return;
        const raw = readFileSync(DATA_FILE, "utf8");
        const data = JSON.parse(raw);
        const cutoff = Date.now() - MAX_WHALE_AGE_MS;
        whaleHistory = (Array.isArray(data.whales) ? data.whales : []).filter(
            (w) => w && typeof w.time === "number" && w.time >= cutoff
        );
        priceHistory = (Array.isArray(data.prices) ? data.prices : []).filter(
            (p) => p && typeof p.time === "number" && p.time >= cutoff
        );
        recalcStatsFromHistory();
        if (priceHistory.length > 0) {
            currentPrice = priceHistory[priceHistory.length - 1].price;
            lastSavedPriceTime = priceHistory[priceHistory.length - 1].time;
        }
        console.log(
            `📂 Loaded ${whaleHistory.length} whales + ${priceHistory.length} price points from disk`
        );
    } catch (err) {
        console.error("⚠️ Failed to load history:", err.message);
    }
}

let saveTimer = null;
function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            ensureDataDir();
            writeFileSync(
                DATA_FILE,
                JSON.stringify({ whales: whaleHistory, prices: priceHistory, savedAt: Date.now() })
            );
        } catch (err) {
            console.error("⚠️ Failed to save history:", err.message);
        }
    }, 10_000);
}

// Persist price + whale data every 5 minutes regardless of whale activity
setInterval(() => {
    if (priceHistory.length > 0 || whaleHistory.length > 0) {
        scheduleSave();
    }
}, 5 * 60 * 1000);

// Evict old entries every hour and save
setInterval(() => {
    evictOldEntries();
    recalcStatsFromHistory();
    scheduleSave();
    console.log(`🧹 Eviction run: ${whaleHistory.length} whales, ${priceHistory.length} prices`);
}, 60 * 60 * 1000);

// Load on startup
loadHistory();

/* =========================
   SSE CLIENT MANAGEMENT
========================= */

let sseClients = [];

function broadcast(data) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    const dead = [];
    for (const client of sseClients) {
        try {
            client.res.write(payload);
        } catch {
            dead.push(client.id);
        }
    }
    if (dead.length > 0) {
        sseClients = sseClients.filter((c) => !dead.includes(c.id));
    }
}

/* =========================
   HELPERS
========================= */

function getStats() {
    let sentiment = "NEUTRAL";
    if (whaleLongVolume > whaleShortVolume) sentiment = "BULLISH";
    if (whaleShortVolume > whaleLongVolume) sentiment = "BEARISH";
    return { whaleCount, whaleLongVolume, whaleShortVolume, biggestWhale, sentiment, currentPrice };
}

function getWindowStats(minutes) {
    const cutoff = Date.now() - minutes * 60 * 1000;
    let longVolume = 0, shortVolume = 0, count = 0;
    for (const whale of whaleHistory) {
        if (whale.time < cutoff) break; // newest-first, stop early
        count++;
        if (whale.side === "LONG") longVolume += whale.value;
        if (whale.side === "SHORT") shortVolume += whale.value;
    }
    let sentiment = "NEUTRAL";
    if (longVolume > shortVolume) sentiment = "BULLISH";
    if (shortVolume > longVolume) sentiment = "BEARISH";
    return { count, longVolume, shortVolume, sentiment };
}

/* =========================
   API ENDPOINTS
========================= */

app.get("/", (req, res) => {
    res.json({ status: "ok", name: "WhaleScope Radar API", version: "2.1.0" });
});

app.get("/stats", (req, res) => res.json(getStats()));

app.get("/whales", (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 500, MAX_WHALES);
    res.json({ count: whaleHistory.length, whales: whaleHistory.slice(0, limit) });
});

app.get("/price-history", (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 1000, MAX_PRICES);
    res.json({ count: priceHistory.length, prices: priceHistory.slice(-limit) });
});

// Combined history endpoint — used by frontend on initial load
app.get("/history", (req, res) => {
    const whaleLimit = Math.min(parseInt(req.query.whales) || 1000, MAX_WHALES);
    const priceLimit = Math.min(parseInt(req.query.prices) || 1000, MAX_PRICES);
    res.json({
        whales: whaleHistory.slice(0, whaleLimit),
        prices: priceHistory.slice(-priceLimit),
        stats: getStats(),
        fetchedAt: Date.now(),
    });
});

app.get("/window/:minutes", (req, res) => {
    const minutes = parseInt(req.params.minutes);
    if (!minutes || minutes <= 0 || minutes > 1440) {
        return res.status(400).json({ error: "Invalid minutes value (1–1440)" });
    }
    res.json({ window: `${minutes} minutes`, ...getWindowStats(minutes) });
});

/* =========================
   SSE STREAM ENDPOINT
========================= */

app.get("/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Send a compact init snapshot (client fetches full history separately via /history)
    const initPayload = {
        type: "init",
        stats: getStats(),
        whales: whaleHistory.slice(0, 100),
        priceHistory: priceHistory.slice(-200),
    };
    res.write(`data: ${JSON.stringify(initPayload)}\n\n`);

    const clientId = Date.now() + Math.random();
    sseClients.push({ id: clientId, res });

    const heartbeat = setInterval(() => {
        try {
            res.write(`data: ${JSON.stringify({ type: "heartbeat", ts: Date.now() })}\n\n`);
        } catch {
            clearInterval(heartbeat);
        }
    }, 25000);

    req.on("close", () => {
        clearInterval(heartbeat);
        sseClients = sseClients.filter((c) => c.id !== clientId);
    });
});

/* =========================
   WEBSOCKET CONNECTION
========================= */

const wsUrl = "wss://ws.pacifica.fi/ws";
let pingInterval = null;

function connect() {
    const ws = new WebSocket(wsUrl);

    ws.on("open", () => {
        console.log("✅ Connected to Pacifica WebSocket");
        ws.send(JSON.stringify({ method: "subscribe", params: { source: "trades", symbol: "BTC" } }));
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ method: "ping" }));
        }, 20000);
    });

    ws.on("message", (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.channel !== "trades" || !Array.isArray(msg.data)) return;

            for (const trade of msg.data) {
                const amount = parseFloat(trade.a);
                const price = parseFloat(trade.p);
                if (isNaN(amount) || isNaN(price) || amount <= 0 || price <= 0) continue;

                const value = amount * price;
                const ts = trade.t || Date.now();
                currentPrice = price;

                // Time-sampled price storage (1 point per 30s)
                if (ts - lastSavedPriceTime >= PRICE_SAMPLE_INTERVAL_MS) {
                    priceHistory.push({ time: ts, price });
                    lastSavedPriceTime = ts;
                    if (priceHistory.length > MAX_PRICES) priceHistory.shift();
                    broadcast({ type: "price", time: ts, price });
                }

                // Whale detection
                if (value >= WHALE_THRESHOLD) {
                    if (value > biggestWhale) biggestWhale = value;
                    whaleCount++;

                    let side = "NEUTRAL";
                    if (trade.d === "open_long" || trade.d === "close_short") {
                        whaleLongVolume += value;
                        side = "LONG";
                    } else if (trade.d === "open_short" || trade.d === "close_long") {
                        whaleShortVolume += value;
                        side = "SHORT";
                    }

                    const whale = { time: ts, value, side, price, amount, direction: trade.d };
                    whaleHistory.unshift(whale);
                    if (whaleHistory.length > MAX_WHALES) whaleHistory.pop();

                    console.log(`🐋 WHALE: $${value.toLocaleString()} | ${side}`);
                    broadcast({ type: "whale", whale, stats: getStats() });
                    scheduleSave();
                }
            }
        } catch (err) {
            console.error("Parse error:", err.message);
        }
    });

    ws.on("close", () => {
        console.log("⚠️ Reconnecting in 3s…");
        if (pingInterval) clearInterval(pingInterval);
        setTimeout(connect, 3000);
    });

    ws.on("error", (err) => console.error("WS error:", err.message));
}

connect();

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 WhaleScope Radar API running on port ${PORT}`);
});
