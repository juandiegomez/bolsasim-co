# Validación del Slice 3 — Compra y dashboard

## Alcance materializado

- **PORT-003:** `PurchaseCalculator` server-side (cantidad ROUND_DOWN a 8, `grossAmount` HALF_UP a 2, remanente y fees cero), previews con expiración de cinco minutos sobre reloj inyectado y confirmación idempotente: transacción única con `SELECT … FOR UPDATE` del portafolio, re-chequeo de fondos, `PREVIEW_EXPIRED` en la vigencia inclusiva, `PREVIEW_ALREADY_USED` para preview consumida con otra clave y `IDEMPOTENCY_CONFLICT` (mapeo del índice único del ledger ante claves extranjeras). Concurrencia verificada: dos confirmaciones paralelas producen exactamente un `BUY`.
- **PORT-002 (extensión):** el ledger incorpora `ledger_sequence` bigserial como orden de append autoritativo (elimina la indeterminación del desempate por `id` cuando depósito y compra comparten timestamp) y las filas `BUY` con `market_data` jsonb inmutable, `marketSessionDate` y clave de idempotencia. `projectLedger` reconstruye efectivo, costo invertido y rechaza compras incompletas con `CORRUPT_LEDGER`.
- **PORT-004:** `projectPositions` agrega compras por instrumento (cantidad y costo), valúa con el último cierre disponible (`VALUED`) o deja `PRICE_UNAVAILABLE` con valores null — nunca cero — y el snapshot informa `valuationStatus` completo/incompleto con P&L y retorno por posición.
- **PORT-005:** `GET /portfolio/evolution` reconstruye por día el efectivo y las cantidades del ledger, usa el último cierre conocido anterior o igual (serie solicitada con rango acotado a la cobertura del proveedor para poder arrastrar), expone `priceSessionDates` y marca los días sin precio como `INCOMPLETE` con `totalValue: null`; rango máximo de 365 días con error explícito.
- **HTTP:** `POST /api/v1/buy-previews` (201), `POST /api/v1/buy-previews/{previewId}/confirm` (201/200 replay, 409/410), `GET /api/v1/portfolio/evolution` y `GET /api/v1/portfolio/transactions` (ledger paginado, más reciente primero).
- **UI:** dashboard con métricas exactas ("Valoración incompleta" en lugar de cero), tabla de posiciones, movimientos recientes, gráfica y tabla de evolución (`connectNulls=false`), aviso persistente de incompletos y degradación parcial visible si movimientos o evolución fallan. Detalle de instrumento con formulario de compra (preview → confirmar con `Idempotency-Key` generada en cliente) y panel explícito para instrumentos no operables.
- **Migración `0002`:** corrige `numeric(24,8) → numeric(28,8)` conforme a ADR-0004, añade `market_data`, `idempotency_key` con índice único parcial y `ledger_sequence`; tabla `buy_previews` con índices de idempotencia y vencimiento.

## Pruebas por requirement

| ID       | Evidencia                                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| PORT-003 | `tests/unit/purchase-calculator.test.ts`, `tests/integration/portfolio.test.ts`, `tests/contract/trading.test.ts`, `tests/e2e/trading.spec.ts` |
| PORT-004 | `tests/unit/position-projector.test.ts`, contract (snapshot con posiciones y nulls), E2E dashboard                                             |
| PORT-005 | `tests/unit/portfolio-evolution.test.ts`, contract (arrastre de cierre y nulls incompletos), E2E dashboard                                     |
| FIN-002  | `tests/unit/money.test.ts`, escalas `numeric(24,2)`/`numeric(28,8)` en `tests/integration/database.test.ts` y portfolio                        |
| FIN-003  | `tests/unit/purchase-calculator.test.ts`, contract (fees `0.00`), E2E preview                                                                  |
| SEC-001  | contract (body estricto rechaza campos forjados; confirm solo usa datos server-side), E2E (`INVALID_QUERY` ante campos forjados)               |

## Gates ejecutados localmente (2026-09-10, rama de trabajo del Slice 3)

- `format:check`, `lint` (ESLint + Redocly), `typecheck`: sin errores.
- `test:unit`: 54 tests, 12 archivos, aprobados.
- `test:integration` (PostgreSQL 17 real): 18 tests, 3 archivos, aprobados (incluye concurrencia `FOR UPDATE`).
- `test:contract`: 21 tests, 4 archivos, aprobados.
- `build`: aprobado.
- `test:e2e`: 14 tests aprobados contra servidor real en 3100 con base dedicada de E2E.

## Cambios operativos

- E2E corre contra una base dedicada: `E2E_DATABASE_URL` (config en `.env.example`) es migrada y truncada por el `globalSetup` de Playwright; la base de desarrollo nunca es mutada por pruebas. CI mantiene su base fresca `bolsasim_ci`.
- La corrección de consistencia de ADR-0004 (`numeric(28,8)`) se materializa con migración y se documenta en la propia corrección del ADR.

## Bugs corregidos durante la validación

- **Indeterminación del ledger:** el desempate `(executedAt, createdAt, id)` podía ordenar una compra antes del depósito cuando los timestamps coinciden (reloj fijo), produciendo `CORRUPT_LEDGER` esporádico; el orden autoritativo ahora es `ledger_sequence` (append), con `executedAt/createdAt` como desempates secundarios.
- **Conflicto multi-preview sin mapear:** una clave de idempotencia usada sobre otra preview producía PG 23505 sin traducir (`INTERNAL_ERROR` 500); ahora es `IDEMPOTENCY_CONFLICT` 409 y el caso "preview consumida con otra clave" es `PREVIEW_ALREADY_USED` 409.
- **Etiqueta demo deshonesta:** posiciones sin precio se etiquetaban `dataMode: "demo"` por defecto; ahora la procedencia proviene del `market_data` almacenado en el BUY o del metadata del proveedor.
- **Evolución sin límites:** rangos arbitrarios (miles de millones de puntos) generaban trabajo sin cota; ahora se rechazan >365 días y la serie se recorta a la cobertura para soportar el arrastre.
- **Overflow móvil:** las tablas del dashboard/detalle desbordaban el viewport de 390 px; ahora usan contenedores con scroll horizontal.
- **E2E con base contaminada:** la suite E2E asumía portafolio virgen sobre la base de desarrollo; ahora usa base dedicada con reset determinista.

## Límites y pendientes

- `CORPORATE_ACTION_UNSUPPORTED` permanece reservado (no hay splits en el dataset demo).
- `GET /portfolio/positions` (ruta dedicada del contrato) queda pendiente de implementación; las posiciones hoy se exponen en el snapshot `/portfolio`.
- La evidencia `verified` de PORT-004/005 y SEC-001 es parcial: agregación multi-BUY en E2E, serie completa con dataset real y test de manipulación de datos almacenados llegan con el dataset real (ADR-0005) y el Slice 4.
- Los valores de la evolución con la cobertura demo terminan en `2026-08-28`: los días posteriores se muestran incompletos con el arrastre visible, nunca como cero.
