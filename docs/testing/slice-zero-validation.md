# Slice 0 — registro de validación

Fecha: 2026-09-05. Requirements: FND-001, SDD-001, FIN-001 (partial), OBS-001 (partial).

## Alcance materializado

Next.js/TypeScript con shell sin datos financieros; configuración Zod al arrancar; GET `/api/v1/health`; request IDs y logs JSON; pg/Drizzle; migración de arranque sin tablas de negocio; constructor decimal aislado; Vitest, Playwright, Prettier, ESLint, OpenAPI y pipeline GitHub Actions.

No implementados: depósito, usuario local efectivo, portafolio, ledger, compra, previews, posiciones, simulación histórica, MarketDataProvider, mocks de precios, datos reales, autenticación o ventas. ADR-0005 permanece sin cambios.

## Evidencia en curso

El resultado final de los comandos y la reproducción limpia se registrarán después de la última validación. No interpretar la existencia del workflow como evidencia de una ejecución remota de GitHub Actions.

## Casos verificables

- `tests/unit/config.test.ts`: configuración tipada, campos inválidos y base de tests explícita.
- `tests/unit/decimal.test.ts`: 0.1 + 0.2 exacto y precisión de 50 dígitos sin mutar Decimal global.
- `tests/unit/logging.test.ts`: whitelist de logs y request ID seguro.
- `tests/unit/architecture.test.ts`: imports del dominio y aplicación apuntan hacia adentro.
- `tests/integration/database.test.ts`: conexión PostgreSQL real, migración repetible, ausencia de tablas de negocio y numeric exacto.
- `tests/integration/database-cli.test.ts`: fallos de configuración/conexión/migración sanitizados y exit code 1.
- `tests/contract/health.test.ts`: health y Problem validados contra schemas del OpenAPI; liveness sin conexión DB, error correlacionado y rechazo de escrituras.
- `tests/e2e/foundation.spec.ts`: shell real, teclado, responsive y correlación HTTP en build de producción.
- `tests/e2e/startup.spec.ts`: configuración inválida detiene el servidor real sin filtrar secretos.

## Riesgos

La fuente de mercado ADR-0005 no bloquea este slice. Los avisos del tooling Drizzle y ESLint se documentan en ADR-0009. CI remoto requiere publicar los archivos y ejecutar GitHub Actions; esta entrega no hace push ni declara una ejecución remota inexistente.
