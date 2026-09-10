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
  price: { close: string; sessionDate: string } | null;
  marketValue: MoneyDTO | null;
  pnl: MoneyDTO | null;
  returnPct: string | null;
}

interface TransactionDTO {
  id: string;
  type: "INITIAL_DEPOSIT" | "BUY";
  grossAmount: MoneyDTO;
  fees: MoneyDTO;
  executedAt: string;
  instrumentId: string | null;
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

const INITIAL_DEPOSIT_COP = "10000000.00";

// Exact string formatting; the dashboard never computes money as a number.
function formatCop(amount: string): string {
  const negative = amount.startsWith("-");
  const [whole = "0", decimals = ""] = amount.replace("-", "").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}$ ${grouped},${decimals.padEnd(2, "0")}`;
}

function metric(label: string, value: MoneyDTO | null) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value ? formatCop(value.amount) : "Valoración incompleta"}</dd>
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
      const movements = await fetch("/api/v1/portfolio/transactions?limit=10", {
        headers: { Accept: "application/json" },
      });
      const transactions = movements.ok
        ? ((await movements.json()) as { items: TransactionDTO[] }).items
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
      const snapshot = (await response.json()) as PortfolioSnapshotDTO;
      return {
        status: "ready",
        snapshot,
        transactions: [],
        evolution: [],
        movementsUnavailable: false,
        evolutionUnavailable: false,
      };
    }
  } catch {
    return { status: "error", message: initializeError };
  }
  return { status: "error", message: initializeError };
}

export function PortfolioDashboard() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });

  const refresh = useCallback(() => {
    void queryPortfolioState().then((next) => setState(next));
  }, []);

  const start = useCallback(() => {
    setState({ status: "loading" });
    void requestInitializationState().then((next) => setState(next));
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
            portafolio con un depósito inicial de{" "}
            {formatCop(INITIAL_DEPOSIT_COP)}.
          </p>
          <button className="action" type="button" onClick={start}>
            Iniciar simulación
          </button>
        </>
      )}
      {state.status === "ready" && (
        <>
          <dl className="portfolio-metrics">
            <div>
              <dt>Efectivo disponible</dt>
              <dd className="metric-value" data-testid="available-cash">
                {formatCop(state.snapshot.cash.amount)}
              </dd>
            </div>
            {metric("Costo invertido", state.snapshot.investedCost)}
            {metric("Valor total", state.snapshot.totalValue)}
            {metric("P&L", state.snapshot.pnl)}
          </dl>
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
                      <td>{formatCop(position.cost.amount)}</td>
                      <td>
                        {position.price
                          ? `${formatCop(position.price.close)} (${position.price.sessionDate})`
                          : "No disponible"}
                      </td>
                      <td>
                        {position.marketValue
                          ? formatCop(position.marketValue.amount)
                          : "Incompleta"}
                      </td>
                      <td>
                        {position.pnl
                          ? `${formatCop(position.pnl.amount)} (${position.returnPct ?? "—"}%)`
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
            {state.movementsUnavailable ? (
              <p role="status">{movementsWarning}</p>
            ) : state.transactions.length === 0 ? (
              <p>Aún no hay movimientos registrados.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <caption>Historial del ledger, más reciente primero</caption>
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
                            : "Capital inicial"}
                        </th>
                        <td>{formatCop(transaction.grossAmount.amount)}</td>
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
              <h2 id="evolution-title">Evolución del portafolio</h2>
              <p>
                Valor diario usando el último cierre disponible. Un dato
                incompleto nunca se representa como cero.
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
                        value === null ? "Incompleto" : formatCop(String(value))
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#145d50"
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
                        <td>{formatCop(point.cash.amount)}</td>
                        <td>
                          {point.totalValue
                            ? formatCop(point.totalValue.amount)
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
