import type { Whale, PricePoint } from "@/types";

const DB_NAME = "WhaleScope";
const DB_VERSION = 1;
const WHALES_STORE = "whales";
const PRICES_STORE = "prices";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

class WhaleDB {
    private db: IDBDatabase | null = null;
    private opening: Promise<void> | null = null;

    open(): Promise<void> {
        if (this.db) return Promise.resolve();
        if (this.opening) return this.opening;

        this.opening = new Promise<void>((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error("IndexedDB not supported"));
                return;
            }
            const req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains(WHALES_STORE)) {
                    const store = db.createObjectStore(WHALES_STORE, {
                        keyPath: "id",
                        autoIncrement: true,
                    });
                    store.createIndex("time", "time", { unique: false });
                }

                if (!db.objectStoreNames.contains(PRICES_STORE)) {
                    const store = db.createObjectStore(PRICES_STORE, {
                        keyPath: "id",
                        autoIncrement: true,
                    });
                    store.createIndex("time", "time", { unique: false });
                }
            };

            req.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                this.opening = null;
                resolve();
            };

            req.onerror = () => {
                this.opening = null;
                reject(req.error);
            };
        });

        return this.opening;
    }

    private getDB(): IDBDatabase {
        if (!this.db) throw new Error("DB not open");
        return this.db;
    }

    // ── Read ───────────────────────────────────────────────────────────────

    getWhales(maxAgeMs = MAX_AGE_MS): Promise<Whale[]> {
        return new Promise((resolve, reject) => {
            const cutoff = Date.now() - maxAgeMs;
            const db = this.getDB();
            const tx = db.transaction(WHALES_STORE, "readonly");
            const store = tx.objectStore(WHALES_STORE);
            const index = store.index("time");
            // IDBKeyRange: all entries with time >= cutoff
            const range = IDBKeyRange.lowerBound(cutoff);
            const req = index.getAll(range);

            req.onsuccess = () => {
                // Sort newest-first to match server format, strip internal id
                const results = (req.result as (Whale & { id: number })[])
                    .sort((a, b) => b.time - a.time)
                    .map(({ id: _id, ...w }) => w as Whale);
                resolve(results);
            };
            req.onerror = () => reject(req.error);
        });
    }

    getPrices(maxAgeMs = MAX_AGE_MS): Promise<PricePoint[]> {
        return new Promise((resolve, reject) => {
            const cutoff = Date.now() - maxAgeMs;
            const db = this.getDB();
            const tx = db.transaction(PRICES_STORE, "readonly");
            const store = tx.objectStore(PRICES_STORE);
            const index = store.index("time");
            const range = IDBKeyRange.lowerBound(cutoff);
            const req = index.getAll(range);

            req.onsuccess = () => {
                // Sort oldest-first to match server format, strip internal id
                const results = (req.result as (PricePoint & { id: number })[])
                    .sort((a, b) => a.time - b.time)
                    .map(({ id: _id, ...p }) => p as PricePoint);
                resolve(results);
            };
            req.onerror = () => reject(req.error);
        });
    }

    // ── Write ──────────────────────────────────────────────────────────────

    addWhales(whales: Whale[]): Promise<void> {
        return new Promise((resolve, reject) => {
            if (whales.length === 0) { resolve(); return; }
            const db = this.getDB();
            const tx = db.transaction(WHALES_STORE, "readwrite");
            const store = tx.objectStore(WHALES_STORE);
            for (const w of whales) {
                store.add({ ...w });
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    addPrices(prices: PricePoint[]): Promise<void> {
        return new Promise((resolve, reject) => {
            if (prices.length === 0) { resolve(); return; }
            const db = this.getDB();
            const tx = db.transaction(PRICES_STORE, "readwrite");
            const store = tx.objectStore(PRICES_STORE);
            for (const p of prices) {
                store.add({ ...p });
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // ── Replace ────────────────────────────────────────────────────────────

    /** Clear a store and replace with new data. Used after a full server sync. */
    replaceWhales(whales: Whale[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const db = this.getDB();
            const tx = db.transaction(WHALES_STORE, "readwrite");
            const store = tx.objectStore(WHALES_STORE);
            store.clear();
            for (const w of whales) store.add({ ...w });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    replacePrices(prices: PricePoint[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const db = this.getDB();
            const tx = db.transaction(PRICES_STORE, "readwrite");
            const store = tx.objectStore(PRICES_STORE);
            store.clear();
            for (const p of prices) store.add({ ...p });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // ── FIFO Cleanup ───────────────────────────────────────────────────────

    /** Remove all records older than maxAgeMs from both stores (FIFO eviction). */
    cleanup(maxAgeMs = MAX_AGE_MS): Promise<void> {
        const cutoff = Date.now() - maxAgeMs;
        return new Promise((resolve, reject) => {
            const db = this.getDB();
            const tx = db.transaction([WHALES_STORE, PRICES_STORE], "readwrite");
            let done = 0;

            const evict = (storeName: string) => {
                const store = tx.objectStore(storeName);
                const index = store.index("time");
                // Delete all records with time < cutoff
                const range = IDBKeyRange.upperBound(cutoff, true);
                const cursor = index.openCursor(range);
                cursor.onsuccess = (e) => {
                    const c = (e.target as IDBRequest<IDBCursorWithValue>).result;
                    if (c) { c.delete(); c.continue(); }
                    else {
                        done++;
                        if (done === 2) resolve();
                    }
                };
                cursor.onerror = () => reject(cursor.error);
            };

            evict(WHALES_STORE);
            evict(PRICES_STORE);
            tx.onerror = () => reject(tx.error);
        });
    }

    getStoreCounts(): Promise<{ whales: number; prices: number }> {
        return new Promise((resolve, reject) => {
            const db = this.getDB();
            const tx = db.transaction([WHALES_STORE, PRICES_STORE], "readonly");
            const wc = tx.objectStore(WHALES_STORE).count();
            const pc = tx.objectStore(PRICES_STORE).count();
            let counts = { whales: 0, prices: 0 };
            wc.onsuccess = () => { counts.whales = wc.result; };
            pc.onsuccess = () => { counts.prices = pc.result; };
            tx.oncomplete = () => resolve(counts);
            tx.onerror = () => reject(tx.error);
        });
    }
}

// Singleton
export const whaleDB = new WhaleDB();
