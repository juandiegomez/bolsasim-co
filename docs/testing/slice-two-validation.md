# Validación del Slice 2 — Explorar y detalle

## Alcance materializado

- Puerto `MarketDataProvider` (seis operaciones del contrato de datos de mercado, cursor opaco, `limit` 1–100) en `src/application/ports/market-data-provider.ts`, con casos de uso de listado/búsqueda, detalle, último cierre y serie histórica.
- Adapter de archivo (`src/infrastructure/market/file-dataset-provider.ts`) que valida manifiesto versionado, checksum SHA-256 por archivo y esquema del dataset al construir; el arranque falla ante discrepancia. El dataset demo commiteado (`datasets/demo`, etiqueta demo) sirve como mock contractual; `MARKET_DATA_ADAPTER=file` habilita datasets reales cuando ADR-0005 se apruebe.
- Core de dataset (`dataset-provider.ts`): orden determinista por símbolo, unicidad de sesiones, cierres positivos con máximo 8 decimales, moneda y base homogéneas, resolución direccional `ON_OR_AFTER`/`ON_OR_BEFORE` sin interpolar sesiones y errores explícitos (`INSTRUMENT_NOT_FOUND`, `NO_MARKET_DATA`, `NO_MARKET_SESSION`, `INVALID_DATE_RANGE`, `INVALID_QUERY`, `COVERAGE_INSUFFICIENT`, `UNSUPPORTED_PRICE_BASIS`, `INVALID_PROVIDER_DATA`).
- Caché en proceso (ADR-0007): TTL 300 s para recientes, 86 400 s para históricos, ventana negativa de 5 s para fallos reintentables; nunca cachea otros errores ni provoca fallback silencioso.
- HTTP: `/api/v1/instruments`, `/api/v1/instruments/{id}`, `/api/v1/instruments/{id}/price`, `/api/v1/instruments/{id}/history` con mapeo de errores a Problem RFC 7807 (`404/400/422/429/502/503`).
- UI: exploración con búsqueda y paginación por cursor, detalle con último cierre (fecha, base, moneda, fuente, modo, obtención), serie histórica gráfica (Recharts) y tabla accesible, limitaciones visibles, cinco estados y aviso demo persistente.
- Dependencia nueva: `recharts` 3.x (pre-anunciada en AGENTS.md para este slice).

## Pruebas por requirement

| ID        | Evidencia                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------- |
| INST-001  | `tests/unit/market-dataset.test.ts`, `tests/contract/market-http.test.ts`, `tests/e2e/market.spec.ts` |
| MDATA-001 | `tests/unit/market-dataset.test.ts`, `tests/contract/market-http.test.ts`, `tests/e2e/market.spec.ts` |
| MDATA-002 | `tests/unit/market-dataset.test.ts`, contract (404/400/422 con Problem), `tests/e2e/market.spec.ts`   |
| PERF-001  | `tests/unit/market-cache.test.ts`, contract (cursor/limit), `tests/e2e/market.spec.ts`                |
| UI-001    | `tests/e2e/market.spec.ts` (loading/vacío/error/success/incompleto en exploración y detalle)          |
| UI-002    | `tests/e2e/market.spec.ts` (etiqueta demo, fuente/fecha/base, avisos)                                 |

## Gates ejecutados localmente (2026-09-09, rama `slice-2-explore-detail`)

- `format:check`, `lint` (ESLint + Redocly), `typecheck`: sin errores.
- `test:unit`: 48 tests, 9 archivos, aprobados (incluye caché con reloj fijo y dataset).
- `test:integration` (PostgreSQL real): 12 tests, 3 archivos, aprobados (sin regresiones).
- `test:contract`: 13 tests, 3 archivos, aprobados.
- `build`: aprobado; páginas `/instruments` y `/instruments/[id]` y cuatro rutas HTTP materializadas.
- `test:e2e`: 10 tests aprobados contra el servidor real en 3100.

## Cambios operativos

- Config activa `MARKET_DATA_ADAPTER`, `MARKET_DATA_FILE_PATH`, `MARKET_DATA_MANIFEST_PATH`, `MARKET_DATA_RECENT_TTL_SECONDS` (300) y `MARKET_DATA_HISTORICAL_TTL_SECONDS` (86 400); las cadenas vacías en paths se tratan como ausentes y `adapter=file` exige ambos paths.
- `datasets/demo` con manifiesto y checksums conmutables por un dataset real con la misma estructura; README del dataset documenta procedencia y limitaciones.

## Límites y pendientes

- ADR-0005 sigue Proposed/blocking: este slice se valida como demo; la aceptación MVP exige dataset real aprobado (la investigación de boletines BVC y datasets abiertos queda como trabajo separado).
- `getPriceOnDate` no tiene ruta pública (consumo interno de Slices 3–4).
- HIST-001–003 (simulación) y PORT-003–005 (compras) permanecen pendientes.
- El componente de detalle usa conversión numérica solo para graficar; la tabla y el último cierre se serializan como strings exactos.
