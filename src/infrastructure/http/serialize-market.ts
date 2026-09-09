import type { InstrumentRecord, Page } from "@/domain/market";

function serializeMetadata(metadata: {
  providerId: string;
  mode: string;
  retrievedAt: Date;
  priceBasis: string;
  coverageFrom: string | null;
  coverageTo: string | null;
  adjustedPricePolicy: string;
  limitations: readonly string[];
}) {
  return {
    providerId: metadata.providerId,
    mode: metadata.mode,
    retrievedAt: metadata.retrievedAt.toISOString(),
    priceBasis: metadata.priceBasis,
    coverageFrom: metadata.coverageFrom,
    coverageTo: metadata.coverageTo,
    adjustedPricePolicy: metadata.adjustedPricePolicy,
    limitations: [...metadata.limitations],
  };
}

function serializeInstrumentRecord(record: InstrumentRecord) {
  return {
    id: record.instrument.id,
    symbol: record.instrument.symbol,
    name: record.instrument.name,
    exchange: record.instrument.exchange,
    currency: record.instrument.currency,
    type: record.instrument.type,
    status: record.instrument.status,
    dataMode: record.metadata.mode,
  };
}

// OpenAPI § Instrument/PriceObservation/HistoricalSeries: exact decimals as
// strings; metadata carries provider, mode, retrieval time, basis and limits.
export function serializeInstrumentPage(page: Page<InstrumentRecord>) {
  return {
    items: page.items.map(serializeInstrumentRecord),
    nextCursor: page.nextCursor,
  };
}

export function serializePriceObservation(observation: {
  instrumentId: string;
  sessionDate: string;
  close: string;
  currency: string;
  metadata: Parameters<typeof serializeMetadata>[0];
}) {
  return {
    instrumentId: observation.instrumentId,
    sessionDate: observation.sessionDate,
    close: observation.close,
    currency: observation.currency,
    metadata: serializeMetadata(observation.metadata),
  };
}

export function serializeHistoricalSeries(series: {
  instrumentId: string;
  observations: readonly {
    instrumentId: string;
    sessionDate: string;
    close: string;
    currency: string;
    metadata: Parameters<typeof serializeMetadata>[0];
  }[];
  metadata: Parameters<typeof serializeMetadata>[0];
}) {
  return {
    instrumentId: series.instrumentId,
    observations: series.observations.map((entry) => ({
      instrumentId: entry.instrumentId,
      sessionDate: entry.sessionDate,
      close: entry.close,
      currency: entry.currency,
      metadata: serializeMetadata(entry.metadata),
    })),
    metadata: serializeMetadata(series.metadata),
  };
}
