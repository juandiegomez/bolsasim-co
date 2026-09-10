"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

interface BuyPreviewDTO {
  id: string;
  quantity: string;
  grossAmount: { amount: string; currency: string };
  remainder: { amount: string; currency: string };
  totalDebit: { amount: string; currency: string };
  expiresAt: string;
  price: PriceObservationDTO;
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
  const [amount, setAmount] = useState("2000000.00");
  const [preview, setPreview] = useState<BuyPreviewDTO | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const router = useRouter();

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
  const canBuy =
    instrument.type === "EQUITY" &&
    instrument.status === "ACTIVE" &&
    instrument.currency === "COP";

  async function requestPreview() {
    setBuying(true);
    setBuyError(null);
    try {
      const response = await fetch("/api/v1/buy-previews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrumentId,
          amount: { amount, currency: "COP" },
        }),
      });
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.message ??
            "No fue posible preparar la compra.",
        );
      setPreview(await response.json());
    } catch (error) {
      setBuyError(
        error instanceof Error
          ? error.message
          : "No fue posible preparar la compra.",
      );
    } finally {
      setBuying(false);
    }
  }

  async function confirmPurchase() {
    if (!preview) return;
    setBuying(true);
    setBuyError(null);
    try {
      const response = await fetch(
        `/api/v1/buy-previews/${preview.id}/confirm`,
        { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } },
      );
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.message ??
            "No fue posible confirmar la compra.",
        );
      router.push("/");
      router.refresh();
    } catch (error) {
      setBuyError(
        error instanceof Error
          ? error.message
          : "No fue posible confirmar la compra.",
      );
    } finally {
      setBuying(false);
    }
  }

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
      {canBuy && (
        <section className="purchase-panel" aria-labelledby="purchase-title">
          <h3 id="purchase-title">Simular compra hoy</h3>
          <p>
            Usaremos el último cierre disponible, no un precio en tiempo real.
            El capital es ficticio.
          </p>
          {!preview ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void requestPreview();
              }}
            >
              <label htmlFor="purchase-amount">Monto a invertir (COP)</label>
              <input
                id="purchase-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
              <button className="action" type="submit" disabled={buying}>
                {buying ? "Calculando…" : "Ver simulación de compra"}
              </button>
            </form>
          ) : (
            <div className="purchase-preview">
              <p>
                <strong>
                  Preview válida hasta{" "}
                  {new Date(preview.expiresAt).toLocaleTimeString("es-CO")}
                </strong>
              </p>
              <dl>
                <div>
                  <dt>Precio usado</dt>
                  <dd>
                    {preview.price.close} COP ({preview.price.sessionDate})
                  </dd>
                </div>
                <div>
                  <dt>Cantidad estimada</dt>
                  <dd>{preview.quantity}</dd>
                </div>
                <div>
                  <dt>Débito</dt>
                  <dd>$ {preview.totalDebit.amount} COP</dd>
                </div>
                <div>
                  <dt>Remanente</dt>
                  <dd>$ {preview.remainder.amount} COP</dd>
                </div>
              </dl>
              <button
                className="action"
                type="button"
                onClick={() => void confirmPurchase()}
                disabled={buying}
              >
                {buying ? "Confirmando…" : "Confirmar compra simulada"}
              </button>
              <button
                className="secondary-action"
                type="button"
                onClick={() => setPreview(null)}
                disabled={buying}
              >
                Cambiar monto
              </button>
            </div>
          )}
          {buyError && <p role="alert">{buyError}</p>}
        </section>
      )}
      {!canBuy && (
        <section
          className="purchase-panel"
          aria-labelledby="not-tradable-title"
        >
          <h3 id="not-tradable-title">No disponible para compra simulada</h3>
          <p>
            En este MVP solo se pueden comprar acciones activas denominadas en
            COP. Este instrumento opera en {instrument.currency}.
          </p>
          <Link className="secondary-action" href="/instruments">
            Ver instrumentos operables en COP
          </Link>
        </section>
      )}
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
          <div className="table-scroll">
            <table>
              <caption>Cierres diarios de {instrument.symbol}</caption>
              <thead>
                <tr>
                  <th scope="col">Fecha de sesión</th>
                  <th scope="col">
                    Cierre ({series.observations[0]?.currency})
                  </th>
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
          </div>
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
