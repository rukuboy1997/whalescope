import { onUnmounted, ref } from "vue";
import type { SSEInitEvent, SSEWhaleEvent, SSEPriceEvent } from "@/types";
import { parseSSEData } from "@/utils/validators";
import { useWhaleStore } from "@/stores/whaleStore";

const BASE_DELAY = 1000;
const MAX_DELAY = 30_000;
const MAX_ATTEMPTS = 10;

export function useWhaleStream() {
    const store = useWhaleStore();
    const reconnectAttempts = ref(0);

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isDestroyed = false;

    function getApiUrl(): string {
        const env = import.meta.env.VITE_API_URL as string | undefined;
        return env && env !== "" ? env : "http://localhost:5000";
    }

    function clearReconnectTimer() {
        if (reconnectTimer !== null) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    }

    function closeEventSource() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
    }

    function scheduleReconnect() {
        if (isDestroyed) return;
        if (reconnectAttempts.value >= MAX_ATTEMPTS) {
            store.setConnectionStatus("error");
            return;
        }
        const delay = Math.min(BASE_DELAY * 2 ** reconnectAttempts.value, MAX_DELAY);
        reconnectAttempts.value++;
        store.setConnectionStatus("disconnected");
        reconnectTimer = setTimeout(() => {
            if (!isDestroyed && !store.isPaused) connect();
        }, delay);
    }

    function handleMessage(event: MessageEvent) {
        if (store.isPaused) return;

        const parsed = parseSSEData(event.data);
        if (!parsed) return;

        switch (parsed.type) {
            case "init": {
                const e = parsed as SSEInitEvent;
                store.initData({
                    stats: e.stats,
                    whales: e.whales,
                    priceHistory: e.priceHistory,
                });
                break;
            }
            case "whale": {
                const e = parsed as SSEWhaleEvent;
                store.addWhale(e.whale, e.stats);
                break;
            }
            case "price": {
                const e = parsed as SSEPriceEvent;
                store.addPrice(e.time, e.price);
                break;
            }
            case "heartbeat": {
                store.setLastHeartbeat(Date.now());
                break;
            }
        }
    }

    function connect() {
        if (isDestroyed) return;

        clearReconnectTimer();
        closeEventSource();

        store.setConnectionStatus("connecting");

        try {
            const url = `${getApiUrl()}/stream`;
            eventSource = new EventSource(url);

            eventSource.onopen = () => {
                if (isDestroyed) {
                    closeEventSource();
                    return;
                }
                store.setConnectionStatus("connected");
                reconnectAttempts.value = 0;
            };

            eventSource.onmessage = handleMessage;

            eventSource.onerror = () => {
                closeEventSource();
                scheduleReconnect();
            };
        } catch {
            scheduleReconnect();
        }
    }

    function disconnect() {
        clearReconnectTimer();
        closeEventSource();
        store.setConnectionStatus("disconnected");
    }

    function pause() {
        store.setIsPaused(true);
    }

    function resume() {
        store.setIsPaused(false);
        if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
            reconnectAttempts.value = 0;
            connect();
        }
    }

    function togglePause() {
        if (store.isPaused) {
            resume();
        } else {
            pause();
        }
    }

    onUnmounted(() => {
        isDestroyed = true;
        disconnect();
    });

    return {
        connect,
        disconnect,
        pause,
        resume,
        togglePause,
        reconnectAttempts,
    };
}
