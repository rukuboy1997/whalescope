import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type {
    ConnectionStatus,
    PricePoint,
    Sentiment,
    Stats,
    TimeBucket,
    TimeRange,
    Whale,
} from "@/types";
import { isValidWhale, isValidPricePoint, isValidStats } from "@/utils/validators";

const MAX_WHALES = 10_000;
const MAX_PRICES = 5_000;

const DEFAULT_STATS: Stats = {
    whaleCount: 0,
    whaleLongVolume: 0,
    whaleShortVolume: 0,
    biggestWhale: 0,
    sentiment: "NEUTRAL",
    currentPrice: 0,
};

export const useWhaleStore = defineStore("whale", () => {
    // ── State ──────────────────────────────────────────────────────────────
    const connectionStatus = ref<ConnectionStatus>("connecting");
    const isPaused = ref(false);
    const timeRange = ref<TimeRange>(5);
    const isDarkMode = ref(true);
    const sideFilter = ref<"ALL" | "LONG" | "SHORT">("ALL");
    const minValueFilter = ref(0);
    const lastHeartbeat = ref<number>(0);
    const isHistoryLoaded = ref(false);

    const whales = ref<Whale[]>([]);
    const priceHistory = ref<PricePoint[]>([]);
    const stats = ref<Stats>({ ...DEFAULT_STATS });

    // ── Setters ───────────────────────────────────────────────────────────
    function setConnectionStatus(status: ConnectionStatus) {
        connectionStatus.value = status;
    }

    function setIsPaused(paused: boolean) {
        isPaused.value = paused;
    }

    function setTimeRange(range: TimeRange) {
        timeRange.value = range;
    }

    function toggleDarkMode() {
        isDarkMode.value = !isDarkMode.value;
        document.documentElement.classList.toggle("dark", isDarkMode.value);
    }

    function setSideFilter(filter: "ALL" | "LONG" | "SHORT") {
        sideFilter.value = filter;
    }

    function setMinValueFilter(value: number) {
        minValueFilter.value = value;
    }

    function setLastHeartbeat(ts: number) {
        lastHeartbeat.value = ts;
    }

    function setHistoryLoaded(loaded: boolean) {
        isHistoryLoaded.value = loaded;
    }

    /** Full replace — used when loading from IndexedDB cache on startup */
    function loadFromCache(data: { whales: Whale[]; prices: PricePoint[] }) {
        const validWhales = data.whales.filter(isValidWhale);
        const validPrices = data.prices.filter(isValidPricePoint);
        whales.value = validWhales.slice(0, MAX_WHALES);
        priceHistory.value = validPrices.slice(-MAX_PRICES);
        if (validPrices.length > 0) {
            stats.value = {
                ...stats.value,
                currentPrice: validPrices[validPrices.length - 1].price,
            };
        }
        isHistoryLoaded.value = true;
    }

    /**
     * Merge server history with what we already have in memory.
     * Server data is authoritative — deduplicate by time+value, keep newest entries.
     */
    function mergeServerHistory(data: {
        whales: Whale[];
        prices: PricePoint[];
        stats: Stats;
    }) {
        if (isValidStats(data.stats)) stats.value = data.stats;

        // Build a Set of existing whale fingerprints
        const existingKeys = new Set(whales.value.map((w) => `${w.time}-${w.value}`));
        const newWhales = data.whales
            .filter(isValidWhale)
            .filter((w) => !existingKeys.has(`${w.time}-${w.value}`));

        // Merge and sort newest-first, cap to MAX
        const merged = [...whales.value, ...newWhales];
        merged.sort((a, b) => b.time - a.time);
        whales.value = merged.slice(0, MAX_WHALES);

        // For prices: merge and sort oldest-first
        const existingTimes = new Set(priceHistory.value.map((p) => p.time));
        const newPrices = data.prices
            .filter(isValidPricePoint)
            .filter((p) => !existingTimes.has(p.time));

        const mergedPrices = [...priceHistory.value, ...newPrices];
        mergedPrices.sort((a, b) => a.time - b.time);
        priceHistory.value = mergedPrices.slice(-MAX_PRICES);

        isHistoryLoaded.value = true;
    }

    /** Called on SSE init — merges the server snapshot without losing existing local data */
    function initData(data: { stats: Stats; whales: Whale[]; priceHistory: PricePoint[] }) {
        mergeServerHistory({
            whales: data.whales,
            prices: data.priceHistory,
            stats: data.stats,
        });
    }

    function addWhale(whale: Whale, newStats: Stats) {
        if (!isValidWhale(whale)) return;
        if (isValidStats(newStats)) stats.value = newStats;

        // Avoid duplicates if we somehow get the same event twice
        if (whales.value.length > 0 && whales.value[0].time === whale.time && whales.value[0].value === whale.value) return;

        whales.value.unshift(whale);
        if (whales.value.length > MAX_WHALES) whales.value.pop();
    }

    function addPrice(time: number, price: number) {
        if (!isValidPricePoint({ time, price })) return;
        priceHistory.value.push({ time, price });
        if (priceHistory.value.length > MAX_PRICES) priceHistory.value.shift();
        if (stats.value.currentPrice !== price) {
            stats.value = { ...stats.value, currentPrice: price };
        }
    }

    function resetData() {
        whales.value = [];
        priceHistory.value = [];
        stats.value = { ...DEFAULT_STATS };
        isHistoryLoaded.value = false;
    }

    // ── Computed / Derived ────────────────────────────────────────────────
    const windowStartTime = computed(() => Date.now() - timeRange.value * 60 * 1000);

    const filteredWhales = computed(() => {
        const cutoff = windowStartTime.value;
        return whales.value.filter((w) => {
            if (w.time < cutoff) return false;
            if (sideFilter.value !== "ALL" && w.side !== sideFilter.value) return false;
            if (minValueFilter.value > 0 && w.value < minValueFilter.value) return false;
            return true;
        });
    });

    const windowStats = computed(() => {
        const ws = filteredWhales.value;
        let longVol = 0;
        let shortVol = 0;
        ws.forEach((w) => {
            if (w.side === "LONG") longVol += w.value;
            if (w.side === "SHORT") shortVol += w.value;
        });
        let sentiment: Sentiment = "NEUTRAL";
        if (longVol > shortVol) sentiment = "BULLISH";
        if (shortVol > longVol) sentiment = "BEARISH";
        return { count: ws.length, longVolume: longVol, shortVolume: shortVol, sentiment };
    });

    const longShortRatio = computed(() => {
        const total = windowStats.value.longVolume + windowStats.value.shortVolume;
        if (total === 0) return 50;
        return Math.round((windowStats.value.longVolume / total) * 100);
    });

    const priceChartData = computed(() => {
        const cutoff = windowStartTime.value;
        const data = priceHistory.value.filter((p) => p.time >= cutoff);
        if (data.length <= 300) return data.map((p) => [p.time, p.price]);
        const step = Math.ceil(data.length / 300);
        return data.filter((_, i) => i % step === 0).map((p) => [p.time, p.price]);
    });

    const timeBuckets = computed((): TimeBucket[] => {
        const range = timeRange.value;
        const now = Date.now();
        let bucketMs: number;
        let bucketCount: number;

        if (range === 1) { bucketMs = 10_000; bucketCount = 6; }
        else if (range === 5) { bucketMs = 30_000; bucketCount = 10; }
        else if (range === 15) { bucketMs = 60_000; bucketCount = 15; }
        else { bucketMs = 300_000; bucketCount = 12; }

        const buckets: TimeBucket[] = [];
        for (let i = bucketCount - 1; i >= 0; i--) {
            const time = now - i * bucketMs;
            buckets.push({
                label: new Date(time).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: range <= 5 ? "2-digit" : undefined,
                    hour12: false,
                }),
                time,
                longVolume: 0,
                shortVolume: 0,
                count: 0,
            });
        }

        whales.value.forEach((whale) => {
            const bucketIndex = buckets.findIndex(
                (b, idx) =>
                    whale.time >= b.time - bucketMs / 2 &&
                    (idx === buckets.length - 1 || whale.time < buckets[idx + 1].time - bucketMs / 2)
            );
            if (bucketIndex >= 0) {
                const bucket = buckets[bucketIndex];
                bucket.count++;
                if (whale.side === "LONG") bucket.longVolume += whale.value;
                if (whale.side === "SHORT") bucket.shortVolume += whale.value;
            }
        });

        return buckets;
    });

    const radarData = computed(() => {
        const total = windowStats.value.longVolume + windowStats.value.shortVolume || 1;
        const bullishPressure = Math.round((windowStats.value.longVolume / total) * 100);
        const bearishPressure = Math.round((windowStats.value.shortVolume / total) * 100);
        const whaleFreq = Math.min(Math.round((windowStats.value.count / (timeRange.value * 2)) * 100), 100);
        const volumeScore = Math.min(Math.round(((windowStats.value.longVolume + windowStats.value.shortVolume) / 1_000_000) * 100), 100);
        const biggestRatio = Math.min(Math.round((stats.value.biggestWhale / 1_000_000) * 100), 100);
        return [bullishPressure, bearishPressure, whaleFreq, volumeScore, biggestRatio];
    });

    const recentWhaleCount = computed(() => {
        const oneMinAgo = Date.now() - 60_000;
        return whales.value.filter((w) => w.time >= oneMinAgo).length;
    });

    return {
        // State
        connectionStatus, isPaused, timeRange, isDarkMode, sideFilter,
        minValueFilter, lastHeartbeat, whales, priceHistory, stats, isHistoryLoaded,
        // Setters
        setConnectionStatus, setIsPaused, setTimeRange, toggleDarkMode,
        setSideFilter, setMinValueFilter, setLastHeartbeat, setHistoryLoaded,
        loadFromCache, mergeServerHistory, initData, addWhale, addPrice, resetData,
        // Computed
        windowStartTime, filteredWhales, windowStats, longShortRatio,
        priceChartData, timeBuckets, radarData, recentWhaleCount,
    };
});
