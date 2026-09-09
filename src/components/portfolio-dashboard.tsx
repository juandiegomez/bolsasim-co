"use client";

import { useCallback, useEffect, useState } from "react";

interface MoneyDTO {
  amount: string;
  currency: string;
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
  positions: unknown[];
}

type DashboardState =
  | { status: "loading" }
  | { status: "uninitialized" }
  | { status: "ready"; snapshot: PortfolioSnapshotDTO }
  | { status: "error"; message: string };

const queryError =
  "No fue posible consultar el portafolio. Revisa tu conexión e inténtalo de nuevo.";
const initializeError =
  "No fue posible inicializar el portafolio. Inténtalo de nuevo.";

const INITIAL_DEPOSIT_COP = "10000000.00";

// Exact string formatting; the dashboard never computes money as a number.
function formatCop(amount: string): string {
  const negative = amount.startsWith("-");
  const [whole = "0", decimals = ""] = amount.replace("-", "").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}$ ${grouped},${decimals.padEnd(2, "0")}`;
}

async function queryPortfolioState(): Promise<DashboardState> {
  try {
    const response = await fetch("/api/v1/portfolio", {
      headers: { Accept: "application/json" },
    });
    if (response.ok) {
      return { status: "ready", snapshot: await response.json() };
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
      return { status: "ready", snapshot: await response.json() };
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
          <dl>
            <dt>Efectivo disponible</dt>
            <dd className="balance" data-testid="available-cash">
              {formatCop(state.snapshot.cash.amount)}
            </dd>
          </dl>
          <p>
            Los instrumentos y compras simuladas estarán disponibles en próximas
            iteraciones.
          </p>
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
