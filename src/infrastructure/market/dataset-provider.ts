import type { MarketDataProvider } from "@/application/ports/market-data-provider";
import type { Clock } from "@/application/ports/clock";
import { FinancialDecimal } from "@/domain/decimal";
import Decimal from "decimal.js";
import { DomainError } from "@/domain/errors";
import type { InstrumentId } from "@/domain/ids";
import type {
  Instrument,
  InstrumentStatus,
  PriceBasis,
} from "@/domain/instrument";
import type {
  DataMode,
  InstrumentRecord,
  MarketDataMetadata,
  Page,
  PriceObservation,
} from "@/domain/market";
import type { MarketDate } from "@/domain/transaction";

export interface DatasetInstrument {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  type: string;
  status: string;
}

export interface DatasetObservation {
  instrumentId: string;
  sessionDate: string;
  close: string;
  currency: string;
}

export interface DatasetPayload {
  instruments: DatasetInstrument[];
  observations: DatasetObservation[];
}

export interface DatasetDescriptor {
  providerId: string;
  mode: DataMode;
  basis: readonly PriceBasis[];
  adjustedPricePolicy: string;
  limitations: readonly string[];
}

const INSTRUMENT_TYPES = [
  "EQUITY",
  "ETF",
  "FIXED_INCOME",
  "FUND",
  "INDEX",
  "CURRENCY",
] as const;
const INSTRUMENT_STATUSES = ["ACTIVE", "INACTIVE", "UNAVAILABLE"] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString("base64url");
}

function decodeCursor(cursor: string): number {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as { o?: unknown };
    if (
      typeof parsed.o !== "number" ||
      !Number.isInteger(parsed.o) ||
      parsed.o < 0
    ) {
      throw new Error("bad offset");
    }
    return parsed.o;
  } catch {
    throw new DomainError(
      "INVALID_QUERY",
      "El cursor de paginación es inválido.",
    );
  }
}

function isMarketDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function fail(
  code:
    | "INVALID_PROVIDER_DATA"
    | "INSTRUMENT_NOT_FOUND"
    | "NO_MARKET_DATA"
    | "NO_MARKET_SESSION"
    | "INVALID_DATE_RANGE"
    | "INVALID_QUERY"
    | "COVERAGE_INSUFFICIENT"
    | "UNSUPPORTED_PRICE_BASIS",
  detail: string,
): never {
  throw new DomainError(code, detail);
}

export function createDatasetMarketDataProvider(
  payload: DatasetPayload,
  descriptor: DatasetDescriptor,
  clock: Clock,
): MarketDataProvider {
  const byId = new Map<string, Instrument>();
  for (const instrument of payload.instruments) {
    if (byId.has(instrument.id)) {
      fail(
        "INVALID_PROVIDER_DATA",
        `id de instrumento duplicado: ${instrument.id}`,
      );
    }
    if (!/^[A-Z]{3}$/.test(instrument.currency)) {
      fail(
        "INVALID_PROVIDER_DATA",
        `moneda inválida para ${instrument.symbol}`,
      );
    }
    if (!INSTRUMENT_TYPES.includes(instrument.type as never)) {
      fail("INVALID_PROVIDER_DATA", `tipo inválido para ${instrument.symbol}`);
    }
    if (!INSTRUMENT_STATUSES.includes(instrument.status as never)) {
      fail(
        "INVALID_PROVIDER_DATA",
        `estado inválido para ${instrument.symbol}`,
      );
    }
    byId.set(instrument.id, {
      id: instrument.id as InstrumentId,
      symbol: instrument.symbol,
      name: instrument.name,
      exchange: instrument.exchange,
      currency: instrument.currency as Instrument["currency"],
      type: instrument.type as Instrument["type"],
      status: instrument.status as InstrumentStatus,
    });
  }

  const symbolToId = new Map<string, string>();
  for (const instrument of byId.values()) {
    symbolToId.set(instrument.symbol, instrument.id);
  }
  const sortedSymbols = [...symbolToId.keys()].sort((a, b) =>
    a.localeCompare(b),
  );

  const observationsByInstrument = new Map<
    string,
    { sessionDate: MarketDate; close: Decimal }[]
  >();
  for (const entry of payload.observations) {
    const instrument = byId.get(entry.instrumentId);
    if (!instrument) {
      fail(
        "INVALID_PROVIDER_DATA",
        `observación de instrumento desconocido: ${entry.instrumentId}`,
      );
    }
    if (entry.currency !== instrument!.currency) {
      fail(
        "INVALID_PROVIDER_DATA",
        `moneda inconsistente para ${instrument!.symbol}`,
      );
    }
    if (!isMarketDate(entry.sessionDate)) {
      fail(
        "INVALID_PROVIDER_DATA",
        `fecha de sesión inválida: ${entry.sessionDate}`,
      );
    }
    const close = new FinancialDecimal(entry.close);
    if (!close.isFinite() || !close.isPositive() || close.decimalPlaces() > 8) {
      fail(
        "INVALID_PROVIDER_DATA",
        `cierre inválido para ${instrument!.symbol} en ${entry.sessionDate}`,
      );
    }
    const series = observationsByInstrument.get(entry.instrumentId) ?? [];
    series.push({ sessionDate: entry.sessionDate, close });
    observationsByInstrument.set(entry.instrumentId, series);
  }
  for (const [instrumentId, series] of observationsByInstrument) {
    series.sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
    for (let index = 1; index < series.length; index += 1) {
      if (series[index]!.sessionDate === series[index - 1]!.sessionDate) {
        fail("INVALID_PROVIDER_DATA", `sesión duplicada para ${instrumentId}`);
      }
    }
  }

  const allSessions = payload.observations
    .map((entry) => entry.sessionDate)
    .sort();
  const coverageFrom = allSessions[0] ?? null;
  const coverageTo = allSessions.at(-1) ?? null;
  const retrievedAt = clock.now();

  function metadata(basis: PriceBasis): MarketDataMetadata {
    return {
      providerId: descriptor.providerId,
      mode: descriptor.mode,
      retrievedAt,
      priceBasis: basis,
      coverageFrom,
      coverageTo,
      adjustedPricePolicy: descriptor.adjustedPricePolicy,
      limitations: descriptor.limitations,
    };
  }

  function defaultBasis(): PriceBasis {
    return descriptor.basis[0] ?? "UNADJUSTED_CLOSE";
  }

  function instrumentOrThrow(instrumentId: InstrumentId): Instrument {
    const instrument = byId.get(instrumentId);
    if (!instrument) {
      fail("INSTRUMENT_NOT_FOUND", `Instrumento desconocido: ${instrumentId}`);
    }
    return instrument!;
  }

  function instrumentRecord(instrument: Instrument): InstrumentRecord {
    return { instrument, metadata: metadata(defaultBasis()) };
  }

  function assertBasis(basis: PriceBasis): void {
    if (!descriptor.basis.includes(basis)) {
      fail(
        "UNSUPPORTED_PRICE_BASIS",
        `La base ${basis} no está disponible en esta fuente.`,
      );
    }
  }

  function assertWithinCoverage(requested: MarketDate): void {
    if (
      (coverageFrom && requested < coverageFrom) ||
      (coverageTo && requested > coverageTo)
    ) {
      fail(
        "COVERAGE_INSUFFICIENT",
        "La solicitud está fuera de la cobertura declarada.",
      );
    }
  }

  function priceObservation(
    instrumentId: InstrumentId,
    sessionDate: MarketDate,
    close: Decimal,
    basis: PriceBasis,
  ): PriceObservation {
    return {
      instrumentId,
      sessionDate,
      close: close.toFixed(),
      currency: instrumentOrThrow(instrumentId).currency,
      metadata: metadata(basis),
    };
  }

  function page(
    records: InstrumentRecord[],
    cursor: string | undefined,
    limit: number | undefined,
  ): Page<InstrumentRecord> {
    const offset = cursor ? decodeCursor(cursor) : 0;
    const size = Math.min(limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const items = records.slice(offset, offset + size);
    const nextCursor =
      offset + size < records.length ? encodeCursor(offset + size) : null;
    return { items, nextCursor };
  }

  function orderedRecords(instruments: Instrument[]): InstrumentRecord[] {
    return [...instruments]
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
      .map(instrumentRecord);
  }

  function instrumentsBySymbols(symbols: string[]): Instrument[] {
    return symbols
      .map((symbol) => byId.get(symbolToId.get(symbol)!)!)
      .filter((instrument) => Boolean(instrument));
  }

  return {
    async listInstruments(filters, cursor, limit) {
      const selected = instrumentsBySymbols(sortedSymbols).filter(
        (instrument) => !filters.status || instrument.status === filters.status,
      );
      return page(orderedRecords(selected), cursor, limit);
    },
    async searchInstruments(query, cursor, limit) {
      const needle = normalizeQuery(query);
      const matched = sortedSymbols.filter((symbol) => {
        const instrument = byId.get(symbolToId.get(symbol)!);
        return `${instrument!.symbol} ${instrument!.name}`
          .toLowerCase()
          .includes(needle);
      });
      return page(orderedRecords(instrumentsBySymbols(matched)), cursor, limit);
    },
    async getInstrument(instrumentId) {
      return instrumentRecord(instrumentOrThrow(instrumentId));
    },
    async getLatestPrice(instrumentId, basis) {
      assertBasis(basis);
      const series = observationsByInstrument.get(instrumentId) ?? [];
      const last = series.at(-1);
      if (!last) {
        fail("NO_MARKET_DATA", "El instrumento no tiene observaciones.");
      }
      return priceObservation(
        instrumentId,
        last!.sessionDate,
        last!.close,
        basis,
      );
    },
    async getPriceOnDate(instrumentId, requestedDate, resolution, basis) {
      assertBasis(basis);
      if (!isMarketDate(requestedDate)) {
        fail("INVALID_DATE_RANGE", `Fecha inválida: ${requestedDate}`);
      }
      assertWithinCoverage(requestedDate);
      const series = observationsByInstrument.get(instrumentId) ?? [];
      if (resolution === "ON_OR_AFTER") {
        const found = series.find(
          (entry) => entry.sessionDate >= requestedDate,
        );
        if (!found) {
          fail(
            "NO_MARKET_SESSION",
            "No hay sesión posterior o igual dentro de la cobertura.",
          );
        }
        return priceObservation(
          instrumentId,
          found!.sessionDate,
          found!.close,
          basis,
        );
      }
      const previous = [...series]
        .reverse()
        .find((entry) => entry.sessionDate <= requestedDate);
      if (!previous) {
        fail(
          "NO_MARKET_SESSION",
          "No hay sesión anterior o igual dentro de la cobertura.",
        );
      }
      return priceObservation(
        instrumentId,
        previous!.sessionDate,
        previous!.close,
        basis,
      );
    },
    async getHistoricalSeries(instrumentId, from, to, basis) {
      assertBasis(basis);
      if (!isMarketDate(from) || !isMarketDate(to) || from > to) {
        fail("INVALID_DATE_RANGE", "El rango de fechas es inválido.");
      }
      assertWithinCoverage(from);
      assertWithinCoverage(to);
      const series = observationsByInstrument
        .get(instrumentId)
        ?.filter(
          (entry) => entry.sessionDate >= from && entry.sessionDate <= to,
        );
      if (!series || series.length === 0) {
        fail(
          "NO_MARKET_DATA",
          "No hay observaciones del instrumento en el rango solicitado.",
        );
      }
      return {
        instrumentId,
        observations: series.map((entry) => ({
          instrumentId,
          sessionDate: entry.sessionDate,
          close: entry.close.toFixed(),
          currency: instrumentOrThrow(instrumentId).currency,
          metadata: metadata(basis),
        })),
        metadata: metadata(basis),
      };
    },
  };
}
