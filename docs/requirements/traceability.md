# Matriz de trazabilidad

Los estados son independientes: `specified` indica contrato documental; `implemented`, código existente; `verified`, evidencia automatizada aprobada. `partial` no acredita el requirement completo. La baseline de Fase 0 tenía únicamente specified=yes; Slice 0 añade evidencia fundacional sin cambiar criterios financieros.

| ID        | Resumen                          | Especificación                       | Contrato                      | Prueba prevista          | Specified | Implemented | Verified |
| --------- | -------------------------------- | ------------------------------------ | ----------------------------- | ------------------------ | --------- | ----------- | -------- |
| PORT-001  | Depósito inicial único           | Product § Reglas; Domain § Aggregate | API `/portfolios/initialize`  | unit + integration       | yes       | yes         | yes      |
| PORT-002  | Ledger inmutable y reconstruible | Domain § Transaction                 | repositorio de ledger         | unit + integration       | yes       | yes         | partial  |
| PORT-003  | Compra atómica e idempotente     | Product § J2; Domain § Buy           | API previews/confirm          | unit + concurrency + E2E | yes       | no          | no       |
| PORT-004  | Posición y valoración incompleta | Domain § Projections                 | API positions                 | unit + integration + UI  | yes       | no          | no       |
| PORT-005  | Evolución fechada                | Product § J1                         | API evolution                 | unit + E2E               | yes       | no          | no       |
| INST-001  | Instrumento abstracto            | Domain § Instrument                  | Market data + API instruments | contract + E2E           | yes       | no          | no       |
| HIST-001  | Simulación sin efectos           | Product § J3; Domain § Service       | API simulations               | unit + integration       | yes       | no          | no       |
| HIST-002  | Resolución de sesiones           | Data § Date resolution               | Market data + API simulations | unit + contract          | yes       | no          | no       |
| HIST-003  | Matemática histórica             | Domain § Historical simulation       | API simulations               | unit + E2E               | yes       | no          | no       |
| FIN-001   | Decimal y moneda explícita       | Domain § Value objects; ADR-0004     | todos                         | static + unit + DB       | yes       | partial     | partial  |
| FIN-002   | Escalas y redondeo               | Domain § Precision; ADR-0004         | esquemas decimales            | boundary unit tests      | yes       | partial     | partial  |
| FIN-003   | Fees cero y retorno bruto        | Product § Reglas                     | buy/simulation                | unit + UI                | yes       | no          | no       |
| MDATA-001 | Metadata y procedencia           | Data § Responses                     | API market schemas            | adapter contract         | yes       | no          | no       |
| MDATA-002 | Fallos explícitos                | Data § Errors                        | Problem response              | contract + UI            | yes       | no          | no       |
| UI-001    | Estados completos                | Product § Experience                 | responses/errors              | component + E2E          | yes       | no          | no       |
| UI-002    | Avisos y etiqueta demo           | Product § Disclaimer                 | market metadata               | accessibility + E2E      | yes       | no          | no       |
| SEC-001   | Autoridad del servidor           | Architecture § Trust                 | API previews/confirm          | tampering integration    | yes       | no          | no       |
| OBS-001   | Correlación y errores            | Architecture § Observability         | `X-Request-Id`, Problem       | integration              | yes       | partial     | partial  |
| PERF-001  | Caché de mercado                 | ADR-0007                             | MarketDataProvider wrapper    | unit + integration       | yes       | no          | no       |
| SDD-001   | Specs antes de producción        | AGENTS.md                            | docs                          | review checklist         | yes       | partial     | partial  |

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
| FIN-002  | partial     | partial  | Escalas money 2 / quantity 8 con boundary tests en `tests/unit/money.test.ts` y esquemas `numeric(24,2)`/`numeric(24,8)` verificados; fraccionamiento de compras en Slice 3.                       |
| UI-001   | partial     | partial  | Estados loading/inicialización/ready/error del dashboard en `tests/e2e/foundation.spec.ts` y `tests/e2e/portfolio.spec.ts`; resto de vistas en slices 2–4.                                         |

## Reglas de actualización

- Todo PR enlaza los IDs afectados.
- `implemented=yes` exige referencias a código y migraciones en la descripción del PR.
- `verified=yes` exige el nombre de una prueba ejecutable y resultado CI.
- Un cambio de comportamiento actualiza primero la especificación y, si cambia una decisión estructural, el ADR.
