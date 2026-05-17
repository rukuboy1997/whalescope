import { onUnmounted, ref } from "vue";
import type { SSEInitEvent, SSEWhaleEvent, SSEPriceEvent, Whale, PricePoint } from "@/types";
import { parseSSEData } from "@/utils/validators";
import { useWhaleStore } from "@/stores/whaleStore";
import { whaleDB } from "@/utils/db";

const BASE_DELAY = 1000;
const MAX_DELAY = 30_000;
const MAX_ATTEMPTS = 10;
const DB_CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const DB_SAVE_BATCH_MS = 5_000;                 // batch IndexedDB writes every 5s

export function useWhaleStream() {
    const store = useWhaleStore();
    const reconnectAttempts = ref(0);
    const isLoadingHistory = ref(false);

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cleanupTimer: ReturnType<typeof setInterval> | null = null;
    let dbSaveTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingWhales: Whale[] = [];
    let pendingPrices: PricePoint[] = [];
    let isDestroyed = false;

    function getApiUrl(): string {
        const env = import.meta.env.VITE_API_URL as string | undefined;
        return env && env !== "" ? env : "http://localhost:5000";
    }

    // ── IndexedDB helpers ─────────────────────────────────────────────────

    async function openDB() {
        try {
            await whaleDB.open();
        } catch (err) {
            console.warn("[DB] IndexedDB unavailable:", err);
        }
    }

    /** Step 1: load from IndexedDB immediately — instant stale-while-revalidate */
    async function loadFromIndexedDB() {
        try {
            const [cachedWhales, cachedPrices] = await Promise.all([
                whaleDB.getWhales(),
                whaleDB.getPrices(),
            ]);
            if (cachedWhales.length > 0 || cachedPrices.length > 0) {
                store.loadFromCache({ whales: cachedWhales, prices: cachedPrices });
                console.log(`[DB] Loaded ${cachedWhales.length} whales, ${cachedPrices.length} prices from IndexedDB`);
            }
        } catch (err) {
            console.warn("[DB] Failed to load from IndexedDB:", err);
        }
    }

    /** Step 2: fetch full 24h history from the API and merge (server is authoritative) */
    async function fetchServerHistory() {
        isLoadingHistory.value = true;
        try {
            const res = await fetch(`${getApiUrl()}/history?whales=1000&prices=1000`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            store.mergeServerHistory({
                whales: data.whales ?? [],
                prices: data.prices ?? [],
                stats: data.stats,
            });
            // Persist the authoritative data to IndexedDB
            await Promise.all([
                whaleDB.replaceWhales(store.whales),
                whaleDB.replacePrices(store.priceHistory),
            ]);
            console.log(`[DB] Server history synced: ${data.whales?.length ?? 0} whales, ${data.prices?.length ?? 0} prices`);
        } catch (err) {
            console.warn("[DB] History fetch failed:", err);
        } finally {
            isLoadingHistory.value = false;
        }
    }

    /** Batched write to IndexedDB — called after new SSE events */
    function scheduleDBSave(whale?: Whale, price?: { time: number; price: number }) {
        if (whale) pendingWhales.push(whale);
        if (price) pendingPrices.push({ time: price.time, price: price.price });

        if (dbSaveTimer) return;
        dbSaveTimer = setTimeout(async () => {
            dbSaveTimer = null;
            const toSaveWhales = pendingWhales.splice(0);
            const toSavePrices = pendingPrices.splice(0);
            try {
                await Promise.all([
                    toSaveWhales.length > 0 ? whaleDB.addWhales(toSaveWhales) : Promise.resolve(),
                    toSavePrices.length > 0 ? whaleDB.addPrices(toSavePrices) : Promise.resolve(),
                ]);
            } catch (err) {
                console.warn("[DB] Batch save failed:", err);
            }
        }, DB_SAVE_BATCH_MS);
    }

    function startPeriodicCleanup() {
        cleanupTimer = setInterval(async () => {
            try {
                await whaleDB.cleanup();
                const counts = await whaleDB.getStoreCounts();
                console.log(`[DB] Cleanup done — ${counts.whales} whales, ${counts.prices} prices remain`);
            } catch (err) {
                console.warn("[DB] Cleanup failed:", err);
            }
        }, DB_CLEANUP_INTERVAL_MS);
    }

    // ── SSE helpers ───────────────────────────────────────────────────────

    function clearReconnectTimer() {
        if (reconnectTimer !== null) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    }

    function closeEventSource() {
        if (eventSource) { eventSource.close(); eventSource = null; }
    }

    function scheduleReconnect() {
        if (isDestroyed) return;
        if (reconnectAttempts.value >= MAX_ATTEMPTS) { store.setConnectionStatus("error"); return; }
        const delay = Math.min(BASE_DELAY * 2 ** reconnectAttempts.value, MAX_DELAY);
        reconnectAttempts.value++;
        store.setConnectionStatus("disconnected");
        reconnectTimer = setTimeout(() => {
            if (!isDestroyed && !store.isPaused) connectSSE();
        }, delay);
    }

    function handleMessage(event: MessageEvent) {
        if (store.isPaused) return;
        const parsed = parseSSEData(event.data);
        if (!parsed) return;

        switch (parsed.type) {
            case "init": {
                const e = parsed as SSEInitEvent;
                store.initData({ stats: e.stats, whales: e.whales, priceHistory: e.priceHistory });
                break;
            }
            case "whale": {
                const e = parsed as SSEWhaleEvent;
                store.addWhale(e.whale, e.stats);
                scheduleDBSave(e.whale, undefined);
                break;
            }
            case "price": {
                const e = parsed as SSEPriceEvent;
                store.addPrice(e.time, e.price);
                scheduleDBSave(undefined, { time: e.time, price: e.price });
                break;
            }
            case "heartbeat": {
                store.setLastHeartbeat(Date.now());
                break;
            }
        }
    }

    function connectSSE() {
        if (isDestroyed) return;
        clearReconnectTimer();
        closeEventSource();
        store.setConnectionStatus("connecting");

        try {
            const url = `${getApiUrl()}/stream`;
            eventSource = new EventSource(url);

            eventSource.onopen = () => {
                if (isDestroyed) { closeEventSource(); return; }
                store.setConnectionStatus("connected");
                reconnectAttempts.value = 0;
            };
            eventSource.onmessage = handleMessage;
            eventSource.onerror = () => { closeEventSource(); scheduleReconnect(); };
        } catch {
            scheduleReconnect();
        }
    }

    // ── Public connect ────────────────────────────────────────────────────

    /**
     * Full startup sequence:
     * 1. Open IndexedDB
     * 2. Load stale cache → show data immediately
     * 3. Fetch fresh 24h history from API → merge & update cache
     * 4. Subscribe to SSE → live updates
     * 5. Start periodic FIFO cleanup
     */
    async function connect() {
        if (isDestroyed) return;
        await openDB();
        await loadFromIndexedDB();   // instant — stale data shown right away
        connectSSE();                // live stream starts in parallel with history fetch
        await fetchServerHistory();  // fills in full 24h history
        startPeriodicCleanup();
    }

    function disconnect() {
        clearReconnectTimer();
        closeEventSource();
        store.setConnectionStatus("disconnected");
    }

    function pause() { store.setIsPaused(true); }

    function resume() {
        store.setIsPaused(false);
        if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
            reconnectAttempts.value = 0;
            connectSSE();
        }
    }

    function togglePause() {
        if (store.isPaused) resume(); else pause();
    }

    onUnmounted(() => {
        isDestroyed = true;
        disconnect();
        if (cleanupTimer) clearInterval(cleanupTimer);
        if (dbSaveTimer) clearTimeout(dbSaveTimer);
    });

    return { connect, disconnect, pause, resume, togglePause, reconnectAttempts, isLoadingHistory };
}
