"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCallback, useEffect, useMemo, useState } from "react";

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

interface SimulationDTO {
  instrument: InstrumentDTO;
  requestedAmount: { amount: string; currency: string };
  requestedStartDate: string;
  requestedEndDate: string | null;
  effectiveStartDate: string;
  effectiveEndDate: string;
  initialPrice: {
    sessionDate: string;
    close: string;
    currency: string;
    metadata: MetadataDTO;
  };
  finalPrice: {
    sessionDate: string;
    close: string;
    currency: string;
    metadata: MetadataDTO;
  };
  quantity: string;
  investedAmount: { amount: string; currency: string };
  remainder: { amount: string; currency: string };
  finalValue: { amount: string; currency: string };
  pnl: { amount: string; currency: string };
  returnPct: string | null;
  series: {
    date: string;
    price: string;
    value: { amount: string; currency: string };
  }[];
  assumptions: string[];
}

type InstrumentState =
  | { status: "loading" }
  | { status: "ready"; items: InstrumentDTO[] }
  | { status: "empty" }
  | { status: "error" };

const genericError =
  "No fue posible consultar los datos. Revisa tu conexión e inténtalo de nuevo.";

function problemMessage(code: string | undefined): string {
  switch (code) {
    case "COVERAGE_INSUFFICIENT":
      return "Las fechas están fuera de la cobertura disponible.";
    case "NO_MARKET_SESSION":
      return "No existe una sesión de mercado válida para esas fechas.";
    case "INVALID_DATE_RANGE":
      return "Revisa que las fechas formen un rango válido.";
    case "HISTORICAL_AMOUNT_TOO_SMALL":
      return "El monto no alcanza para adquirir una fracción liquidable.";
    case "UNSUPPORTED_PRICE_BASIS":
      return "La base de precio solicitada no está disponible.";
    default:
      return genericError;
  }
}

async function readJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw { code: body?.code as string | undefined };
  }
  return body;
}

export function HistoricalSimulator() {
  const [instrumentState, setInstrumentState] = useState<InstrumentState>({
    status: "loading",
  });
  const [selectedInstrumentId, setSelectedInstrumentId] = useState("");
  const [amount, setAmount] = useState("1000000.00");
  const [requestedStartDate, setRequestedStartDate] = useState("2026-08-03");
  const [requestedEndDate, setRequestedEndDate] = useState("2026-08-28");
  const [simulation, setSimulation] = useState<SimulationDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const loadInstruments = useCallback(() => {
    setInstrumentState({ status: "loading" });
    void readJson("/api/v1/instruments?status=ACTIVE&limit=100")
      .then((body: { items: InstrumentDTO[] }) => {
        const items = body.items.filter(
          (item) => item.type === "EQUITY" && item.status === "ACTIVE",
        );
        setInstrumentState(
          items.length > 0 ? { status: "ready", items } : { status: "empty" },
        );
        setSelectedInstrumentId(items[0]?.id ?? "");
      })
      .catch(() => setInstrumentState({ status: "error" }));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadInstruments, 0);
    return () => window.clearTimeout(timer);
  }, [loadInstruments]);

  const selectedInstrument = useMemo(
    () =>
      instrumentState.status === "ready"
        ? instrumentState.items.find((item) => item.id === selectedInstrumentId)
        : undefined,
    [instrumentState, selectedInstrumentId],
  );

  async function runSimulation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedInstrument) return;
    setRunning(true);
    setError(null);
    setSimulation(null);
    try {
      const result = await readJson("/api/v1/historical-simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrumentId: selectedInstrumentId,
          amount: { amount, currency: selectedInstrument.currency },
          requestedStartDate,
          requestedEndDate: requestedEndDate || null,
          priceBasis: "UNADJUSTED_CLOSE",
        }),
      });
      setSimulation(result as SimulationDTO);
    } catch (cause) {
      setError(problemMessage((cause as { code?: string }).code));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="historical-simulator" aria-live="polite">
      {instrumentState.status === "loading" && (
        <p role="status">Consultando instrumentos disponibles…</p>
      )}
      {instrumentState.status === "empty" && (
        <p>No hay acciones Equity activas disponibles para simular.</p>
      )}
      {instrumentState.status === "error" && (
        <div role="alert">
          <p>{genericError}</p>
          <button className="action" type="button" onClick={loadInstruments}>
            Reintentar
          </button>
        </div>
      )}
      {instrumentState.status === "ready" && (
        <>
          <form className="simulation-form" onSubmit={runSimulation}>
            <div>
              <label htmlFor="historical-instrument">Acción</label>
              <select
                id="historical-instrument"
                value={selectedInstrumentId}
                onChange={(event) =>
                  setSelectedInstrumentId(event.target.value)
                }
                required
              >
                {instrumentState.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.symbol} · {item.name} · {item.currency}
                  </option>
                ))}
              </select>
              {selectedInstrument?.dataMode === "demo" && (
                <p className="muted">
                  Esta acción usa datos <span className="badge">demo</span>.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="historical-amount">
                Monto inicial ({selectedInstrument?.currency ?? "moneda"})
              </label>
              <input
                id="historical-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
            <div className="date-fields">
              <div>
                <label htmlFor="historical-start">Fecha inicial</label>
                <input
                  id="historical-start"
                  type="date"
                  value={requestedStartDate}
                  onChange={(event) =>
                    setRequestedStartDate(event.target.value)
                  }
                  required
                />
              </div>
              <div>
                <label htmlFor="historical-end">Fecha final (opcional)</label>
                <input
                  id="historical-end"
                  type="date"
                  value={requestedEndDate}
                  onChange={(event) => setRequestedEndDate(event.target.value)}
                />
              </div>
            </div>
            <p className="muted">
              El inicio busca la siguiente sesión disponible y el final la
              sesión anterior. No se interpolan días ni precios.
            </p>
            <details className="learning-note">
              <summary>¿Qué está calculando esta simulación?</summary>
              <p>
                La aplicación imagina que invertiste el monto inicial en la
                primera sesión válida y lo conserva invertido hasta la fecha
                final. No crea una compra en tu portafolio.
              </p>
              <ul>
                <li>
                  <strong>Fecha inicial:</strong> si no hubo mercado ese día, se
                  usa la siguiente sesión disponible.
                </li>
                <li>
                  <strong>Fecha final:</strong> se usa la sesión anterior o
                  igual; no se inventan precios para fines de semana.
                </li>
                <li>
                  <strong>Retorno bruto:</strong> compara valor final contra
                  monto invertido y no incluye dividendos ni impuestos.
                </li>
              </ul>
            </details>
            <button className="action" type="submit" disabled={running}>
              {running ? "Calculando…" : "Simular inversión histórica"}
            </button>
          </form>
          {error && <p role="alert">{error}</p>}
          {simulation && <HistoricalResult result={simulation} />}
        </>
      )}
    </div>
  );
}

function HistoricalResult({ result }: { result: SimulationDTO }) {
  const chartData = result.series.map((point) => ({
    date: point.date,
    value: Number(point.value.amount),
  }));

  return (
    <section
      className="simulation-result"
      aria-labelledby="simulation-result-title"
    >
      <div className="simulation-result-heading">
        <div>
          <p className="eyebrow">Resultado</p>
          <h2 id="simulation-result-title">
            {result.instrument.symbol} · {result.effectiveStartDate} a{" "}
            {result.effectiveEndDate}
          </h2>
        </div>
        <span className="badge">
          {result.initialPrice.metadata.mode === "demo" ? "demo" : "real"}
        </span>
      </div>
      <p>
        Fecha solicitada: {result.requestedStartDate} →{" "}
        {result.requestedEndDate ?? "última disponible"}. Base:{" "}
        {result.initialPrice.metadata.priceBasis} · fuente:{" "}
        {result.initialPrice.metadata.providerId}.
      </p>
      <details className="learning-note">
        <summary>¿Cómo leer este resultado?</summary>
        <p>
          La simulación usa una sola base de precio para todo el periodo. Los
          valores son teóricos: sirven para aprender el efecto del tiempo y del
          precio, no predicen resultados futuros.
        </p>
        <dl>
          <div>
            <dt>Cantidad teórica</dt>
            <dd>Fracciones que habrías comprado con el monto inicial.</dd>
          </div>
          <div>
            <dt>Valor final</dt>
            <dd>Cuánto valdría esa cantidad en la fecha final elegida.</dd>
          </div>
          <div>
            <dt>Remanente</dt>
            <dd>
              Parte del monto que no se pudo convertir en una fracción
              liquidable.
            </dd>
          </div>
          <div>
            <dt>Base {result.initialPrice.metadata.priceBasis}</dt>
            <dd>
              Cierre sin ajustes automáticos; la fuente es{" "}
              {result.initialPrice.metadata.providerId} y el modo es{" "}
              {result.initialPrice.metadata.mode}.
            </dd>
          </div>
        </dl>
      </details>
      <dl className="simulation-summary">
        <div>
          <dt>Monto inicial</dt>
          <dd>
            {result.requestedAmount.amount} {result.requestedAmount.currency}
          </dd>
        </div>
        <div>
          <dt>Cantidad teórica</dt>
          <dd>{result.quantity}</dd>
        </div>
        <div>
          <dt>Valor final</dt>
          <dd>
            {result.finalValue.amount} {result.finalValue.currency}
          </dd>
        </div>
        <div>
          <dt>P&amp;L</dt>
          <dd>
            {result.pnl.amount} {result.pnl.currency}
          </dd>
        </div>
        <div>
          <dt>Retorno bruto</dt>
          <dd>{result.returnPct ?? "No aplica"}%</dd>
        </div>
        <div>
          <dt>Remanente</dt>
          <dd>
            {result.remainder.amount} {result.remainder.currency}
          </dd>
        </div>
      </dl>
      <section aria-labelledby="simulation-chart-title">
        <h3 id="simulation-chart-title">Evolución del valor</h3>
        <div
          className="chart"
          role="img"
          aria-label={`Gráfica del valor histórico de ${result.instrument.symbol}`}
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
            >
              <XAxis dataKey="date" minTickGap={32} />
              <YAxis domain={["auto", "auto"]} />
              <Tooltip
                formatter={(value) =>
                  String(value) + " " + result.instrument.currency
                }
                labelFormatter={(label) => String(label)}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#145d50"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      <div className="table-scroll">
        <table>
          <caption>Valor teórico por sesión de mercado</caption>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Precio</th>
              <th scope="col">Valor</th>
            </tr>
          </thead>
          <tbody>
            {result.series.map((point) => (
              <tr key={point.date}>
                <td>{point.date}</td>
                <td>
                  {point.price} {result.instrument.currency}
                </td>
                <td>
                  {point.value.amount} {point.value.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <aside className="simulation-assumptions">
        <h3>Supuestos y limitaciones</h3>
        <ul>
          {result.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
          {result.initialPrice.metadata.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </aside>
    </section>
  );
}
