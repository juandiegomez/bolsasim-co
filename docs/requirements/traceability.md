# Matriz de trazabilidad

Los estados son independientes: `specified` indica contrato documental; `implemented`, código existente; `verified`, evidencia automatizada aprobada. `partial` no acredita el requirement completo. La baseline de Fase 0 tenía únicamente specified=yes; Slice 0 añade evidencia fundacional sin cambiar criterios financieros.

| ID        | Resumen                          | Especificación                       | Contrato                      | Prueba prevista          | Specified | Implemented | Verified |
| --------- | -------------------------------- | ------------------------------------ | ----------------------------- | ------------------------ | --------- | ----------- | -------- |
| PORT-001  | Depósito inicial único           | Product § Reglas; Domain § Aggregate | API `/portfolios/initialize`  | unit + integration       | yes       | no          | no       |
| PORT-002  | Ledger inmutable y reconstruible | Domain § Transaction                 | repositorio de ledger         | unit + integration       | yes       | no          | no       |
| PORT-003  | Compra atómica e idempotente     | Product § J2; Domain § Buy           | API previews/confirm          | unit + concurrency + E2E | yes       | no          | no       |
| PORT-004  | Posición y valoración incompleta | Domain § Projections                 | API positions                 | unit + integration + UI  | yes       | no          | no       |
| PORT-005  | Evolución fechada                | Product § J1                         | API evolution                 | unit + E2E               | yes       | no          | no       |
| INST-001  | Instrumento abstracto            | Domain § Instrument                  | Market data + API instruments | contract + E2E           | yes       | no          | no       |
| HIST-001  | Simulación sin efectos           | Product § J3; Domain § Service       | API simulations               | unit + integration       | yes       | no          | no       |
| HIST-002  | Resolución de sesiones           | Data § Date resolution               | Market data + API simulations | unit + contract          | yes       | no          | no       |
| HIST-003  | Matemática histórica             | Domain § Historical simulation       | API simulations               | unit + E2E               | yes       | no          | no       |
| FIN-001   | Decimal y moneda explícita       | Domain § Value objects; ADR-0004     | todos                         | static + unit + DB       | yes       | partial     | partial  |
| FIN-002   | Escalas y redondeo               | Domain § Precision; ADR-0004         | esquemas decimales            | boundary unit tests      | yes       | no          | no       |
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

| ID      | Implemented | Verified          | Evidencia y límite                                                                                                                                                            |
| ------- | ----------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FIN-001 | partial     | partial           | `tests/unit/decimal.test.ts` y numeric round-trip en `tests/integration/database.test.ts`; Money/monedas/ledger siguen pendientes.                                            |
| OBS-001 | partial     | partial           | `tests/unit/logging.test.ts`, `tests/contract/health.test.ts`, `tests/e2e/foundation.spec.ts`; solo superficie HTTP fundacional, no rutas financieras futuras.                |
| SDD-001 | partial     | partial           | ADR-0009 y OpenAPI actualizados antes del código, prueba de imports en `tests/unit/architecture.test.ts`, scripts y workflow; política de PRs futuros no verificable todavía. |
| FND-001 | yes         | pending final run | Configuración, shell, scripts DB, migración, health y tooling reales; véase evidencia de cierre.                                                                              |

## Reglas de actualización

- Todo PR enlaza los IDs afectados.
- `implemented=yes` exige referencias a código y migraciones en la descripción del PR.
- `verified=yes` exige el nombre de una prueba ejecutable y resultado CI.
- Un cambio de comportamiento actualiza primero la especificación y, si cambia una decisión estructural, el ADR.
