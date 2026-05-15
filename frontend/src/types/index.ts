export type WhaleSide = "LONG" | "SHORT" | "NEUTRAL";
export type Sentiment = "BULLISH" | "BEARISH" | "NEUTRAL";
export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";
export type TimeRange = 1 | 5 | 15 | 60;
export type SeverityLevel = "small" | "whale" | "mega" | "leviathan";

export interface Whale {
    time: number;
    value: number;
    side: WhaleSide;
    price: number;
    amount: number;
    direction?: string;
}

export interface PricePoint {
    time: number;
    price: number;
}

export interface Stats {
    whaleCount: number;
    whaleLongVolume: number;
    whaleShortVolume: number;
    biggestWhale: number;
    sentiment: Sentiment;
    currentPrice: number;
}

export interface WindowStats {
    count: number;
    longVolume: number;
    shortVolume: number;
    sentiment: Sentiment;
}

export interface SSEInitEvent {
    type: "init";
    stats: Stats;
    whales: Whale[];
    priceHistory: PricePoint[];
}

export interface SSEWhaleEvent {
    type: "whale";
    whale: Whale;
    stats: Stats;
}

export interface SSEPriceEvent {
    type: "price";
    time: number;
    price: number;
}

export interface SSEHeartbeatEvent {
    type: "heartbeat";
    ts: number;
}

export type SSEEvent = SSEInitEvent | SSEWhaleEvent | SSEPriceEvent | SSEHeartbeatEvent;

export interface TimeBucket {
    label: string;
    time: number;
    longVolume: number;
    shortVolume: number;
    count: number;
}

export interface ChartDataPoint {
    time: number;
    value: number;
}
