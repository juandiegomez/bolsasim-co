# Matriz de trazabilidad

> EDU-001 status: implemented and verified by the E2E learning tests. This supersedes the provisional note below.

> **Cierre Slice 5 (2026-09-11):** PED-001 y PED-002 quedan implementados y verificados. La evidencia automatizada está en [slice-five-validation.md](../testing/slice-five-validation.md). Esta nota prevalece sobre las filas históricas de la tabla base.

Los estados son independientes: `specified` indica contrato documental; `implemented`, código existente; `verified`, evidencia automatizada aprobada. `partial` no acredita el requirement completo. La baseline de Fase 0 tenía únicamente specified=yes; Slice 0 añade evidencia fundacional sin cambiar criterios financieros.

| ID        | Resumen                          | Especificación                           | Contrato                      | Prueba prevista          | Specified | Implemented | Verified |
| --------- | -------------------------------- | ---------------------------------------- | ----------------------------- | ------------------------ | --------- | ----------- | -------- |
| PORT-001  | Depósito inicial único           | Product § Reglas; Domain § Aggregate     | API `/portfolios/initialize`  | unit + integration       | yes       | yes         | yes      |
| PORT-002  | Ledger inmutable y reconstruible | Domain § Transaction                     | repositorio de ledger         | unit + integration       | yes       | yes         | yes      |
| PORT-003  | Compra atómica e idempotente     | Product § J2; Domain § Buy               | API previews/confirm          | unit + concurrency + E2E | yes       | yes         | yes      |
| PORT-004  | Posición y valoración incompleta | Domain § Projections                     | API positions                 | unit + integration + UI  | yes       | yes         | partial  |
| PORT-005  | Evolución fechada                | Product § J1                             | API evolution                 | unit + E2E               | yes       | yes         | partial  |
| INST-001  | Instrumento abstracto            | Domain § Instrument                      | Market data + API instruments | contract + E2E           | yes       | yes         | partial  |
| HIST-001  | Simulación sin efectos           | Product § J3; Domain § Service           | API simulations               | unit + integration       | yes       | yes         | yes      |
| HIST-002  | Resolución de sesiones           | Data § Date resolution                   | Market data + API simulations | unit + contract          | yes       | yes         | yes      |
| HIST-003  | Matemática histórica             | Domain § Historical simulation           | API simulations               | unit + E2E               | yes       | yes         | yes      |
| FIN-001   | Decimal y moneda explícita       | Domain § Value objects; ADR-0004         | todos                         | static + unit + DB       | yes       | partial     | partial  |
| FIN-002   | Escalas y redondeo               | Domain § Precision; ADR-0004             | esquemas decimales            | boundary unit tests      | yes       | yes         | yes      |
| FIN-003   | Fees cero y retorno bruto        | Product § Reglas                         | buy/simulation                | unit + UI                | yes       | yes         | yes      |
| MDATA-001 | Metadata y procedencia           | Data § Responses                         | API market schemas            | adapter contract         | yes       | yes         | yes      |
| MDATA-002 | Fallos explícitos                | Data § Errors                            | Problem response              | contract + UI            | yes       | yes         | partial  |
| UI-001    | Estados completos                | Product § Experience                     | responses/errors              | component + E2E          | yes       | partial     | partial  |
| UI-002    | Avisos y etiqueta demo           | Product § Disclaimer                     | market metadata               | accessibility + E2E      | yes       | partial     | partial  |
| SEC-001   | Autoridad del servidor           | Architecture § Trust                     | API previews/confirm          | tampering integration    | yes       | yes         | partial  |
| OBS-001   | Correlación y errores            | Architecture § Observability             | `X-Request-Id`, Problem       | integration              | yes       | partial     | partial  |
| PERF-001  | Caché de mercado                 | ADR-0007                                 | MarketDataProvider wrapper    | unit + integration       | yes       | yes         | yes      |
| SDD-001   | Specs antes de producción        | AGENTS.md                                | docs                          | review checklist         | yes       | partial     | partial  |
| PED-001   | Escenarios pedagógicos           | Product § Extensión pedagógica; ADR-0010 | API scenarios                 | unit + integration + E2E | yes       | yes         | yes      |
| PED-002   | Anulación y reinicio reversibles | Product § Extensión pedagógica; ADR-0010 | API void/reset                | unit + concurrency + E2E | yes       | yes         | yes      |
| EDU-001   | Explicaciones pedagógicas        | Product § EDU-001; ADR-0011              | UI contextual                 | accessibility + E2E      | yes       | yes         | yes      |

## Adición de Fase 1

**FND-001 — Foundation:** instalación reproducible, shell ejecutable, configuración inválida controlada, liveness HTTP, conexión PostgreSQL y migración repetible, pruebas unitarias/integración/contrato/E2E, format/lint/typecheck/build y pipeline reproducible. Errores: CONFIGURATION_INVALID, DATABASE_UNAVAILABLE, MIGRATION_FAILED e INTERNAL_ERROR. Contratos: health OpenAPI y ADR-0009. Estado de cierre documentado en [evidencia](../testing/slice-zero-validation.md).

| ID      | Implemented | Verified | Evidencia y límite                                                                                                                                                                                                              |
| ------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FIN-001 | partial     | partial  | `tests/unit/decimal.test.ts`, numeric round-trip y Money/Quantity con moneda explícita en `tests/unit/money.test.ts` y `tests/integration/portfolio.test.ts`; Percentage/UnitPrice completan el value object set en slices 3–4. |
| OBS-001 | partial     | partial  | `tests/unit/logging.test.ts`, `tests/contract/health.test.ts`, `tests/e2e/foundation.spec.ts`; solo superficie HTTP fundacional, no rutas financieras futuras.                                                                  |
| SDD-001 | partial     | partial  | ADR-0009 y OpenAPI actualizados antes del código, prueba de imports en `tests/unit/architecture.test.ts`, scripts y workflow; política de PRs futuros no verificable todavía.                                                   |
| FND-001 | yes         | yes      | Configuración, shell, scripts DB, migración, health y tooling reales; evidencia de cierre y run exitoso de GitHub Actions (`33982347963`).                                                                                      |

## Adición de Fase 1 — Slice 1

**PORT-001/PORT-002 — Inicialización y saldo:** tabla `users` con identidad local fija (`DEMO_USER_ID`), aggregate `portfolios` (un portafolio por owner) y ledger `transactions` append-only con índice único parcial que protege el depósito inicial. `POST /api/v1/portfolios/initialize` es idempotente y `GET /api/v1/portfolio` deriva el snapshot del ledger (saldo COP 10.000.000, `valuationStatus=COMPLETE`, posiciones vacías). El dashboard muestra loading, inicialización, saldo exacto formateado y error con reintento. Límites: BUY/SELL permanecen reservados (una secuencia con BUY retorna `CORRUPT_LEDGER` hasta el Slice 3) y la serialización de posiciones no está implementada.

| ID       | Implemented | Verified | Evidencia y límite                                                                                                                                                                                 |
| -------- | ----------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PORT-001 | yes         | yes      | `tests/unit/initialize.test.ts`, `tests/integration/portfolio.test.ts` (depósito único, índice único en base, numeric exacto), `tests/contract/portfolio.test.ts` y `tests/e2e/portfolio.spec.ts`. |
| PORT-002 | yes         | partial  | Reconstrucción y orden determinista verificados (`tests/unit/projector.test.ts`, `tests/integration/portfolio.test.ts`); reconstrucción con BUY llega con el Slice 3.                              |
| FIN-002  | partial     | partial  | Escalas money 2 / quantity 8 con boundary tests; Slice 3 corrige precio/cantidad a `numeric(28,8)` conforme ADR-0004 y añade fraccionamiento de compras.                                           |
| UI-001   | partial     | partial  | Estados loading/inicialización/ready/error del dashboard en `tests/e2e/foundation.spec.ts` y `tests/e2e/portfolio.spec.ts`; resto de vistas en slices 2–4.                                         |

## Adición de Fase 1 — Slice 2

**INST-001/MDATA-001/002/PERF-001 — Explorar y detalle:** puerto `MarketDataProvider` con las seis operaciones del contrato de datos de mercado y cursor opaco. Adapter de archivo único que sirve el dataset demo commiteado (`datasets/demo`, manifiesto con checksum SHA-256 por archivo, etiqueta demo) y está listo para datasets reales vía `MARKET_DATA_ADAPTER=file` (ADR-0005 sigue Proposed). Rutas `/instruments` (búsqueda/listado paginado), `/instruments/{id}` (metadata + `dataMode`), `/instruments/{id}/price` (último cierre con fecha/base/moneda) e `/instruments/{id}/history` (serie inclusiva validada). Caché en proceso con TTL 300 s/86 400 s y ventana negativa breve para fallos reintentables (ADR-0007). UI de exploración y detalle con Recharts y tabla accesible, cinco estados y avisos demo persistentes. Límites: simulación histórica (HIST-001–003) y compras (Slice 3) pendientes; `getPriceOnDate` implementado en el puerto sin ruta pública.

| ID        | Implemented | Verified | Evidencia y límite                                                                                                                                                                    |
| --------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INST-001  | yes         | partial  | `tests/unit/market-dataset.test.ts`, `tests/contract/market-http.test.ts`, `tests/e2e/market.spec.ts`; "solo acciones COP activas operables" se completa con las compras del Slice 3. |
| MDATA-001 | yes         | yes      | Metadata completa en respuestas (fuente, modo, sesión, moneda, obtención, base) verificada en unit, contract y E2E.                                                                   |
| MDATA-002 | yes         | partial  | Fallos controlados sin fallback a mock ni arrays vacíos en unit, contract y E2E; el smoke del proveedor real llega al aprobar ADR-0005.                                               |
| PERF-001  | yes         | yes      | `tests/unit/market-cache.test.ts` (TTL con reloj fijo, ventana negativa), cursor/limit en contract y "Cargar más" en E2E; la UI no se bloquea durante I/O.                            |
| UI-001    | partial     | partial  | Cinco estados navegables en exploración/detalle (`tests/e2e/market.spec.ts`); otras experiencias en slices 3–4.                                                                       |
| UI-002    | partial     | partial  | Etiqueta demo, fecha/base/limitaciones visibles y aviso persistente en E2E de mercado; completar accesibilidad automatizada de otras vistas.                                          |

## Adición de Fase 1 — Slice 3

**PORT-003/004/005 — Compra y dashboard:** calculadora de compras server-side (`quantity` ROUND_DOWN a 8, `grossAmount` HALF_UP a 2, remanente, fees cero FIN-003), previews de cinco minutos con reloj inyectado y confirmación idempotente transaccional con `FOR UPDATE` del aggregate, re-chequeo de fondos y semántica `PREVIEW_ALREADY_USED`/`IDEMPOTENCY_CONFLICT`. Ledger con `ledger_sequence` bigserial como orden de append autoritativo (corrige la indeterminación de `id` ante timestamps iguales) y BUY con `market_data` jsonb inmutable y clave de idempotencia. Proyección de posiciones (`VALUED`/`PRICE_UNAVAILABLE`, nunca cero) y evolución diaria con arrastre del último cierre conocido y `priceSessionDates`. Endpoints `/buy-previews`, `/buy-previews/{id}/confirm`, `/portfolio/evolution` (cota 365 días) y `/portfolio/transactions`; las posiciones se exponen dentro del snapshot `/portfolio` (la ruta dedicada `/portfolio/positions` queda para evidencia futura). Dashboard con métricas, posiciones, movimientos, gráfica y tabla de evolución, degradación parcial visible y aviso de valores incompletos. Migración `0002` corrige `numeric(24,8) → numeric(28,8)` conforme a ADR-0004. Límites: `CORPORATE_ACTION_UNSUPPORTED` reservado; valoración incompleta sin precios demo posteriores a la cobertura del dataset.

| ID       | Implemented | Verified | Evidencia y límite                                                                                                                                                                                                                                                                                |
| -------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PORT-003 | yes         | yes      | `tests/unit/purchase-calculator.test.ts`, `tests/integration/portfolio.test.ts` (replay, vencida, fondos, concurrencia con `FOR UPDATE`, conflicto entre previews), `tests/contract/trading.test.ts` (201/200/409/410), `tests/e2e/trading.spec.ts` (flujo completo 2.000.000 → saldo 8.000.000). |
| PORT-004 | yes         | partial  | `tests/unit/position-projector.test.ts`, snapshot con `PRICE_UNAVAILABLE`/`INCOMPLETE` en contract y dashboard; agregación multi-BUY y `CORPORATE_ACTION_UNSUPPORTED` quedan para evidencia futura.                                                                                               |
| PORT-005 | yes         | partial  | `tests/unit/portfolio-evolution.test.ts`, `tests/contract/trading.test.ts` (arrastre 2026-08-28 y nulls incompletos), `tests/e2e/trading.spec.ts`; la serie con precios demo reales y huecos completos llega con el dataset real (ADR-0005).                                                      |
| FIN-002  | yes         | yes      | Escalas money 2 / quantity 8 con redondeos explícitos, esquemas `numeric(24,2)`/`numeric(28,8)` y fracción de compra verificadas en unit, integration y contract.                                                                                                                                 |
| FIN-003  | yes         | yes      | `calculatePurchase` con fees `0.00` y débito exacto; contrato y E2E verifican el resultado bruto.                                                                                                                                                                                                 |
| SEC-001  | yes         | partial  | Recálculo server-side con body estricto (`additionalProperties: false`) y datos de confirmación tomados solo de la preview; tampering HTTP cubierto en contract, test de manipulación de datos almacenados queda como evidencia futura.                                                           |
| PORT-002 | yes         | yes      | Reconstrucción con depósito y BUY verificados en unit/integration con orden por `ledger_sequence`.                                                                                                                                                                                                |

## Reglas de actualización

- Todo PR enlaza los IDs afectados.
- `implemented=yes` exige referencias a código y migraciones en la descripción del PR.
- `verified=yes` exige el nombre de una prueba ejecutable y resultado CI.
- Un cambio de comportamiento actualiza primero la especificación y, si cambia una decisión estructural, el ADR.

## Adición de Fase 1 — Slice 4

**HIST-001/002/003 — Simulación histórica:** `POST /api/v1/historical-simulations` resuelve el inicio con `ON_OR_AFTER` y el final con `ON_OR_BEFORE` (o la última sesión disponible), calcula cantidad teórica, inversión, remanente, valor final, P&L y retorno bruto con decimales exactos, y nunca persiste ni modifica el ledger. La UI independiente `/simulator` muestra resultado, serie, tabla, metadata, supuestos, etiqueta `demo` y errores de cobertura. La implementación usa el contrato de mercado existente y no selecciona un proveedor real; ADR-0005 sigue siendo el bloqueo de aceptación MVP con datos reales.

| ID       | Implemented | Verified | Evidencia y límite                                                                                                                                                                                                   |
| -------- | ----------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HIST-001 | yes         | yes      | `tests/unit/historical-simulation.test.ts`, `tests/contract/historical-simulation.test.ts` y `tests/e2e/historical-simulation.spec.ts`; la comprobación E2E compara el ledger antes y después sin crear movimientos. |
| HIST-002 | yes         | yes      | `tests/contract/historical-simulation.test.ts` y `tests/e2e/historical-simulation.spec.ts`; cubren fin de semana, fecha final omitida y cobertura insuficiente.                                                      |
| HIST-003 | yes         | yes      | `tests/unit/historical-simulation.test.ts`, contrato OpenAPI y E2E; fixture COP 1.000.000 a 100→120 produce COP 1.200.000 y 20%.                                                                                     |
| UI-001   | partial     | partial  | La experiencia `/simulator` cubre loading, vacío, error y éxito; la evidencia E2E cubre el flujo demo y cobertura insuficiente.                                                                                      |
| UI-002   | partial     | partial  | La UI muestra disclaimer, procedencia, etiqueta `demo`, base, supuestos y tabla accesible; la cobertura global de accesibilidad permanece transversal.                                                               |

## Adición de Fase 1 — Slice 5

**PED-001/PED-002/EDU-001 — Escenarios y aprendizaje:** escenarios locales
archivables, reinicio que conserva la práctica anterior, anulaciones
append-only mediante `VOID_BUY` y explicaciones contextuales ampliables en la
interfaz. El detalle de la implementación y la evidencia está en
[`slice-five-validation.md`](../testing/slice-five-validation.md). Las filas
históricas de la tabla base se consideran actualizadas por esta sección.

| ID      | Implemented | Verified | Evidencia y límite                                                             |
| ------- | ----------- | -------- | ------------------------------------------------------------------------------ |
| PED-001 | yes         | yes      | `tests/e2e/scenarios.spec.ts`; reinicio, archivo y conservación de ejemplos.   |
| PED-002 | yes         | yes      | `tests/e2e/scenarios.spec.ts`; `VOID_BUY`, doble anulación y reconstrucción.   |
| EDU-001 | yes         | yes      | `tests/e2e/learning.spec.ts`; explicaciones visibles, ampliables y accesibles. |

## Plan de cierre — Slice 6

Slice 6 se ejecutará en dos partes según
[`slice-six-plan.md`](../delivery/slice-six-plan.md). Esta sección no cambia
estados de implementación ni verificación: solo registra el trabajo pendiente.

### Slice 6A — Fuente real controlada

| ID        | Implemented | Verified | Evidencia pendiente                                                      |
| --------- | ----------- | -------- | ------------------------------------------------------------------------ |
| MDATA-001 | yes         | partial  | Probar metadata contra una fuente real aprobada, con base y procedencia. |
| MDATA-002 | yes         | partial  | Smoke real, límites y fallos explícitos sin fallback silencioso.         |
| INST-001  | yes         | partial  | Confirmar acciones colombianas activas en COP en la muestra real.        |
| HIST-002  | yes         | yes      | Validar calendario y sesiones del proveedor real.                        |
| HIST-003  | yes         | yes      | Repetir escenarios con datos reales sin cambiar la matemática.           |
| PORT-004  | yes         | partial  | Evidencia con múltiples compras y dataset real.                          |
| PORT-005  | yes         | partial  | Evolución completa y huecos con dataset real.                            |

### Slice 6B — Ruta y evidencia final

| ID       | Implemented | Verified | Evidencia pendiente                                                        |
| -------- | ----------- | -------- | -------------------------------------------------------------------------- |
| PORT-004 | yes         | partial  | Implementar y probar `GET /portfolio/positions`.                           |
| PORT-005 | yes         | partial  | Verificar la ruta de posiciones junto con la evolución sin regresiones.    |
| SEC-001  | yes         | partial  | Completar la prueba de integridad de datos persistidos y autoridad server. |
| UI-001   | partial     | partial  | Cubrir estados de la nueva ruta en la experiencia aplicable.               |
| UI-002   | partial     | partial  | Mantener explicación y procedencia en la superficie de posiciones.         |
| OBS-001  | partial     | partial  | Confirmar `requestId`, Problem y logs en la ruta nueva.                    |
| SDD-001  | partial     | partial  | Registrar gates, límites y decisión final del MVP.                         |
