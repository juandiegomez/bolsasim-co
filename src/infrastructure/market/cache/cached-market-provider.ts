import type { Clock } from "@/application/ports/clock";
import type { MarketDataProvider } from "@/application/ports/market-data-provider";
import { DomainError } from "@/domain/errors";

interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAtMs: number;
}

type Cached<T> = CacheEntry<T> | CacheEntry<DomainError>;

// ADR-0007: in-process cache behind the same interface; TTL 300s for recent
// prices and 86,400s for historical series; no Redis, no silent mock fallback.
// Retriable provider failures get a short negative window; other errors are
// never cached.
export function createCachedMarketProvider(
  inner: MarketDataProvider,
  options: {
    clock: Clock;
    recentTtlSeconds: number;
    historicalTtlSeconds: number;
    negativeTtlSeconds?: number;
  },
): MarketDataProvider {
  const store = new Map<string, Cached<unknown>>();
  const nowMs = () => options.clock.now().getTime();
  const negativeTtlMs = (options.negativeTtlSeconds ?? 5) * 1000;

  function read<T>(key: string): T | undefined {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (entry.expiresAtMs <= nowMs()) {
      store.delete(key);
      return undefined;
    }
    if (entry.value instanceof DomainError) throw entry.value;
    return entry.value;
  }

  function write<T>(key: string, value: T, ttlMs: number): void {
    store.set(key, { value, expiresAtMs: nowMs() + ttlMs });
  }

  function writeError(key: string, error: DomainError): void {
    if (
      error.code === "PROVIDER_UNAVAILABLE" ||
      error.code === "RATE_LIMITED"
    ) {
      write(key, error, negativeTtlMs);
    }
  }

  async function cached<T>(
    key: string,
    ttlMs: number,
    operation: () => Promise<T>,
  ): Promise<T> {
    const hit = read<T>(key);
    if (hit !== undefined) return hit;
    try {
      const value = await operation();
      write(key, value, ttlMs);
      return value;
    } catch (error) {
      if (error instanceof DomainError) writeError(key, error);
      throw error;
    }
  }

  return {
    listInstruments(filters, cursor, limit) {
      return cached(
        `instruments:list:${filters.status ?? "*"}:${cursor ?? ""}:${limit ?? ""}`,
        options.recentTtlSeconds * 1000,
        () => inner.listInstruments(filters, cursor, limit),
      );
    },
    searchInstruments(query, cursor, limit) {
      return cached(
        `instruments:search:${query}:${cursor ?? ""}:${limit ?? ""}`,
        options.recentTtlSeconds * 1000,
        () => inner.searchInstruments(query, cursor, limit),
      );
    },
    getInstrument(instrumentId) {
      return cached(
        `instrument:${instrumentId}`,
        options.historicalTtlSeconds * 1000,
        () => inner.getInstrument(instrumentId),
      );
    },
    getLatestPrice(instrumentId, basis) {
      return cached(
        `price:latest:${instrumentId}:${basis}`,
        options.recentTtlSeconds * 1000,
        () => inner.getLatestPrice(instrumentId, basis),
      );
    },
    getPriceOnDate(instrumentId, requestedDate, resolution, basis) {
      return cached(
        `price:date:${instrumentId}:${requestedDate}:${resolution}:${basis}`,
        options.historicalTtlSeconds * 1000,
        () =>
          inner.getPriceOnDate(instrumentId, requestedDate, resolution, basis),
      );
    },
    getHistoricalSeries(instrumentId, from, to, basis) {
      return cached(
        `series:${instrumentId}:${from}:${to}:${basis}`,
        options.historicalTtlSeconds * 1000,
        () => inner.getHistoricalSeries(instrumentId, from, to, basis),
      );
    },
  };
}
