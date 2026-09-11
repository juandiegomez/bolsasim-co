import { createFileDatasetMarketDataProvider } from "@/infrastructure/market/file-dataset-provider";
import type { Clock } from "@/application/ports/clock";
import type { InstrumentId } from "@/domain/ids";

const datasetPath =
  process.env.MARKET_DATA_REAL_PATH?.trim() ||
  process.env.MARKET_DATA_FILE_PATH?.trim() ||
  "datasets/real";
const manifestPath =
  process.env.MARKET_DATA_MANIFEST_PATH?.trim() ||
  `${datasetPath}/manifest.json`;
const clock: Clock = {
  now: () => new Date("2026-09-11T15:00:00.000Z"),
};

async function main(): Promise<void> {
  const provider = await createFileDatasetMarketDataProvider({
    datasetPath,
    manifestPath,
    clock,
  });
  const page = await provider.listInstruments(
    { status: "ACTIVE" },
    undefined,
    100,
  );

  if (page.items.length < 3) {
    throw new Error(
      "El dataset real debe contener al menos tres Equity activas.",
    );
  }

  const expectedSymbols = new Set(["AAPL", "KO", "MSFT"]);
  const actualSymbols = new Set(
    page.items.map((record) => record.instrument.symbol),
  );
  for (const symbol of expectedSymbols) {
    if (!actualSymbols.has(symbol)) {
      throw new Error(`Falta ${symbol} en el dataset real.`);
    }
  }

  for (const record of page.items) {
    const instrument = record.instrument;
    if (instrument.type !== "EQUITY" || instrument.currency !== "USD") {
      throw new Error(`Perfil incompatible para ${instrument.symbol}.`);
    }
    if (
      record.metadata.mode !== "real" ||
      record.metadata.providerId !== "twelve-data-local"
    ) {
      throw new Error(`Metadata de fuente inválida para ${instrument.symbol}.`);
    }

    const instrumentId = instrument.id as InstrumentId;
    const latest = await provider.getLatestPrice(
      instrumentId,
      "UNADJUSTED_CLOSE",
    );
    if (
      latest.currency !== "USD" ||
      latest.sessionDate !== record.metadata.coverageTo
    ) {
      throw new Error(`Último precio inconsistente para ${instrument.symbol}.`);
    }
    const historical = await provider.getHistoricalSeries(
      instrumentId,
      record.metadata.coverageFrom!,
      record.metadata.coverageTo!,
      "UNADJUSTED_CLOSE",
    );
    if (historical.observations.length < 1000) {
      throw new Error(`Histórico insuficiente para ${instrument.symbol}.`);
    }
    const onDate = await provider.getPriceOnDate(
      instrumentId,
      record.metadata.coverageTo!,
      "ON_OR_BEFORE",
      "UNADJUSTED_CLOSE",
    );
    if (
      onDate.currency !== "USD" ||
      onDate.sessionDate > record.metadata.coverageTo!
    ) {
      throw new Error(
        `Consulta por fecha inconsistente para ${instrument.symbol}.`,
      );
    }
    console.log(
      `${instrument.symbol}: proveedor real, ${historical.observations.length} observaciones, último cierre ${latest.sessionDate}.`,
    );
  }

  console.log(
    `Dataset real verificado: ${page.items.length} instrumentos activos, moneda USD, base UNADJUSTED_CLOSE y checksum válido.`,
  );
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Falló la verificación del dataset.",
  );
  process.exitCode = 1;
});
