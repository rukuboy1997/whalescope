import type { Whale, PricePoint, Stats, SSEEvent } from "@/types";

export function isValidWhale(data: unknown): data is Whale {
    if (!data || typeof data !== "object") return false;
    const w = data as Record<string, unknown>;
    return (
        typeof w.time === "number" &&
        typeof w.value === "number" &&
        typeof w.price === "number" &&
        typeof w.amount === "number" &&
        typeof w.side === "string" &&
        ["LONG", "SHORT", "NEUTRAL"].includes(w.side as string) &&
        w.value > 0 &&
        w.price > 0 &&
        w.amount > 0 &&
        w.time > 0
    );
}

export function isValidPricePoint(data: unknown): data is PricePoint {
    if (!data || typeof data !== "object") return false;
    const p = data as Record<string, unknown>;
    return typeof p.time === "number" && typeof p.price === "number" && p.price > 0 && p.time > 0;
}

export function isValidStats(data: unknown): data is Stats {
    if (!data || typeof data !== "object") return false;
    const s = data as Record<string, unknown>;
    return (
        typeof s.whaleCount === "number" &&
        typeof s.whaleLongVolume === "number" &&
        typeof s.whaleShortVolume === "number" &&
        typeof s.biggestWhale === "number" &&
        typeof s.sentiment === "string" &&
        ["BULLISH", "BEARISH", "NEUTRAL"].includes(s.sentiment as string)
    );
}

export function isValidSSEEvent(data: unknown): data is SSEEvent {
    if (!data || typeof data !== "object") return false;
    const e = data as Record<string, unknown>;
    return (
        typeof e.type === "string" &&
        ["init", "whale", "price", "heartbeat"].includes(e.type as string)
    );
}

export function sanitizeString(input: unknown): string {
    if (typeof input !== "string") return "";
    return input.replace(/[<>&"']/g, (char) => {
        const escapes: Record<string, string> = {
            "<": "&lt;",
            ">": "&gt;",
            "&": "&amp;",
            '"': "&quot;",
            "'": "&#39;",
        };
        return escapes[char] || char;
    });
}

export function parseSSEData(rawData: string): SSEEvent | null {
    try {
        const parsed = JSON.parse(rawData);
        if (!isValidSSEEvent(parsed)) return null;
        return parsed as SSEEvent;
    } catch {
        return null;
    }
}
