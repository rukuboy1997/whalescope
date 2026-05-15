import type { SeverityLevel, WhaleSide } from "@/types";

export function formatUSD(value: number, compact = false): string {
    if (compact) {
        if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
        if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
        return `$${value.toFixed(0)}`;
    }
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

export function formatBTC(amount: number): string {
    return `${amount.toFixed(4)} BTC`;
}

export function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
}

export function formatTimeShort(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

export function formatRelativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return `${Math.floor(diff / 3_600_000)}h ago`;
}

export function getSeverity(value: number): SeverityLevel {
    if (value >= 1_000_000) return "leviathan";
    if (value >= 200_000) return "mega";
    if (value >= 50_000) return "whale";
    return "small";
}

export function getSeverityLabel(level: SeverityLevel): string {
    const labels: Record<SeverityLevel, string> = {
        small: "🐟 Small",
        whale: "🐋 Whale",
        mega: "🦈 Mega",
        leviathan: "⚡ Leviathan",
    };
    return labels[level];
}

export function getSeverityColor(level: SeverityLevel): string {
    const colors: Record<SeverityLevel, string> = {
        small: "text-slate-400",
        whale: "text-cyan-400",
        mega: "text-purple-400",
        leviathan: "text-yellow-400",
    };
    return colors[level];
}

export function getSideBadgeClass(side: WhaleSide): string {
    if (side === "LONG") return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    if (side === "SHORT") return "bg-red-500/20 text-red-400 border border-red-500/30";
    return "bg-slate-500/20 text-slate-400 border border-slate-500/30";
}

export function getSentimentColor(sentiment: string): string {
    if (sentiment === "BULLISH") return "text-emerald-400";
    if (sentiment === "BEARISH") return "text-red-400";
    return "text-slate-400";
}

export function getSentimentIcon(sentiment: string): string {
    if (sentiment === "BULLISH") return "▲";
    if (sentiment === "BEARISH") return "▼";
    return "◆";
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}
