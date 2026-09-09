"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface MetadataDTO {
  providerId: string;
  mode: "real" | "demo";
  retrievedAt: string;
  priceBasis: string;
  coverageFrom: string | null;
  coverageTo: string | null;
  adjustedPricePolicy: string;
  limitations: string[];
}

interface PriceObservationDTO {
  instrumentId: string;
  sessionDate: string;
  close: string;
  currency: string;
  metadata: MetadataDTO;
}

interface SeriesDTO {
  instrumentId: string;
  observations: PriceObservationDTO[];
  metadata: MetadataDTO;
}

interface InstrumentDTO {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  type: string;
  status: string;
  dataMode: "real" | "demo";
}

type DetailState =
  | { status: "loading" }
  | {
      status: "ready";
      instrument: InstrumentDTO;
      latest: PriceObservationDTO;
      series: SeriesDTO | null;
      seriesUnavailable: string | null;
    }
  | { status: "error"; message: string };

const queryError =
  "No fue posible consultar el instrumento. Revisa tu conexión e inténtalo de nuevo.";

async function readJson(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw { status: response.status, code: problem?.code ?? "UNKNOWN" };
  }
  return response.json();
}

async function loadDetail(instrumentId: string): Promise<DetailState> {
  try {
    const instrument = (await readJson(
      `/api/v1/instruments/${instrumentId}`,
    )) as InstrumentDTO;
    const latest = (await readJson(
      `/api/v1/instruments/${instrumentId}/price`,
    )) as PriceObservationDTO;
    let series: SeriesDTO | null = null;
    let seriesUnavailable: string | null = null;
    const { coverageFrom, coverageTo } = latest.metadata;
    if (coverageFrom && coverageTo) {
      try {
        series = (await readJson(
          `/api/v1/instruments/${instrumentId}/history?from=${coverageFrom}&to=${coverageTo}`,
        )) as SeriesDTO;
      } catch (error) {
        seriesUnavailable =
          (error as { code?: string }).code ?? "SERIES_UNAVAILABLE";
      }
    }
    return { status: "ready", instrument, latest, series, seriesUnavailable };
  } catch (error) {
    const code = (error as { code?: string }).code;
    return {
      status: "error",
      message:
        code === "INSTRUMENT_NOT_FOUND"
          ? "El instrumento solicitado no existe."
          : queryError,
    };
  }
}

export function InstrumentDetail({ instrumentId }: { instrumentId: string }) {
  const [state, setState] = useState<DetailState>({ status: "loading" });

  const refresh = useCallback(() => {
    setState({ status: "loading" });
    void loadDetail(instrumentId).then((next) => setState(next));
  }, [instrumentId]);

  useEffect(() => {
    let cancelled = false;
    void loadDetail(instrumentId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [instrumentId]);

  if (state.status === "loading") {
    return <p role="status">Consultando instrumento…</p>;
  }
  if (state.status === "error") {
    return (
      <div aria-live="polite">
        <p>{state.message}</p>
        <button className="action" type="button" onClick={refresh}>
          Reintentar
        </button>
      </div>
    );
  }

  const { instrument, latest, series, seriesUnavailable } = state;
  const chartData = (series?.observations ?? []).map((entry) => ({
    date: entry.sessionDate,
    close: Number(entry.close),
  }));
  const formattedDate = new Date(latest.metadata.retrievedAt).toISOString();

  return (
    <div aria-live="polite">
      <p>
        <Link href="/instruments">Volver a explorar</Link>
      </p>
      <h2>
        {instrument.symbol}{" "}
        <span className="badge">
          {instrument.dataMode === "demo" ? "demo" : "real"}
        </span>
      </h2>
      <p>{instrument.name}</p>
      <dl>
        <dt>Último cierre disponible</dt>
        <dd className="balance">{latest.close}</dd>
        <dd className="muted">
          {latest.sessionDate} · {latest.currency} · base{" "}
          {latest.metadata.priceBasis} · fuente {latest.metadata.providerId} (
          {latest.metadata.mode}) · obtenido {formattedDate}
        </dd>
      </dl>
      {series && chartData.length > 0 && (
        <section aria-label="Histórico de cierres">
          <h3>
            Serie histórica ({series.metadata.coverageFrom} a{" "}
            {series.metadata.coverageTo})
          </h3>
          <div
            className="chart"
            role="img"
            aria-label={`Gráfica de cierres de ${instrument.symbol}`}
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
              >
                <XAxis dataKey="date" minTickGap={32} />
                <YAxis domain={["auto", "auto"]} />
                <Tooltip
                  formatter={(value) => String(value)}
                  labelFormatter={(label) => String(label)}
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke="#145d50"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <table>
            <caption>Cierres diarios de {instrument.symbol}</caption>
            <thead>
              <tr>
                <th scope="col">Fecha de sesión</th>
                <th scope="col">Cierre ({series.observations[0]?.currency})</th>
              </tr>
            </thead>
            <tbody>
              {series.observations.map((entry) => (
                <tr key={entry.sessionDate}>
                  <td>{entry.sessionDate}</td>
                  <td>{entry.close}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {seriesUnavailable && (
        <p role="status">
          La serie histórica no está disponible para este instrumento (código{" "}
          {seriesUnavailable}); los datos visibles no se sustituyen por ceros.
        </p>
      )}
      <ul>
        {latest.metadata.limitations.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
    </div>
  );
}
