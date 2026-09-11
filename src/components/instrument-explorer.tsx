"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

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

type ExplorerState =
  | { status: "loading" }
  | {
      status: "ready";
      items: InstrumentDTO[];
      nextCursor: string | null;
      query: string;
    }
  | { status: "empty"; query: string }
  | { status: "error"; message: string };

const queryError =
  "No fue posible consultar el mercado. Revisa tu conexión e inténtalo de nuevo.";

export function InstrumentExplorer() {
  const [state, setState] = useState<ExplorerState>({ status: "loading" });
  const [input, setInput] = useState("");
  const requestSeq = useRef(0);

  const loadPage = useCallback(
    (query: string, cursor: string | null, append: boolean) => {
      const seq = requestSeq.current + 1;
      requestSeq.current = seq;
      const params = new URLSearchParams({ limit: "20" });
      if (query.trim().length > 0) params.set("query", query.trim());
      if (cursor) params.set("cursor", cursor);
      void fetch(`/api/v1/instruments?${params.toString()}`, {
        headers: { Accept: "application/json" },
      })
        .then(async (response) => {
          if (seq !== requestSeq.current) return;
          if (!response.ok) {
            setState({ status: "error", message: queryError });
            return;
          }
          const body = (await response.json()) as {
            items: InstrumentDTO[];
            nextCursor: string | null;
          };
          setState((previous) => {
            if (append && previous.status === "ready") {
              return {
                status: "ready",
                items: [...previous.items, ...body.items],
                nextCursor: body.nextCursor,
                query,
              };
            }
            return body.items.length > 0
              ? {
                  status: "ready",
                  items: body.items,
                  nextCursor: body.nextCursor,
                  query,
                }
              : { status: "empty", query };
          });
        })
        .catch(() => {
          if (seq === requestSeq.current) {
            setState({ status: "error", message: queryError });
          }
        });
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(
      () => loadPage(input, null, false),
      input === "" ? 0 : 400,
    );
    return () => clearTimeout(timer);
  }, [input, loadPage]);

  return (
    <div aria-live="polite">
      <form role="search" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="instrument-query">Buscar por símbolo o nombre</label>
        <input
          id="instrument-query"
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ej. DEMO1"
        />
      </form>
      {state.status === "loading" && (
        <p role="status">Consultando instrumentos…</p>
      )}
      {state.status === "empty" && (
        <p>
          {state.query.trim().length > 0
            ? `No hay instrumentos que coincidan con «${state.query.trim()}».`
            : "No hay instrumentos disponibles todavía."}
        </p>
      )}
      {state.status === "error" && (
        <>
          <p>{state.message}</p>
          <button
            className="action"
            type="button"
            onClick={() => loadPage(input, null, false)}
          >
            Reintentar
          </button>
        </>
      )}
      {state.status === "ready" && (
        <>
          <ul className="instrument-list">
            {state.items.map((item) => (
              <li key={item.id}>
                <Link href={`/instruments/${item.id}`}>
                  <strong>{item.symbol}</strong> {item.name}
                </Link>{" "}
                <span className="badge">
                  {item.dataMode === "demo" ? "demo" : "real"}
                </span>{" "}
                <span className="muted">
                  {item.currency} · {item.status}
                </span>
              </li>
            ))}
          </ul>
          {state.nextCursor && (
            <button
              className="action"
              type="button"
              onClick={() => loadPage(input, state.nextCursor, true)}
            >
              Cargar más
            </button>
          )}
        </>
      )}
      <details className="learning-note">
        <summary>¿Cómo leer esta lista?</summary>
        <p>
          <strong>demo</strong> identifica datos preparados para aprender. El
          estado <strong>ACTIVE</strong> indica que la acción puede usarse en
          una compra simulada cuando su moneda coincide con la del portafolio.
          La moneda indica en qué unidad está expresado el precio.
        </p>
      </details>
      <p className="muted">
        Datos etiquetados <span className="badge">demo</span> provienen de
        fixtures del simulador y nunca representan precios reales.
      </p>
    </div>
  );
}
