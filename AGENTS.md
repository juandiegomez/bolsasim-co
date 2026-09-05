# AGENTS.md — reglas de trabajo de BolsaSim CO

## Propósito y estado

BolsaSim CO es un simulador educativo de inversiones con capital ficticio, inicialmente enfocado en acciones colombianas. La baseline de Fase 0 está aprobada y el Slice 0 materializa el shell, liveness, configuración, PostgreSQL/Drizzle, decimal.js y tooling. Las funcionalidades de producto siguen pendientes.

La fuente de verdad es, en orden: requirements aprobados y trazados, contratos publicados, ADRs aceptados, tests que verifican esos contratos y, finalmente, implementación. Ante una contradicción, detén el cambio, registra el conflicto y corrige o somete a aprobación la especificación; no elijas silenciosamente.

## Lectura obligatoria antes de modificar

1. Este archivo.
2. La especificación funcional relacionada.
3. [`docs/requirements/traceability.md`](docs/requirements/traceability.md).
4. Los ADRs relacionados.
5. El contrato OpenAPI o de mercado afectado.
6. Los tests existentes del comportamiento.

Identifica los requirement IDs afectados antes de editar. Una funcionalidad no está lista si carece de descripción, criterios de aceptación, reglas, errores, contratos y pruebas esperadas.

## Arquitectura

El sistema será un monolito modular. Las dependencias apuntan hacia adentro:

```text
presentation (Next.js/UI/HTTP)
        -> application (casos de uso y puertos)
                -> domain (reglas y tipos financieros)
infrastructure implementa puertos de application
```

Estructura del Slice 0 y fronteras reservadas:

```text
src/domain/          dominio puro
src/application/     casos de uso y puertos
src/infrastructure/  PostgreSQL, mercado, caché, logging
src/app/             rutas y páginas Next.js
src/components/      presentación
tests/unit/          configuración, decimal, logs y arquitectura
tests/integration/   persistencia y HTTP
tests/contract/      health y Problem contra OpenAPI
tests/e2e/           shell y HTTP reales
drizzle/             migraciones versionadas y journal
scripts/             comandos DB
```

No importes Next.js, Drizzle, Zod HTTP ni proveedores desde el dominio. No hagas cálculos financieros en UI. El servidor vuelve a calcular y validar toda operación.

## Reglas no negociables

- Dinero y cantidades usan decimales exactos; nunca `number`, `float` o `double` para cálculos o persistencia financiera.
- Toda cantidad monetaria tiene moneda explícita. El MVP solo permite compras de instrumentos denominados en COP.
- El ledger es inmutable y autoritativo. Saldo y posiciones son proyecciones reconstruibles.
- Una ausencia de mercado es un error explícito, nunca precio cero.
- Los mocks y fixtures muestran la etiqueta `demo`; nunca se presentan como datos reales.
- No expongas secretos ni datos sensibles en cliente o logs.
- Cambios a contratos, esquemas, reglas financieras o dependencias estructurales requieren actualizar specs y un ADR cuando cambien una decisión.
- No implementes `SELL`, FX, dividendos, autenticación, trading real ni backtesting avanzado sin nuevos requirements aprobados.

## Flujo para una feature

1. Selecciona un vertical slice en [`docs/delivery/vertical-slices.md`](docs/delivery/vertical-slices.md).
2. Confirma Definition of Ready y requirements afectados.
3. Actualiza primero contratos y ADRs si el comportamiento cambia.
4. Implementa desde dominio y persistencia hasta HTTP y UI, manteniendo el slice usable.
5. Añade pruebas con los IDs relevantes en su nombre o descripción.
6. Actualiza trazabilidad sin marcar `verified` hasta contar con evidencia automatizada.
7. Ejecuta todos los gates disponibles y registra limitaciones.

## Comandos

Usa Node 24.11.1, npm 11.6.2 y `npm ci`. Copia `.env.example` a `.env` solo si no existe. Inicia Docker y ejecuta `npm run db:up` (base local 5432, tests 5433). Comandos reales:

```text
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:contract
npm run test:e2e
npm run build
npm run db:check
npm run db:migrate
npm run dev
```

`npm test` agrupa unitarias, integración y contratos. E2E requiere build y `npx playwright install chromium` (en Linux `--with-deps`); arranca su propio servidor 3100. TEST_DATABASE_URL es obligatoria para integración y debe apuntar a una base dedicada terminada en `_test`. Nunca reemplaces PostgreSQL por mocks ni omitas silenciosamente tests. No borres volúmenes de desarrollo. Después de cada cambio ejecuta format check, lint, typecheck, pruebas pertinentes y build; amplía a la suite completa antes de dar por terminado un slice.

Lee [ADR-0009](docs/adr/0009-slice-zero-foundation.md) y [la evidencia del Slice 0](docs/testing/slice-zero-validation.md). Los requisitos transversales pueden tener evidencia parcial: no marques FIN-001 completo por el constructor decimal, ni funcionalidades futuras por un shell. `MarketDataProvider`, fixtures y Recharts se incorporan en Slice 2. No avances automáticamente al Slice 1.

## Criterio de terminado

Un cambio requiere implementación tipada, validación en servidor, errores modelados, estados UI aplicables, tests significativos, documentación sincronizada, format, lint, typecheck, tests y build aprobados, y criterios verificados sin regresiones conocidas. No borres o debilites pruebas para aprobar CI.
