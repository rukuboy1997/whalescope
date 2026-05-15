import express from "express";
import WebSocket from "ws";
import cors from "cors";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

/* =========================
   STATE
========================= */

let whaleLongVolume = 0;
let whaleShortVolume = 0;
let whaleCount = 0;
let biggestWhale = 0;
let whaleHistory = [];
let priceHistory = [];
let currentPrice = 0;

const WHALE_THRESHOLD = 10000;
const MAX_WHALES = 200;
const MAX_PRICES = 500;

/* =========================
   SSE CLIENT MANAGEMENT
========================= */

let sseClients = [];

function broadcast(data) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    const dead = [];
    sseClients.forEach((client) => {
        try {
            client.res.write(payload);
        } catch {
            dead.push(client.id);
        }
    });
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
    return {
        whaleCount,
        whaleLongVolume,
        whaleShortVolume,
        biggestWhale,
        sentiment,
        currentPrice,
    };
}

function getWindowStats(minutes) {
    const now = Date.now();
    const windowStart = now - minutes * 60 * 1000;
    let longVolume = 0;
    let shortVolume = 0;
    let count = 0;
    whaleHistory.forEach((whale) => {
        if (whale.time >= windowStart) {
            count++;
            if (whale.side === "LONG") longVolume += whale.value;
            if (whale.side === "SHORT") shortVolume += whale.value;
        }
    });
    let sentiment = "NEUTRAL";
    if (longVolume > shortVolume) sentiment = "BULLISH";
    if (shortVolume > longVolume) sentiment = "BEARISH";
    return { count, longVolume, shortVolume, sentiment };
}

/* =========================
   API ENDPOINTS
========================= */

app.get("/", (req, res) => {
    res.json({ status: "ok", name: "WhaleScope Radar API", version: "2.0.0" });
});

app.get("/stats", (req, res) => {
    res.json(getStats());
});

app.get("/whales", (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 200);
    res.json({ count: whaleHistory.length, whales: whaleHistory.slice(0, limit) });
});

app.get("/price-history", (req, res) => {
    res.json({ count: priceHistory.length, prices: priceHistory });
});

app.get("/window/:minutes", (req, res) => {
    const minutes = parseInt(req.params.minutes);
    if (!minutes || minutes <= 0 || minutes > 1440) {
        return res.status(400).json({ error: "Invalid minutes value (1–1440)" });
    }
    const stats = getWindowStats(minutes);
    res.json({ window: `${minutes} minutes`, ...stats });
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

    // Send initial state immediately
    const initPayload = {
        type: "init",
        stats: getStats(),
        whales: whaleHistory.slice(0, 50),
        priceHistory: priceHistory.slice(-100),
    };
    res.write(`data: ${JSON.stringify(initPayload)}\n\n`);

    const clientId = Date.now() + Math.random();
    sseClients.push({ id: clientId, res });

    // Heartbeat every 25s to prevent proxy timeouts
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

        ws.send(
            JSON.stringify({
                method: "subscribe",
                params: { source: "trades", symbol: "BTC" },
            }),
        );

        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ method: "ping" }));
            }
        }, 20000);
    });

    ws.on("message", (data) => {
        try {
            const msg = JSON.parse(data.toString());

            if (msg.channel === "trades" && Array.isArray(msg.data)) {
                msg.data.forEach((trade) => {
                    const amount = parseFloat(trade.a);
                    const price = parseFloat(trade.p);
                    if (isNaN(amount) || isNaN(price) || amount <= 0 || price <= 0) return;

                    const value = amount * price;
                    const ts = trade.t || Date.now();

                    // Track price from ALL trades (throttled)
                    currentPrice = price;
                    priceHistory.push({ time: ts, price });
                    if (priceHistory.length > MAX_PRICES) priceHistory.shift();

                    // Broadcast price update every 10 price ticks
                    if (priceHistory.length % 10 === 0) {
                        broadcast({ type: "price", time: ts, price });
                    }

                    // Whale detection
                    if (value >= WHALE_THRESHOLD) {
                        whaleCount++;
                        if (value > biggestWhale) biggestWhale = value;

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

                        console.log(`🐋 WHALE: $${value.toLocaleString()} | ${side} | ${trade.d}`);

                        // Broadcast whale event
                        broadcast({ type: "whale", whale, stats: getStats() });
                    }
                });
            }
        } catch (err) {
            console.error("Parse error:", err.message);
        }
    });

    ws.on("close", () => {
        console.log("⚠️ WebSocket closed — reconnecting in 3s...");
        if (pingInterval) clearInterval(pingInterval);
        setTimeout(connect, 3000);
    });

    ws.on("error", (err) => {
        console.error("WebSocket error:", err.message);
    });
}

connect();

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 WhaleScope Radar API running on port ${PORT}`);
});
