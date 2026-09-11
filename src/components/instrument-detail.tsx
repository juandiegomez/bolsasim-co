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
  fees: { amount: string; currency: string };
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
      portfolioCurrency: string | null;
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
    let portfolioCurrency: string | null = null;
    try {
      const portfolio = (await readJson("/api/v1/portfolio")) as {
        cash?: { currency?: string };
      };
      portfolioCurrency = portfolio.cash?.currency ?? null;
    } catch {
      // The portfolio may not be initialized yet; the detail remains readable.
    }
    return {
      status: "ready",
      instrument,
      latest,
      series,
      seriesUnavailable,
      portfolioCurrency,
    };
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

  const { instrument, latest, series, seriesUnavailable, portfolioCurrency } =
    state;
  const chartData = (series?.observations ?? []).map((entry) => ({
    date: entry.sessionDate,
    close: Number(entry.close),
  }));
  const sessionDateLabel = new Date(
    `${latest.sessionDate}T12:00:00.000Z`,
  ).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const retrievedDateLabel = new Date(
    latest.metadata.retrievedAt,
  ).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const canBuy =
    instrument.type === "EQUITY" &&
    instrument.status === "ACTIVE" &&
    portfolioCurrency === instrument.currency;

  async function requestPreview() {
    setBuying(true);
    setBuyError(null);
    try {
      const response = await fetch("/api/v1/buy-previews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrumentId,
          amount: { amount, currency: instrument.currency },
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
      <p className="detail-links">
        <Link href="/instruments">Volver a explorar</Link>
        <Link href="/">Ver mi portafolio y movimientos</Link>
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
        <dd className="price-context">
          Cierre del {sessionDateLabel} · {latest.currency} ·{" "}
          {latest.metadata.mode === "demo"
            ? "dato demo educativo"
            : "dato de mercado"}
        </dd>
      </dl>
      <details className="learning-note">
        <summary>¿Qué significa este precio?</summary>
        <p>
          Es el último cierre de una sesión de mercado disponible en el dataset.
          No es una cotización en tiempo real ni una recomendación de compra.
        </p>
        <dl>
          <div>
            <dt>Fecha de sesión</dt>
            <dd>{latest.sessionDate}: el día al que pertenece el cierre.</dd>
          </div>
          <div>
            <dt>Moneda</dt>
            <dd>
              {latest.currency}: el precio y la liquidación deben usar esta
              moneda; no se hace conversión automática.
            </dd>
          </div>
          <div>
            <dt>Base UNADJUSTED_CLOSE</dt>
            <dd>
              Cierre sin ajustes automáticos por dividendos o eventos
              corporativos. Para este ejercicio se usa una sola base de precio.
            </dd>
          </div>
          <div>
            <dt>Fuente {latest.metadata.mode === "demo" ? "demo" : "real"}</dt>
            <dd>
              {latest.metadata.mode === "demo"
                ? "Dato de demostración incluido para aprender; no representa una cotización real."
                : "Dato obtenido de la fuente configurada para el ejercicio."}
            </dd>
          </div>
          <div>
            <dt>Obtenido</dt>
            <dd>
              {retrievedDateLabel}: momento en que la aplicación consultó ese
              dato.
            </dd>
          </div>
          <div>
            <dt>Fuente técnica</dt>
            <dd>{latest.metadata.providerId}</dd>
          </div>
          <div>
            <dt>Base técnica</dt>
            <dd>{latest.metadata.priceBasis}</dd>
          </div>
        </dl>
      </details>
      {canBuy && (
        <section className="purchase-panel" aria-labelledby="purchase-title">
          <h3 id="purchase-title">Simular una compra</h3>
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
              <label htmlFor="purchase-amount">
                Monto a invertir ({instrument.currency})
              </label>
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
                    {preview.price.close} {preview.price.currency} (
                    {preview.price.sessionDate})
                  </dd>
                </div>
                <div>
                  <dt>Cantidad estimada</dt>
                  <dd>{preview.quantity}</dd>
                </div>
                <div>
                  <dt>Débito</dt>
                  <dd>
                    $ {preview.totalDebit.amount} {preview.totalDebit.currency}
                  </dd>
                </div>
                <div>
                  <dt>Remanente</dt>
                  <dd>
                    $ {preview.remainder.amount} {preview.remainder.currency}
                  </dd>
                </div>
              </dl>
              <details className="learning-note">
                <summary>¿Cómo leer esta previsualización?</summary>
                <dl>
                  <div>
                    <dt>Precio usado</dt>
                    <dd>
                      El cierre mostrado arriba; no cambia durante esta
                      previsualización.
                    </dd>
                  </div>
                  <div>
                    <dt>Cantidad estimada</dt>
                    <dd>
                      Fracciones de acción que se pueden comprar con tu monto.
                    </dd>
                  </div>
                  <div>
                    <dt>Débito</dt>
                    <dd>
                      Lo que se descuenta de tu efectivo. En este MVP las
                      comisiones son {preview.fees.currency} 0.
                    </dd>
                  </div>
                  <div>
                    <dt>Remanente</dt>
                    <dd>
                      La parte de tu monto que no alcanza para otra fracción
                      liquidable.
                    </dd>
                  </div>
                </dl>
              </details>
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
            {!portfolioCurrency
              ? "Inicializa primero un portafolio para conocer su moneda de liquidación."
              : instrument.type !== "EQUITY" || instrument.status !== "ACTIVE"
                ? "Solo se pueden comprar acciones Equity activas del universo gratuito validado."
                : "Este instrumento opera en " +
                  instrument.currency +
                  " y tu portafolio liquida en " +
                  portfolioCurrency +
                  "; no se hace conversión automática."}
          </p>
          <Link className="secondary-action" href="/instruments">
            Ver instrumentos operables en {portfolioCurrency ?? "tu moneda"}
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
      <details className="learning-note">
        <summary>¿Qué limitaciones tienen estos datos?</summary>
        <ul>
          {latest.metadata.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
