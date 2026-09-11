"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  financialTone,
  financialToneLabel,
  formatVisiblePercentage,
} from "./financial-tone";

interface MoneyDTO {
  amount: string;
  currency: string;
}

interface PositionDTO {
  instrument: { symbol: string; name: string; dataMode: "real" | "demo" };
  quantity: string;
  cost: MoneyDTO;
  valuationStatus:
    "VALUED" | "PRICE_UNAVAILABLE" | "CORPORATE_ACTION_UNSUPPORTED";
  price: { close: string; currency: string; sessionDate: string } | null;
  marketValue: MoneyDTO | null;
  pnl: MoneyDTO | null;
  returnPct: string | null;
}

interface TransactionDTO {
  id: string;
  type: "INITIAL_DEPOSIT" | "BUY" | "VOID_BUY";
  grossAmount: MoneyDTO;
  fees: MoneyDTO;
  executedAt: string;
  instrumentId: string | null;
  reversalOfTransactionId: string | null;
}
interface ScenarioDTO {
  id: string;
  portfolioId: string;
  label: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  archivedAt: string | null;
}
interface EvolutionDTO {
  date: string;
  cash: MoneyDTO;
  totalValue: MoneyDTO | null;
  valuationStatus: "COMPLETE" | "INCOMPLETE";
}

interface PortfolioSnapshotDTO {
  portfolioId: string;
  asOf: string;
  cash: MoneyDTO;
  investedCost: MoneyDTO;
  positionsValue: MoneyDTO | null;
  totalValue: MoneyDTO | null;
  pnl: MoneyDTO | null;
  returnPct: string | null;
  valuationStatus: string;
  positions: PositionDTO[];
}

type DashboardState =
  | { status: "loading" }
  | { status: "uninitialized" }
  | {
      status: "ready";
      snapshot: PortfolioSnapshotDTO;
      transactions: TransactionDTO[];
      evolution: EvolutionDTO[];
      scenarios: ScenarioDTO[];
      movementsUnavailable: boolean;
      evolutionUnavailable: boolean;
    }
  | { status: "error"; message: string };

const queryError =
  "No fue posible consultar el portafolio. Revisa tu conexión e inténtalo de nuevo.";
const initializeError =
  "No fue posible inicializar el portafolio. Inténtalo de nuevo.";
const movementsWarning =
  "Los movimientos recientes no están disponibles en este momento.";
const evolutionWarning =
  "La evolución diaria no está disponible en este momento; el resto del portafolio se muestra con la última información disponible.";

// Exact string formatting; the dashboard never computes money as a number.
function formatAmount(amount: string): string {
  const negative = amount.startsWith("-");
  const [whole = "0", decimals = ""] = amount.replace("-", "").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}$ ${grouped},${decimals.padEnd(2, "0")}`;
}

function formatMoney(money: MoneyDTO): string {
  return `${formatAmount(money.amount)} ${money.currency}`;
}

function metric(
  label: string,
  value: MoneyDTO | null,
  tone: ReturnType<typeof financialTone> = "neutral",
  supportingText?: string,
) {
  return (
    <div className={`metric-card trend-${tone}`}>
      <dt>{label}</dt>
      <dd className="metric-value">
        {value ? formatMoney(value) : "Valoración incompleta"}
        {supportingText && (
          <span className="metric-support">{supportingText}</span>
        )}
      </dd>
    </div>
  );
}

async function queryPortfolioState(): Promise<DashboardState> {
  try {
    const response = await fetch("/api/v1/portfolio", {
      headers: { Accept: "application/json" },
    });
    if (response.ok) {
      const snapshot = (await response.json()) as PortfolioSnapshotDTO;
      const movements = await fetch(
        "/api/v1/portfolio/transactions?limit=100",
        {
          headers: { Accept: "application/json" },
        },
      );
      const transactions = movements.ok
        ? ((await movements.json()) as { items: TransactionDTO[] }).items
        : [];
      const scenarioResponse = await fetch("/api/v1/scenarios", {
        headers: { Accept: "application/json" },
      });
      const scenarios = scenarioResponse.ok
        ? ((await scenarioResponse.json()) as { items: ScenarioDTO[] }).items
        : [];
      const end = new Date(snapshot.asOf);
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 30);
      const evolutionResponse = await fetch(
        `/api/v1/portfolio/evolution?from=${start.toISOString().slice(0, 10)}&to=${end.toISOString().slice(0, 10)}`,
        { headers: { Accept: "application/json" } },
      );
      const evolution = evolutionResponse.ok
        ? ((await evolutionResponse.json()) as { items: EvolutionDTO[] }).items
        : [];
      return {
        status: "ready",
        snapshot,
        transactions,
        scenarios,
        evolution,
        movementsUnavailable: !movements.ok,
        evolutionUnavailable: !evolutionResponse.ok,
      };
    }
    if (response.status === 404) {
      const problem = await response.json();
      if (problem.code === "PORTFOLIO_NOT_INITIALIZED") {
        return { status: "uninitialized" };
      }
    }
  } catch {
    return { status: "error", message: queryError };
  }
  return { status: "error", message: queryError };
}

async function requestInitializationState(): Promise<DashboardState> {
  try {
    const response = await fetch("/api/v1/portfolios/initialize", {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    if (response.ok) {
      return queryPortfolioState();
    }
  } catch {
    return { status: "error", message: initializeError };
  }
  return { status: "error", message: initializeError };
}

export function PortfolioDashboard() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const snapshotPnlTone =
    state.status === "ready"
      ? financialTone(state.snapshot.pnl?.amount)
      : "neutral";
  const snapshotPnlSupport =
    state.status === "ready" && state.snapshot.pnl
      ? `${financialToneLabel(snapshotPnlTone)}${formatVisiblePercentage(state.snapshot.returnPct, state.snapshot.pnl.amount) ? ` · ${formatVisiblePercentage(state.snapshot.returnPct, state.snapshot.pnl.amount)}` : ""}`
      : undefined;
  const chartStroke =
    snapshotPnlTone === "positive"
      ? "#147a44"
      : snapshotPnlTone === "negative"
        ? "#b42318"
        : "#145d50";

  const refresh = useCallback(() => {
    void queryPortfolioState().then((next) => setState(next));
  }, []);

  const start = useCallback(() => {
    setState({ status: "loading" });
    void requestInitializationState().then((next) => setState(next));
  }, []);

  const resetScenario = useCallback(async () => {
    if (
      !window.confirm(
        "La práctica actual se conservará como ejemplo y se creará una nueva con capital ficticio. ¿Continuar?",
      )
    )
      return;
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/v1/scenarios/reset", {
        method: "POST",
      });
      if (!response.ok) throw new Error();
      setState(await queryPortfolioState());
    } catch {
      setState({
        status: "error",
        message: "No fue posible crear una nueva práctica. Inténtalo de nuevo.",
      });
    }
  }, []);

  const voidBuy = useCallback(async (transactionId: string) => {
    if (
      !window.confirm(
        "La compra se conservará en el historial, pero dejará de afectar el saldo y las posiciones. ¿Continuar?",
      )
    )
      return;
    setState({ status: "loading" });
    try {
      const response = await fetch(
        `/api/v1/portfolio/transactions/${transactionId}/void`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error();
      setState(await queryPortfolioState());
    } catch {
      setState({
        status: "error",
        message: "No fue posible deshacer la compra. Inténtalo de nuevo.",
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void queryPortfolioState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div aria-live="polite">
      {state.status === "loading" && (
        <p role="status">Consultando tu portafolio…</p>
      )}
      {state.status === "uninitialized" && (
        <>
          <p>
            Este simulador usa capital ficticio. Al iniciar se creará tu
            portafolio con el depósito inicial configurado.
          </p>
          <button className="action" type="button" onClick={start}>
            Iniciar simulación
          </button>
        </>
      )}
      {state.status === "ready" && (
        <>
          <dl className="portfolio-metrics">
            <div className="metric-card">
              <dt>Efectivo disponible</dt>
              <dd className="metric-value" data-testid="available-cash">
                {formatMoney(state.snapshot.cash)}
              </dd>
            </div>
            {metric("Costo invertido", state.snapshot.investedCost)}
            {metric("Valor total", state.snapshot.totalValue)}
            {metric(
              "P&L",
              state.snapshot.pnl,
              snapshotPnlTone,
              snapshotPnlSupport,
            )}
          </dl>
          <details className="learning-note portfolio-guide">
            <summary>¿Cómo leer tu portafolio?</summary>
            <dl>
              <div>
                <dt>Dinero aún no invertido</dt>
                <dd>Dinero ficticio que todavía no está invertido.</dd>
              </div>
              <div>
                <dt>Costo invertido</dt>
                <dd>
                  Lo que costaron las compras que siguen activas, incluidas sus
                  comisiones.
                </dd>
              </div>
              <div>
                <dt>Valor total</dt>
                <dd>
                  Efectivo más el valor actual de tus posiciones. Puede quedar
                  incompleto si falta un precio.
                </dd>
              </div>
              <div>
                <dt>P&amp;L</dt>
                <dd>
                  Ganancia o pérdida frente al capital inicial; no es una
                  promesa de rendimiento futuro.
                </dd>
              </div>
            </dl>
          </details>
          <section className="scenario-panel" aria-labelledby="scenario-title">
            <div className="scenario-heading">
              <div>
                <h2 id="scenario-title">Prácticas</h2>
                <p>
                  La práctica activa se puede reiniciar; las anteriores quedan
                  como ejemplos de solo lectura.
                </p>
              </div>
              <button
                className="secondary-action"
                type="button"
                onClick={resetScenario}
              >
                Conservar y empezar de nuevo
              </button>
            </div>
            {state.scenarios.length > 0 && (
              <ul className="scenario-list">
                {state.scenarios.map((scenario) => (
                  <li key={scenario.id}>
                    <span>{scenario.label}</span>
                    <span className="badge">
                      {scenario.status === "ACTIVE" ? "Activa" : "Archivada"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {state.snapshot.valuationStatus === "INCOMPLETE" && (
            <p role="status">
              La valoración está incompleta: falta un precio válido para al
              menos una posición.
            </p>
          )}
          {state.snapshot.positions.length === 0 ? (
            <div className="empty-portfolio">
              <p>
                Aún no tienes posiciones. Explora instrumentos para preparar una
                compra simulada.
              </p>
              <Link className="action" href="/instruments">
                Explorar instrumentos
              </Link>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <caption>Posiciones derivadas del ledger</caption>
                <thead>
                  <tr>
                    <th>Instrumento</th>
                    <th>Cantidad</th>
                    <th>Costo</th>
                    <th>Último cierre</th>
                    <th>Valor</th>
                    <th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {state.snapshot.positions.map((position) => (
                    <tr key={position.instrument.symbol}>
                      <th scope="row">
                        {position.instrument.symbol}
                        <br />
                        <span className="muted">
                          {position.instrument.name} ·{" "}
                          {position.instrument.dataMode}
                        </span>
                      </th>
                      <td>{position.quantity}</td>
                      <td>{formatMoney(position.cost)}</td>
                      <td>
                        {position.price
                          ? `${formatMoney({
                              amount: position.price.close,
                              currency: position.price.currency,
                            })} (${position.price.sessionDate})`
                          : "No disponible"}
                      </td>
                      <td>
                        {position.marketValue
                          ? formatMoney(position.marketValue)
                          : "Incompleta"}
                      </td>
                      <td
                        className={`financial-result-cell trend-${financialTone(position.pnl?.amount)}`}
                      >
                        {position.pnl
                          ? `${formatMoney(position.pnl)} (${financialToneLabel(financialTone(position.pnl.amount))}${formatVisiblePercentage(position.returnPct, position.pnl.amount) ? ` · ${formatVisiblePercentage(position.returnPct, position.pnl.amount)}` : ""})`
                          : "Incompleto"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <section
            className="recent-movements"
            aria-labelledby="movements-title"
          >
            <h2 id="movements-title">Movimientos recientes</h2>
            <p>
              Aquí puedes revisar todas las operaciones del escenario activo.
              Para corregir una compra, usa <strong>Deshacer compra</strong> en
              su fila: el historial no se borra, pero la compra deja de afectar
              el saldo y las posiciones.
            </p>
            {state.movementsUnavailable ? (
              <p role="status">{movementsWarning}</p>
            ) : state.transactions.length === 0 ? (
              <p>Aún no hay movimientos registrados.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <caption>
                    Historial de movimientos, más reciente primero
                  </caption>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Movimiento</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td>
                          {new Date(transaction.executedAt).toLocaleString(
                            "es-CO",
                            { dateStyle: "medium", timeStyle: "short" },
                          )}
                        </td>
                        <th scope="row">
                          {transaction.type === "BUY"
                            ? "Compra simulada"
                            : transaction.type === "VOID_BUY"
                              ? "Compra deshecha"
                              : "Capital inicial"}
                        </th>
                        <td>
                          {formatMoney(transaction.grossAmount)}
                          {transaction.type === "BUY" && (
                            <button
                              className="text-action"
                              type="button"
                              onClick={() => voidBuy(transaction.id)}
                            >
                              Deshacer compra
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {state.evolutionUnavailable && (
            <p role="status">{evolutionWarning}</p>
          )}
          {state.evolution.length > 0 && (
            <section
              className="portfolio-evolution"
              aria-labelledby="evolution-title"
            >
              <div className="chart-heading">
                <div>
                  <h2 id="evolution-title">Evolución del portafolio</h2>
                  <p>
                    Valor diario usando el último cierre disponible. Un dato
                    incompleto nunca se representa como cero.
                  </p>
                </div>
                <span className={`trend-badge trend-${snapshotPnlTone}`}>
                  {state.snapshot.pnl
                    ? financialToneLabel(snapshotPnlTone)
                    : "Valoración incompleta"}
                </span>
              </div>
              <p className="chart-key">
                El color resume el resultado actual y el texto confirma si es
                ganancia, pérdida o valoración incompleta.
              </p>
              <div
                className="chart"
                role="img"
                aria-label="Gráfica de evolución diaria del valor total del portafolio"
              >
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart
                    data={state.evolution.map((point) => ({
                      date: point.date,
                      total: point.totalValue
                        ? Number(point.totalValue.amount)
                        : null,
                    }))}
                  >
                    <XAxis dataKey="date" minTickGap={36} />
                    <YAxis domain={["auto", "auto"]} />
                    <Tooltip
                      formatter={(value) =>
                        value === null
                          ? "Incompleto"
                          : formatMoney({
                              amount: String(value),
                              currency: state.snapshot.cash.currency,
                            })
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke={chartStroke}
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="table-scroll">
                <table>
                  <caption>Serie diaria de valoración</caption>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Efectivo</th>
                      <th>Valor total</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.evolution.map((point) => (
                      <tr key={point.date}>
                        <td>{point.date}</td>
                        <td>{formatMoney(point.cash)}</td>
                        <td>
                          {point.totalValue
                            ? formatMoney(point.totalValue)
                            : "Incompleto"}
                        </td>
                        <td>
                          {point.valuationStatus === "COMPLETE"
                            ? "Completo"
                            : "Incompleto"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
      {state.status === "error" && (
        <>
          <p>{state.message}</p>
          <button
            className="action"
            type="button"
            onClick={() => {
              setState({ status: "loading" });
              refresh();
            }}
          >
            Reintentar
          </button>
        </>
      )}
    </div>
  );
}
