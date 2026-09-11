# Validación del Slice 1 — Inicialización y saldo

## Alcance materializado

- Value objects `Money` (escala 2, moneda explícita, perfil COP predeterminado, magnitud `numeric(24,2)`) y `Quantity` (escala 8), con redondeos explícitos `roundMoney` (HALF_UP) y `roundQuantity` (ROUND_DOWN) y rechazo de escala excesiva sin redondeo silencioso (FIN-001/FIN-002). La materialización original `numeric(24,8)` de cantidad/precio se corrige a `numeric(28,8)` en Slice 3, conforme ADR-0004.
- Ledger append-only en `transactions` con índice único parcial `transactions_initial_deposit_unique` que protege el depósito inicial, tabla `portfolios` con un portafolio por owner y tabla `users` con la identidad local fija `DEMO_USER_ID` (ADR-0003).
- `POST /api/v1/portfolios/initialize` idempotente y `GET /api/v1/portfolio` que deriva el snapshot del ledger; errores de dominio traducidos a Problem RFC 7807 sin filtrar detalles internos.
- Dashboard con estados loading, inicialización, saldo exacto (`$ 10.000.000,00`) y error con reintento; aviso de capital ficticio persistente.

## Pruebas por requirement

| ID       | Evidencia                                                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| PORT-001 | `tests/unit/initialize.test.ts`, `tests/integration/portfolio.test.ts`, `tests/contract/portfolio.test.ts`, `tests/e2e/portfolio.spec.ts` |
| PORT-002 | `tests/unit/projector.test.ts`, `tests/integration/portfolio.test.ts` (partial: reconstrucción con BUY en Slice 3)                        |
| FIN-001  | `tests/unit/money.test.ts`, round-trip numeric en `tests/integration/portfolio.test.ts`                                                   |
| FIN-002  | `tests/unit/money.test.ts` (boundary); evidencia definitiva de `numeric(24,2)`/`numeric(28,8)` llega con Slice 3.                         |
| UI-001   | `tests/e2e/foundation.spec.ts`, `tests/e2e/portfolio.spec.ts`                                                                             |

## Gates ejecutados localmente (2026-09-09, rama `slice-1-initialization-balance`)

- `format:check`, `lint` (ESLint + Redocly), `typecheck` (next typegen + tsc): sin errores.
- `test:unit`: 30 tests, 7 archivos, aprobados.
- `test:integration` (PostgreSQL 17 real en 5433): 12 tests, 3 archivos, aprobados.
- `test:contract`: 8 tests, 2 archivos, aprobados.
- `build`: aprobado; rutas `/api/v1/portfolio` y `/api/v1/portfolios/initialize` materializadas.
- `test:e2e`: 6 tests aprobados contra el servidor real en 3100 con PostgreSQL local.

## Gates de CI

- Rama: run `34402970154` (pull_request) y `34402953756` (push) aprobados.
- `main` tras el merge (PR #1, squash): run `34403166071` aprobado con PostgreSQL 17 real, `npm test`, build y E2E completos.

## Cambios operativos

- Migración `0001_ledger.sql` crea `users`, `portfolios` y `transactions` con los índices de ADR-0003; el journal se reejecuta sin cambios.
- Nuevo comando `db:create` que crea la base objetivo si no existe; CI lo usa antes de `db:migrate` para preparar `bolsasim_ci`, la base runtime de E2E.
- La configuración activa las variables reservadas `DEMO_USER_ID`, `SETTLEMENT_CURRENCY` e `INITIAL_DEPOSIT_AMOUNT` con los defaults documentados en `.env.example`; `INITIAL_DEPOSIT_COP` permanece como alias legado y los valores inválidos fallan con `CONFIGURATION_INVALID` sin imprimir valores.

## Límites y pendientes

- BUY/SELL siguen reservados: un ledger que contenga BUY retorna `CORRUPT_LEDGER` explícito hasta implementar su proyección en el Slice 3.
- La serialización de posiciones (`Position`, `Instrument`, `PriceObservation`) no está implementada; `positions` siempre es `[]` en este slice (contrato ya publicado en OpenAPI).
- `GET /portfolio/transactions` (ledger paginado) quedó diferido al Slice 3, cuando existan movimientos reales que paginar.
